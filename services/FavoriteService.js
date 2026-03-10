import { supabase } from '../lib/supabase';
import { getCachedBlockedAndHidden, filterDecksByBlockAndHide } from './BlockService';
import { cacheData, getCachedData, invalidateCache, CACHE_DURATIONS } from './CacheService';

const FAVORITE_CARDS_PAGE_SIZE = 50;

// Favori Desteleri Getir (ilişkili deck verisiyle birlikte). Engel/gizle filtresi uygulanır.
// Sıra: en son favorilenen en üstte (favorite_decks.created_at desc).
// options: { page?: number, limit?: number } - limit verilirse Supabase range ile sayfalama yapılır.
export const getFavoriteDecks = async (userId, options = {}) => {
  const { page = 0, limit } = options || {};

  let query = supabase
    .from('favorite_decks')
    .select('deck_id, created_at, decks(id, name, description, card_count, user_id, category_id, is_shared, is_admin_created, updated_at, created_at, profiles:profiles(username, image_url), categories:categories(id, name, sort_order), decks_languages(language_id))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

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

  return decks;
};

// Favori Kartları Getir (sayfalı, cache destekli). Sıra: en son favorilenen en üstte (favorite_cards.created_at desc).
export const getFavoriteCards = async (userId, page = 0, pageSize = FAVORITE_CARDS_PAGE_SIZE, forceRefresh = false) => {
  const cacheKey = `fav_cards_${userId}_p${page}`;
  if (!forceRefresh) {
    const cached = await getCachedData(cacheKey, CACHE_DURATIONS.FAVORITES_CARDS_CONTENT);
    if (cached && !cached.isStale) return cached.data;
  }
  const from = page * pageSize;
  const { data, error } = await supabase
    .from('favorite_cards')
    .select(`
      card_id,
      created_at,
      cards(
        id, question, answer, created_at,
        deck:decks(
          id, 
          name,
          user_id,
          categories:categories(id, name, sort_order)
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  const result = (data || []).map(item => ({ ...item.cards, favorited_at: item.created_at }));
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
};

// Favori Deste Çıkar
export const removeFavoriteDeck = async (userId, deckId) => {
  const { error } = await supabase.from('favorite_decks').delete().eq('user_id', userId).eq('deck_id', deckId);
  if (error) throw error;
  await invalidateCache(`fav_deck_ids_${userId}`);
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