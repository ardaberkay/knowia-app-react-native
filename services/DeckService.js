import { supabase } from '../lib/supabase';
import { getCachedBlockedAndHidden } from './BlockService';
import { invalidateCache, cachedQuery } from './CacheService';
import { STALE } from '../lib/queryClient';
import { getFavoriteDeckIds } from './FavoriteService';
import { removeUnusedCardImages } from './StorageService';

const DECK_LIST_SELECT = 'id, name, to_name, description, card_count, user_id, category_id, is_shared, is_admin_created, shared_at, updated_at, created_at, profiles:profiles(username, image_url), categories:categories(id, name, sort_order), decks_languages(language_id), chapters:chapters(count)';

// Oluşturma/güncelleme sonrası dönüş için kullanılan select (tekil deck).
const DECK_SELECT_SINGLE = 'id, name, to_name, description, card_count, user_id, category_id, is_shared, is_admin_created, shared_at, updated_at, created_at, profiles:profiles(username, image_url), categories:categories(id, name, sort_order)';

// decks_languages.side: 'front' | 'back' | null. The order of a languageIds
// array is the side: [front, back]. A single language reads on both sides;
// null = legacy row or filter-only language (not used for speech).
const SIDE_ORDER = { front: 0, back: 1 };
const sideRank = (side) => (side in SIDE_ORDER ? SIDE_ORDER[side] : 2);

/**
 * One page of decks from the list_decks RPC. Block/hide, category, language,
 * favourites-only, search (Türkçe harf eşitlemeli) and A–Z all run in SQL
 * before paging, so pages are complete and A–Z sorts the whole list.
 * Rows come back in the same shape as DECK_LIST_SELECT (+ chapter_count,
 * is_favorite, favorited_at).
 */
export const listDecksRpc = async ({ category, searchQuery = '', sortBy = 'default', categorySortOrders = [], languageIds = [], favoritesOnly = false, offset = 0, limit = null }) => {
  const pageLimit = typeof limit === 'number' && limit > 0 ? limit : null;
  const { data, error } = await supabase.rpc('list_decks', {
    p_category: category,
    p_search: searchQuery && String(searchQuery).trim() ? String(searchQuery).trim() : null,
    p_sort: sortBy === 'az' ? 'az' : 'default',
    p_category_sort_orders: categorySortOrders?.length ? categorySortOrders : null,
    p_language_ids: languageIds?.length ? languageIds : null,
    p_favorites_only: !!favoritesOnly,
    p_offset: offset || 0,
    p_limit: pageLimit,
  });
  if (error) throw error;
  return data || [];
};

export const getDecksByCategory = async (userId, category, options = false) => {
  // options hem eski boolean forceRefresh çağrılarını hem de yeni { forceRefresh, page, limit } yapısını destekler
  let forceRefresh = false;
  let page = 0;
  let limit;
  let includeHasMore = false;
  let searchQuery = '';
  let sortBy = 'default';
  let categorySortOrders = [];
  let languageIds = [];
  let favoritesOnly = false;

  if (typeof options === 'boolean') {
    forceRefresh = options;
  } else if (options && typeof options === 'object') {
    forceRefresh = options.forceRefresh ?? false;
    page = options.page ?? 0;
    limit = options.limit;
    includeHasMore = Boolean(options.includeHasMore);
    searchQuery = (options.searchQuery || '').trim();
    sortBy = options.sortBy || 'default';
    categorySortOrders = Array.isArray(options.categorySortOrders) ? options.categorySortOrders : [];
    languageIds = Array.isArray(options.languageIds) ? options.languageIds : [];
    favoritesOnly = Boolean(options.favoritesOnly);
  }

  // "Destelerim" is cached by TanStack Query in LibraryScreen (RAM + the plain
  // first page on disk), so no AsyncStorage copy here.

  if (category === 'inProgressDecks') {
    if (!userId) return includeHasMore ? { decks: [], hasMore: false, totalCount: 0 } : [];
    const pageLimit = typeof limit === 'number' && limit > 0 ? limit : null;
    const { data, error } = await supabase.rpc('list_in_progress_decks', {
      p_search: searchQuery || null,
      p_sort: sortBy === 'az' ? 'az' : 'default',
      p_category_sort_orders: categorySortOrders.length ? categorySortOrders : null,
      p_language_ids: languageIds.length ? languageIds : null,
      p_favorites_only: favoritesOnly,
      p_offset: pageLimit ? page * pageLimit : 0,
      p_limit: pageLimit ? (includeHasMore ? pageLimit + 1 : pageLimit) : null,
    });
    if (error) throw error;
    let rows = data || [];
    const totalCount = Number(rows[0]?.total_count || 0);
    let hasMore = false;
    if (includeHasMore && pageLimit) {
      hasMore = rows.length > pageLimit;
      rows = rows.slice(0, pageLimit);
    }
    const decks = rows.map(({ learned_count: learnedCount, learning_count: learningCount, progress_total: progressTotal, total_count: _total, ...deck }) => {
      // progress_total = cards without the reported ones (same as DeckDetail)
      const total = Number(progressTotal ?? deck.card_count ?? 0);
      const learned = Math.min(Number(learnedCount || 0), total);
      // learning_count comes from 20261128140000; without it only learned is known
      const learning = learningCount == null ? null : Math.min(Number(learningCount), total - learned);
      return {
        ...deck,
        deckProgress: {
          total,
          learned,
          learning,
          remaining: Math.max(total - learned, 0),
          progress: total > 0 ? learned / total : 0,
        },
      };
    });
    return includeHasMore ? { decks, hasMore, totalCount } : decks;
  }

  // myDecks / defaultDecks / communityDecks → list_decks RPC
  const pageLimit = typeof limit === 'number' && limit > 0 ? limit : null;
  const rows = await listDecksRpc({
    category,
    searchQuery,
    sortBy,
    categorySortOrders,
    languageIds,
    favoritesOnly,
    offset: pageLimit ? page * pageLimit : 0,
    // one extra row tells whether another page exists
    limit: pageLimit ? (includeHasMore ? pageLimit + 1 : pageLimit) : null,
  });
  let resultData = rows;
  let hasMore = false;
  if (includeHasMore && pageLimit) {
    hasMore = resultData.length > pageLimit;
    resultData = resultData.slice(0, pageLimit);
  }

  return includeHasMore ? { decks: resultData, hasMore } : resultData;
};

// Kullanıcı bir destede çalışmaya başladığında is_started alanını true yapar
export const setDeckStarted = async (userId, deckId) => {
  const { error } = await supabase
    .from('decks')
    .update({ is_started: true })
    .eq('id', deckId)
    .eq('user_id', userId);
  if (error) throw error;
};

/**
 * Tekil deste detayını döndürür. 4 saat cache (mutation: düzenleme/silme/paylaşımda invalidate).
 */
export const getDeckById = async (deckId, forceRefresh = false) => cachedQuery(`deck_detail_${deckId}`, async () => {
  const { data, error } = await supabase
    .from('decks')
    .select(DECK_LIST_SELECT)
    .eq('id', deckId)
    .single();
  if (error) throw error;
  return data;
}, { staleTime: STALE.SHARED, force: forceRefresh });

export const deleteDeck = async (deckId) => {
  try {
    // 1. Desteye ait kartların sadece 'image' sütununu çekiyoruz.
    // .not('image', 'is', null) ile sadece görseli olan kartları getirerek performansı artırıyoruz.
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('image')
      .eq('deck_id', deckId) // 'deck_id' sütun adını kendi veritabanına göre kontrol et
      .not('image', 'is', null);

    if (cardsError) throw cardsError;

    // 4. Desteyi veritabanından siliyoruz (Senin mevcut kodun)
    const { error: deleteError } = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId);

    if (deleteError) throw deleteError;

    // Deste ve kartları silindi: görselleri şimdi sil (başka kartın kullandıkları kalır)
    await removeUnusedCardImages(cards.map((card) => card.image));

    // 5. Önbelleği (Cache) temizliyoruz
    await invalidateCache(`deck_detail_${deckId}`);
    await invalidateCache(`cards_deck_${deckId}`);
    await invalidateCache('mydecks_');

  } catch (error) {
    console.error("Deste silme işlemi başarısız:", error);
    throw error;
  }
};

export const updateDeckShare = async (deckId, userId, isShared) => {
  const { error } = await supabase
    .from('decks')
    .update({ is_shared: isShared, updated_at: new Date().toISOString() })
    .eq('id', deckId)
    .eq('user_id', userId);
  if (error) throw error;
  await invalidateCache(`deck_detail_${deckId}`);
  await invalidateCache(`mydecks_${userId}`);
};

export const insertDeckStats = async (deckId, userId) => {
  const { error } = await supabase
    .from('decks_stats')
    .insert({
      deck_id: deckId,
      user_id: userId,
      started_at: new Date().toISOString(),
    });
  if (error) throw error;
  // the deck now belongs to "Çalıştığım Desteler"
  await invalidateCache(`progress_deck_${deckId}_${userId}`);
};

/**
 * Yeni deste oluşturur (save_deck RPC: deste + diller tek transaction, B12).
 * @param {string} userId - Oluşturan kullanıcı id
 * @param {Object} payload - name, to_name?, description?, category_id, languageIds (uuid[])
 * @returns {Promise<Object>} Oluşturulan deck (profiles, categories ile)
 */
const saveDeckRpc = async (deckId, payload) => {
  const { name, to_name, description, category_id, languageIds = [] } = payload;
  const { data, error } = await supabase.rpc('save_deck', {
    p_deck_id: deckId || null,
    p_name: (name || '').trim(),
    p_to_name: (to_name || '').trim() || null,
    p_description: (description || '').trim() || null,
    p_category_id: category_id || null,
    p_language_ids: languageIds.length ? languageIds.slice(0, 2) : null,
  });
  if (error) throw error;
  return data;
};

export const createDeck = async (userId, payload) => {
  const deckId = await saveDeckRpc(null, payload);
  const { data, error } = await supabase
    .from('decks')
    .select(DECK_SELECT_SINGLE)
    .eq('id', deckId)
    .single();
  if (error) throw error;
  await invalidateCache(`mydecks_${userId}`);
  return data;
};

/**
 * Deste bilgilerini ve dillerini günceller (save_deck RPC: tek transaction, B12).
 * @param {string} deckId - Deste id
 * @param {string} userId - Deste sahibi kullanıcı id (yetki/cache için)
 * @param {Object} payload - name, to_name?, description?, category_id, languageIds (uuid[])
 */
export const updateDeck = async (deckId, userId, payload) => {
  await saveDeckRpc(deckId, payload);
  await invalidateCache(`deck_detail_${deckId}`);
  await invalidateCache(`mydecks_${userId}`);
};

/**
 * Bir desteye ait dil id listesini döndürür (decks_languages tablosundan).
 * @param {string} deckId - Deste id
 * @returns {Promise<string[]>} language_id listesi
 */
export const getDeckLanguages = async (deckId) => {
  const { data, error } = await supabase
    .from('decks_languages')
    .select('language_id, side')
    .eq('deck_id', deckId);
  if (error) throw error;
  // Front first, then back, then side-less rows: callers treat the order as
  // [front, back] (e.g. the edit screen's language picker).
  return (data || [])
    .slice()
    .sort((a, b) => sideRank(a.side) - sideRank(b.side))
    .map((row) => row.language_id);
};

/**
 * Speech languages of a deck's two card faces, as lowercase codes ('en').
 *
 * - front: the 'front' row. Legacy decks with no side info fall back to the
 *   first language that isn't the app language (language decks are usually
 *   "foreign word → its meaning"), else the first one.
 * - back: the 'back' row, else the front language.
 * Both are null when the deck has no languages (caller uses the app language).
 *
 * @param {string} deckId
 * @param {string} [appLanguage] - current UI language code, for the legacy fallback
 * @returns {Promise<{ front: string|null, back: string|null }>}
 */
export const getDeckSpeechLanguages = async (deckId, appLanguage) => {
  const { data, error } = await supabase
    .from('decks_languages')
    .select('side, languages(language_code)')
    .eq('deck_id', deckId);
  if (error) throw error;

  const rows = (data || [])
    .map((row) => ({ side: row.side, code: row.languages?.language_code?.toLowerCase() || null }))
    .filter((row) => row.code);
  if (rows.length === 0) return { front: null, back: null };

  let front = rows.find((row) => row.side === 'front')?.code || null;
  let back = rows.find((row) => row.side === 'back')?.code || null;

  if (!front && !rows.some((row) => row.side)) {
    const app = (appLanguage || '').toLowerCase().slice(0, 2);
    const foreign = rows.find((row) => row.code !== app);
    front = (foreign || rows[0]).code;
    const other = rows.find((row) => row.code !== front);
    back = other ? other.code : null;
  }

  front = front || rows[0].code;
  return { front, back: back || front };
};

const TAB_TO_SORT_BY = {
  trend: 'popular',
  favorites: 'favorites',
  starts: 'starts',
  unique: 'unique_starts',
  new: 'new',
};

const transformRpcDeck = (d) => ({
  id: d.id,
  name: d.name,
  to_name: d.to_name,
  description: d.description,
  card_count: d.card_count,
  user_id: d.user_id,
  category_id: d.category_id,
  is_shared: d.is_shared,
  is_admin_created: d.is_admin_created,
  created_at: d.created_at,
  updated_at: d.updated_at,
  profiles: { username: d.profile_username, image_url: d.profile_image_url },
  categories: { id: d.category_id, name: d.category_name, sort_order: d.category_sort_order },
  decks_languages: (d.language_ids || []).map(id => ({ language_id: id })),
  popularity_score: d.popularity_score,
  favorite_count: d.favorite_count,
  unique_started_count: d.unique_started_count,
});

export const getDiscoverDecks = async (userId, tab = 'trend', timeFilter = 'all', limit = 50, forceRefresh = false) => {
  const sortBy = TAB_TO_SORT_BY[tab] || 'popular';
  // v3: key carries the user (the list leaves out decks of users they blocked / decks they hid).
  const decks = await cachedQuery(`discover_v3_${userId}_${tab}_${timeFilter}_${limit}`, async () => {
    const [blockedIds, hiddenIds] = await getCachedBlockedAndHidden(userId);
    const { data, error } = await supabase.rpc('get_discover_decks', {
      p_sort_by: sortBy,
      p_time_filter: timeFilter,
      p_limit: limit,
      p_excluded_user_ids: Array.from(blockedIds),
      p_excluded_deck_ids: Array.from(hiddenIds),
    });
    if (error) throw error;
    return (data || []).map(transformRpcDeck);
  // only the 'all time' lists go to disk; the time-filtered ones stay in RAM
  }, { staleTime: STALE.SHARED, force: forceRefresh, persist: timeFilter === 'all' });

  const favIds = new Set(await getFavoriteDeckIds(userId));
  return (decks || []).map(d => ({ ...d, is_favorite: favIds.has(d.id) }));
};
/**
 * Counts for the Library hero summary line. The lists themselves are paged
 * (favourite cards 20 at a time), so counting loaded rows would be wrong:
 * favourites use head-only count requests (no rows), and own decks read only
 * the card_count column to sum the cards.
 */
export const getLibrarySummary = async (userId) => {
  if (!userId) return null;
  const [mine, favDecks, favCards] = await Promise.all([
    supabase.from('decks').select('card_count').eq('user_id', userId).eq('is_admin_created', false),
    supabase.from('favorite_decks').select('deck_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('favorite_cards').select('card_id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  if (mine.error || favDecks.error || favCards.error) return null;
  const rows = mine.data || [];
  return {
    myDecks: rows.length,
    myCards: rows.reduce((sum, d) => sum + Number(d.card_count || 0), 0),
    favoriteDecks: favDecks.count || 0,
    favoriteCards: favCards.count || 0,
  };
};
