import { supabase } from '../lib/supabase';
import { listDecksRpc } from './DeckService';
import { cachedQuery, invalidateCache, patchCachedQueries } from './CacheService';
import { STALE } from '../lib/queryClient';

const FAVORITE_CARDS_PAGE_SIZE = 50;


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

  const search = String(searchQuery || '').trim();
  const categoryList = Array.isArray(categorySortOrders) ? categorySortOrders : [];
  const languageList = Array.isArray(languageIds) ? languageIds : [];
  // Only the plain first page is cached (v3: rows come from list_decks).
  const cacheable = page === 0 && !search && sortBy !== 'az' && !categoryList.length && !languageList.length;
  const cacheKey = `fav_decks_${userId}_v3_first_${limit || 'all'}`;
  const fetchDecks = () => listDecksRpc({
    category: 'favorites',
    searchQuery: search,
    sortBy,
    categorySortOrders: categoryList,
    languageIds: languageList,
    offset: typeof limit === 'number' && limit > 0 ? page * limit : 0,
    limit: typeof limit === 'number' && limit > 0 ? limit : null,
  });
  if (!cacheable) return fetchDecks();
  return cachedQuery(cacheKey, fetchDecks, { staleTime: STALE.OWN, force: forceRefresh });
};

// Favori kartlar (sayfalı). Sıra: en son favorilenen en üstte; sortBy 'az' soruya göre.
// filter: 'learned' | 'unlearned' | null, searchQuery: soru/cevap (Türkçe harf eşitlemeli).
// Hepsi list_favorite_cards RPC'sinde, sayfalamadan önce uygulanır.
// Sadece filtresiz / aramasız ilk sayfa önbelleğe alınır.
export const getFavoriteCards = async (userId, page = 0, pageSize = FAVORITE_CARDS_PAGE_SIZE, forceRefresh = false, sortBy = 'original', filter = null, searchQuery = null) => {
  const search = searchQuery && String(searchQuery).trim() ? String(searchQuery).trim() : null;
  const cacheable = page === 0 && !filter && !search && sortBy !== 'az';
  const cacheKey = `fav_cards_${userId}_v3_first_${pageSize}`;
  const fetchCards = async () => {
  const { data, error } = await supabase.rpc('list_favorite_cards', {
    p_filter: filter === 'learned' || filter === 'unlearned' ? filter : null,
    p_search: search,
    p_sort: sortBy === 'az' ? 'az' : 'original',
    p_offset: page * pageSize,
    p_limit: pageSize,
  });
  if (error) throw error;
  const result = (data || []).map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    created_at: row.created_at,
    image: row.image,
    status: row.status,
    favorited_at: row.favorited_at,
    deck: {
      id: row.deck_id,
      name: row.deck_name,
      to_name: row.deck_to_name,
      user_id: row.deck_user_id,
      categories: row.category_id
        ? { id: row.category_id, name: row.category_name, sort_order: row.category_sort_order }
        : null,
    },
  }));
  return result;
  };
  if (!cacheable) return fetchCards();
  return cachedQuery(cacheKey, fetchCards, { staleTime: STALE.OWN, force: forceRefresh });
};

// Cached deck card pages carry is_favorite: set it on the one card instead of
// dropping the pages, so re-opening the list needs no request and no reload.
const setCardFavoriteInCachedPages = (cardId, isFavorite) => patchCachedQueries('cards_deck_', (rows) => (
  Array.isArray(rows) ? rows.map((row) => (row?.id === cardId ? { ...row, is_favorite: isFavorite } : row)) : rows
));

// Favori Kart Ekle
export const addFavoriteCard = async (userId, cardId) => {
  const { error } = await supabase.from('favorite_cards').insert({ user_id: userId, card_id: cardId });
  if (error) throw error;
  await invalidateCache(`fav_card_ids_${userId}`);
  await invalidateCache(`fav_cards_${userId}`);
  setCardFavoriteInCachedPages(cardId, true);
};

// Favori Kart Çıkar
export const removeFavoriteCard = async (userId, cardId) => {
  const { error } = await supabase.from('favorite_cards').delete().eq('user_id', userId).eq('card_id', cardId);
  if (error) throw error;
  await invalidateCache(`fav_card_ids_${userId}`);
  await invalidateCache(`fav_cards_${userId}`);
  setCardFavoriteInCachedPages(cardId, false);
};

// Favori Deste Ekle
export const addFavoriteDeck = async (userId, deckId) => {
  const { error } = await supabase.from('favorite_decks').upsert({ user_id: userId, deck_id: deckId }, { onConflict: 'user_id, deck_id', ignoreDuplicates: true });
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
  return cachedQuery(`fav_deck_ids_${userId}`, async () => {
    const { data, error } = await supabase
      .from('favorite_decks')
      .select('deck_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(f => f.deck_id);
  }, { staleTime: STALE.OWN, force: forceRefresh });
};

// Kullanıcının tüm favori card ID listesini getir (4 saat cache)
export const getFavoriteCardIds = async (userId, forceRefresh = false) => {
  if (!userId) return [];
  return cachedQuery(`fav_card_ids_${userId}`, async () => {
    const { data, error } = await supabase
      .from('favorite_cards')
      .select('card_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(f => f.card_id);
  }, { staleTime: STALE.OWN, force: forceRefresh });
};

