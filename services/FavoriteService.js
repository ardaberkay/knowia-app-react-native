import { supabase } from '../lib/supabase';
import { getCachedBlockedAndHidden, filterDecksByBlockAndHide } from './BlockService';
import { cacheData, getCachedData, invalidateCache, CACHE_DURATIONS } from './CacheService';

const FAVORITE_CARDS_PAGE_SIZE = 50;

const filterReportedFavoriteCardsForUser = async (cards, userId) => {
  if (!userId || !cards || cards.length === 0) return cards;

  const cardIds = cards.map((c) => c.id);
  const { data: reports, error } = await supabase
    .from('reports')
    .select('target_id')
    .eq('reporter_id', userId)
    .eq('report_type', 'card')
    .in('target_id', cardIds);

  if (error) throw error;

  const hiddenIds = new Set((reports || []).map((r) => r.target_id));
  if (hiddenIds.size === 0) return cards;

  return cards.filter((c) => !hiddenIds.has(c.id));
};

// Favori Desteleri Getir (ilişkili deck verisiyle birlikte). Engel/gizle filtresi uygulanır.
// Sıra: en son favorilenen en üstte (favorite_decks.created_at desc).
// options: { page?: number, limit?: number } - limit verilirse Supabase range ile sayfalama yapılır.
export const getFavoriteDecks = async (userId, options = {}) => {
  const {
    page = 0,
    limit,
    searchQuery = '',
    sortBy = 'default',
    categorySortOrders = [],
    languageIds = [],
    forceRefresh = false,
  } = options || {};

  const searchNorm = String(searchQuery || '').trim();
  const searchLike = searchNorm
    ? `%${searchNorm.replace(/%/g, '').replace(/_/g, '').replace(/\\/g, '').replace(/"/g, '')}%`
    : null;
  const categoryList = Array.isArray(categorySortOrders) ? categorySortOrders : [];
  const languageList = Array.isArray(languageIds) ? languageIds : [];
  const cacheKey = `fav_decks_${userId}_p${page}_${limit || 'all'}_${sortBy}_${encodeURIComponent(searchNorm).slice(0, 80)}_${categoryList.join('-')}_${languageList.join('-')}`;

  if (!forceRefresh) {
    const cached = await getCachedData(cacheKey, CACHE_DURATIONS.FAVORITES_DECK_IDS);
    if (cached && !cached.isStale) return cached.data;
  }

  let query = supabase
    .from('favorite_decks')
    .select('deck_id, created_at, decks(id, name, description, card_count, user_id, category_id, is_shared, is_admin_created, updated_at, created_at, profiles:profiles(username, image_url), categories:categories(id, name, sort_order), decks_languages(language_id))')
    .eq('user_id', userId);

  if (searchLike) {
    query = query.or(`decks.name.ilike."${searchLike}",decks.to_name.ilike."${searchLike}"`);
  }

  if (categoryList.length > 0) {
    const { data: categoryRows, error: categoryErr } = await supabase
      .from('categories')
      .select('id')
      .in('sort_order', categoryList);
    if (categoryErr) throw categoryErr;
    const categoryIds = (categoryRows || []).map((r) => r.id);
    if (categoryIds.length === 0) return [];
    query = query.in('decks.category_id', categoryIds);
  }

  if (languageList.length > 0) {
    const { data: deckLangRows, error: deckLangErr } = await supabase
      .from('decks_languages')
      .select('deck_id')
      .in('language_id', languageList);
    if (deckLangErr) throw deckLangErr;
    const deckIds = Array.from(new Set((deckLangRows || []).map((r) => r.deck_id)));
    if (deckIds.length === 0) return [];
    query = query.in('deck_id', deckIds);
  }

  query = query.order('created_at', { ascending: false });

  if (typeof limit === 'number' && limit > 0) {
    const from = page * limit;
    query = query.range(from, from + limit - 1);
  }

  const { data, error } = await query;

  if (error) throw error;

  // favorited_at: favorite_decks.created_at (favori eklenme zamanı; tabloda sütun yok, sadece objede kullanılıyor)
  let decks = (data || []).map(item => ({
    ...item.decks,
    is_favorite: true,
    favorited_at: item.created_at
  }));

  if (userId) {
    const [blockedIds, hiddenIds] = await getCachedBlockedAndHidden(userId);
    decks = filterDecksByBlockAndHide(decks, blockedIds, hiddenIds);
  }

  if (sortBy === 'az') {
    decks = [...decks].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortBy === 'popularity') {
    decks = [...decks].sort((a, b) => {
      const scoreA = a.popularity_score || 0;
      const scoreB = b.popularity_score || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.favorited_at || b.created_at || 0).getTime() - new Date(a.favorited_at || a.created_at || 0).getTime();
    });
  }

  if (decks.length > 0) {
    await cacheData(cacheKey, decks);
  }

  return decks;
};

const buildIlikePatternFav = (searchQuery) => {
  if (!searchQuery || typeof searchQuery !== 'string') return null;
  const inner = searchQuery
    .trim()
    .replace(/%/g, '')
    .replace(/_/g, '')
    .replace(/\\/g, '')
    .replace(/,/g, ' ')
    .replace(/"/g, '');
  if (!inner) return null;
  return `%${inner}%`;
};

const applyCardsTableTextOrIlike = (query, likePattern) => {
  if (!likePattern) return query;
  const escaped = likePattern.replace(/"/g, '');
  return query.or(`question.ilike."${escaped}",answer.ilike."${escaped}"`);
};

const applyFavoriteEmbedTextOrIlike = (query, likePattern) => {
  if (!likePattern) return query;
  const escaped = likePattern.replace(/"/g, '');
  return query.or(`cards.question.ilike."${escaped}",cards.answer.ilike."${escaped}"`);
};

// Favori Kartları Getir (sayfalı, cache destekli). Sıra: en son favorilenen en üstte (favorite_cards.created_at desc).
// filter: 'learned' | 'unlearned' | null - Tüm favori kartlar üzerinde sunucu tarafı filtre
// sortBy: 'original' | 'az'
// searchQuery: soru/cevap ilike (tüm favori kümesi)
export const getFavoriteCards = async (userId, page = 0, pageSize = FAVORITE_CARDS_PAGE_SIZE, forceRefresh = false, sortBy = 'original', filter = null, searchQuery = null) => {
  const searchNorm = searchQuery && String(searchQuery).trim() ? String(searchQuery).trim() : '';
  const searchKeyPart = searchNorm ? `_q_${encodeURIComponent(searchNorm).slice(0, 80)}` : '';
  const cacheKey = `fav_cards_${userId}_p${page}_${sortBy}_${filter || 'all'}${searchKeyPart}`;
  if (!forceRefresh) {
    const cached = await getCachedData(cacheKey, CACHE_DURATIONS.FAVORITES_CARDS_CONTENT);
    if (cached && !cached.isStale) return cached.data;
  }
  const from = page * pageSize;
  const likePattern = buildIlikePatternFav(searchNorm);

  let result = [];

  if (sortBy === 'az') {
    let favIds = await getFavoriteCardIds(userId, forceRefresh);
    if (filter === 'learned' || filter === 'unlearned') {
      const { data: learnedRows } = await supabase
        .from('user_card_progress')
        .select('card_id')
        .eq('user_id', userId)
        .eq('status', 'learned');
      const learnedSet = new Set((learnedRows || []).map((r) => r.card_id));
      if (filter === 'learned') {
        favIds = favIds.filter((id) => learnedSet.has(id));
      } else {
        favIds = favIds.filter((id) => !learnedSet.has(id));
      }
    }
    if (favIds.length === 0) return [];
    let cardsQuery = supabase
      .from('cards')
      .select('id, question, answer, created_at, deck:decks(id, name, user_id, categories:categories(id, name, sort_order))')
      .in('id', favIds);
    cardsQuery = applyCardsTableTextOrIlike(cardsQuery, likePattern);
    const { data: cardsData, error } = await cardsQuery
      .order('question', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const cards = cardsData || [];
    if (cards.length === 0) return [];
    const cardIds = cards.map((c) => c.id);
    const { data: favRows } = await supabase
      .from('favorite_cards')
      .select('card_id, created_at')
      .eq('user_id', userId)
      .in('card_id', cardIds);
    const favoritedAtMap = {};
    (favRows || []).forEach((row) => { favoritedAtMap[row.card_id] = row.created_at; });
    result = cards.map((c) => ({ ...c, favorited_at: favoritedAtMap[c.id] || c.created_at }));
  } else if (filter === 'learned' || filter === 'unlearned') {
    const { data: learnedRows } = await supabase
      .from('user_card_progress')
      .select('card_id')
      .eq('user_id', userId)
      .eq('status', 'learned');
    const learnedIds = (learnedRows || []).map((r) => r.card_id);

    let query = supabase
      .from('favorite_cards')
      .select(`
        card_id,
        created_at,
        cards(
          id, question, answer, created_at,
          deck:decks(
            id, name, user_id,
            categories:categories(id, name, sort_order)
          )
        )
      `)
      .eq('user_id', userId);

    if (filter === 'learned' && learnedIds.length > 0) {
      query = query.in('card_id', learnedIds);
    } else if (filter === 'learned' && learnedIds.length === 0) {
      return [];
    } else if (filter === 'unlearned' && learnedIds.length > 0) {
      query = query.not('card_id', 'in', `(${learnedIds.map((id) => `"${id}"`).join(',')})`);
    }

    query = applyFavoriteEmbedTextOrIlike(query, likePattern);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    result = (data || []).map((item) => ({ ...item.cards, favorited_at: item.created_at }));
  } else {
    let query = supabase
      .from('favorite_cards')
      .select(`
        card_id,
        created_at,
        cards(
          id, question, answer, created_at,
          deck:decks(
            id, name, user_id,
            categories:categories(id, name, sort_order)
          )
        )
      `)
      .eq('user_id', userId);
    query = applyFavoriteEmbedTextOrIlike(query, likePattern);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    result = (data || []).map((item) => ({ ...item.cards, favorited_at: item.created_at }));
  }

  if (userId) {
    result = await filterReportedFavoriteCardsForUser(result, userId);
  }

  if (result.length > 0) await cacheData(cacheKey, result);
  return result;
};

// Favori Kart Ekle
export const addFavoriteCard = async (userId, cardId) => {
  const { error } = await supabase.from('favorite_cards').insert({ user_id: userId, card_id: cardId });
  if (error) throw error;
  await invalidateCache(`fav_card_ids_${userId}`);
  await invalidateCache(`fav_cards_${userId}`);
};

// Favori Kart Çıkar
export const removeFavoriteCard = async (userId, cardId) => {
  const { error } = await supabase.from('favorite_cards').delete().eq('user_id', userId).eq('card_id', cardId);
  if (error) throw error;
  await invalidateCache(`fav_card_ids_${userId}`);
  await invalidateCache(`fav_cards_${userId}`);
};

// Favori Deste Ekle
export const addFavoriteDeck = async (userId, deckId) => {
  const { error } = await supabase.from('favorite_decks').insert({ user_id: userId, deck_id: deckId });
  if (error) throw error;
  await invalidateCache(`fav_deck_ids_${userId}`);
  await invalidateCache(`fav_decks_${userId}`);
};

// Favori Deste Çıkar
export const removeFavoriteDeck = async (userId, deckId) => {
  const { error } = await supabase.from('favorite_decks').delete().eq('user_id', userId).eq('deck_id', deckId);
  if (error) throw error;
  await invalidateCache(`fav_deck_ids_${userId}`);
  await invalidateCache(`fav_decks_${userId}`);
};

// Kullanıcının favori deck ID listesini getir (4 saat cache)
export const getFavoriteDeckIds = async (userId, forceRefresh = false) => {
  if (!userId) return [];
  if (!forceRefresh) {
    const cached = await getCachedData(`fav_deck_ids_${userId}`, CACHE_DURATIONS.FAVORITES_DECK_IDS);
    if (cached && !cached.isStale) return cached.data;
  }
  const { data, error } = await supabase
    .from('favorite_decks')
    .select('deck_id')
    .eq('user_id', userId);
  if (error) throw error;
  const ids = (data || []).map(f => f.deck_id);
  await cacheData(`fav_deck_ids_${userId}`, ids);
  return ids;
};

// Kullanıcının tüm favori card ID listesini getir (4 saat cache)
export const getFavoriteCardIds = async (userId, forceRefresh = false) => {
  if (!userId) return [];
  if (!forceRefresh) {
    const cached = await getCachedData(`fav_card_ids_${userId}`, CACHE_DURATIONS.FAVORITES_CARD_IDS);
    if (cached && !cached.isStale) return cached.data;
  }
  const { data, error } = await supabase
    .from('favorite_cards')
    .select('card_id')
    .eq('user_id', userId);
  if (error) throw error;
  const ids = (data || []).map(f => f.card_id);
  await cacheData(`fav_card_ids_${userId}`, ids);
  return ids;
};

// Belirli kartlar için favori durumlarını getir (chunk destekli)
export const getFavoriteCardIdsForCards = async (userId, cardIds) => {
  if (!userId || !cardIds || cardIds.length === 0) return new Set();
  const CHUNK_SIZE = 200;
  const favoriteIds = new Set();
  for (let i = 0; i < cardIds.length; i += CHUNK_SIZE) {
    const chunk = cardIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('favorite_cards')
      .select('card_id')
      .eq('user_id', userId)
      .in('card_id', chunk);
    if (error) throw error;
    (data || []).forEach(f => favoriteIds.add(f.card_id));
  }
  return favoriteIds;
};