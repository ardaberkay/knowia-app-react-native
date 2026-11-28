import { supabase } from '../lib/supabase';
import { invalidateCache, cachedQuery, peekCachedQuery } from './CacheService';
import { STALE } from '../lib/queryClient';
import { removeUnusedCardImages } from './StorageService';

const PAGE_SIZE = 50;

// Same text rule as the server's norm_search: trim, İ/I/ı → i, lower case.
export const normSearchText = (text) => String(text ?? '').trim().replace(/[İIı]/g, 'i').toLowerCase();

/**
 * Instant search feedback: while the server answer for a new search is on its
 * way, the cards already on screen are filtered with the same rule, so the
 * list reacts to every key press. The server answer then replaces it.
 * fetchedQuery = the search the current cards were loaded for.
 */
export const filterCardsWhileSearching = (cards, query, fetchedQuery) => {
  const q = normSearchText(query);
  if (!q || q === normSearchText(fetchedQuery)) return cards;
  return cards.filter((card) => normSearchText(`${card.question || ''} ${card.answer || ''}`).includes(q));
};

const filterReportedCardsForUser = async (cards, userId) => {
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

const filterReportedLearningRowsForUser = async (rows, userId) => {
  if (!userId || !rows || rows.length === 0) return rows;

  const cardIds = rows.map((r) => r.card_id);
  const { data: reports, error } = await supabase
    .from('reports')
    .select('target_id')
    .eq('reporter_id', userId)
    .eq('report_type', 'card')
    .in('target_id', cardIds);

  if (error) throw error;

  const hiddenIds = new Set((reports || []).map((r) => r.target_id));
  if (hiddenIds.size === 0) return rows;

  return rows.filter((r) => !hiddenIds.has(r.card_id));
};



/**
 * One page of a deck's (or a chapter's) cards from the list_cards RPC. Reported
 * cards, the learned / unlearned / fav filter and the search run in SQL before
 * paging, so pages are always full and never mix (B5, B7, 3.3).
 * Search ignores case and treats İ/I/ı/i alike (norm_search).
 * Only the plain first page (no search, no filter, default sort) is cached.
 */
const listCardsRpc = async ({ deckId, scope = 'deck', chapterId = null, filter = null, searchQuery = null, sortBy = 'original', page = 0, pageSize = PAGE_SIZE }) => {
  const { data, error } = await supabase.rpc('list_cards', {
    p_deck_id: deckId,
    p_scope: scope,
    p_chapter_id: chapterId,
    p_filter: filter || null,
    p_search: searchQuery && String(searchQuery).trim() ? String(searchQuery).trim() : null,
    p_sort: sortBy === 'az' ? 'az' : 'original',
    p_offset: page * pageSize,
    p_limit: pageSize,
  });
  if (error) throw error;
  return data || [];
};

const cardsByDeckFirstPageKey = (deckId, userId) => `cards_deck_${deckId}_${userId}_first`;

/** Last loaded plain first page of a deck's cards (even if stale), or null. No request. */
export const peekCardsByDeck = (deckId, userId) => (userId ? peekCachedQuery(cardsByDeckFirstPageKey(deckId, userId)) : null);

export const getCardsByDeck = async (deckId, page = 0, pageSize = PAGE_SIZE, sortBy = 'original', forceRefresh = false, userId = null, filter = null, searchQuery = null) => {
  const hasSearch = !!(searchQuery && String(searchQuery).trim());
  const cacheable = page === 0 && !filter && !hasSearch && sortBy !== 'az' && !!userId;
  const cacheKey = cardsByDeckFirstPageKey(deckId, userId);
  const fetchPage = () => listCardsRpc({ deckId, scope: 'deck', filter, searchQuery, sortBy, page, pageSize });
  if (!cacheable) return fetchPage();
  // RAM only: card lists can be large, they don't go to disk.
  return cachedQuery(cacheKey, fetchPage, { staleTime: STALE.SHARED, force: forceRefresh, persist: false });
};

/**
 * Bir destedeki tüm kartları (liste + detay alanlarıyla) döndürür.
 * DeckDetailScreen gibi ekranlarda tek seferde tüm kartları göstermek için kullanılır.
 * @param {string} deckId - Deste id
 * @returns {Promise<Array>} Kart listesi (id, question, answer, image, example, note, created_at)
 */
export const getAllCardsForDeck = async (deckId, userId = null) => {
  const { data, error } = await supabase
    .from('cards')
    .select('id, question, answer, image, example, note, created_at')
    .eq('deck_id', deckId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const cards = data || [];
  if (!userId) return cards;
  return filterReportedCardsForUser(cards, userId);
};

/**
 * Belirtilen kartların chapter_id değerini günceller (bölüme taşıma).
 * @param {string[]} cardIds - Güncellenecek kart id'leri
 * @param {string|null} targetChapterId - Hedef bölüm id (null = atanmamış)
 */
export const updateCardsChapter = async (cardIds, targetChapterId, deckId = null, userId = null) => {
  if (!cardIds || cardIds.length === 0) return;
  const { error } = await supabase
    .from('cards')
    .update({ chapter_id: targetChapterId || null })
    .in('id', cardIds);
  if (error) throw error;
  if (deckId) await invalidateCache(`cards_deck_${deckId}`);
  if (deckId) await invalidateCache(`progress_deck_${deckId}_`);
  if (deckId && userId) await invalidateCache(`progress_chapters_${deckId}_${userId}`);
};

// filter: null | 'learned' | 'unlearned' | 'fav', sortBy: 'original' | 'az'
export const getCardsByChapter = async (deckId, chapterId, page = 0, pageSize = PAGE_SIZE, userId = null, searchQuery = null, { filter = null, sortBy = 'original' } = {}) => {
  return listCardsRpc({
    deckId,
    scope: chapterId ? 'chapter' : 'unassigned',
    chapterId: chapterId || null,
    filter,
    searchQuery,
    sortBy,
    page,
    pageSize,
  });
};

/**
 * Total / learned / learning counts of a deck, a chapter or the unassigned
 * cards in one RPC (card_progress_counts). Reported cards are left out in SQL
 * (B7: no long NOT IN list, no separate reports request).
 */
const progressCountsRpc = async (deckId, scope, chapterId = null) => {
  const { data, error } = await supabase.rpc('card_progress_counts', {
    p_deck_id: deckId,
    p_scope: scope,
    p_chapter_id: chapterId,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) || {};
  const total = Number(row.total || 0);
  const learned = Number(row.learned || 0);
  const learning = Number(row.learning || 0);
  return { total, learned, learning, new: total - learned - learning };
};

export const getChapterProgressCounts = async (userId, deckId, chapterId) => {
  // chapterId anlamları:
  // - undefined  -> Tüm kartlar (chapter filtresi yok)
  // - null       -> Sadece atanmamış kartlar (chapter_id IS NULL)
  // - string/id  -> Belirli bölüm (chapter_id = chapterId)
  if (typeof chapterId === 'undefined') return progressCountsRpc(deckId, 'deck');
  if (chapterId === null) return progressCountsRpc(deckId, 'unassigned');
  return progressCountsRpc(deckId, 'chapter', chapterId);
};

export const ensureUserCardProgress = async (_deckId, _userId) => {
  // Artık 'new' status'unda progress satırı oluşturmuyoruz.
  // Öğrenilecek kartlar = progress kaydı olmayan + (status 'learning' ve next_review <= now).
  // Progress kaydı, kullanıcı ilk swipe/skip yaptığında insert ediliyor.
};

export const getCardsForLearning = async (deckId, userId) => {
  const { data, error } = await supabase
    .from('user_card_progress')
    .select('card_id, status, next_review, cards!inner(question, answer, image, example, note)')
    .eq('user_id', userId)
    .neq('status', 'learned')
    .lte('next_review', new Date().toISOString())
    .eq('cards.deck_id', deckId);

  if (error) throw error;
  return data.sort(() => Math.random() - 0.5);
};

export const createCard = async (deckId, cardData) => {
  const { data, error } = await supabase
    .from('cards')
    .insert({
      deck_id: deckId,
      question: cardData.question,
      answer: cardData.answer,
      example: cardData.example || null,
      note: cardData.note || null,
      image: cardData.image || null,
    })
    .select();
  if (error) throw error;
  await invalidateCache(`cards_deck_${deckId}`);
  await invalidateCache(`progress_deck_${deckId}_`);
  return data?.[0] || null;
};

/**
 * Adds many cards in a few requests (CSV import). Rows are sent in batches;
 * a failed batch doesn't stop the others. Returns how many were added and
 * the rows that failed, so the caller can report them and clean up images.
 */
export const importCards = async (deckId, rows, { batchSize = 100, onProgress } = {}) => {
  let inserted = 0;
  const failedRows = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((row) => ({
      deck_id: deckId,
      question: row.question,
      answer: row.answer,
      example: row.example || null,
      note: row.note || null,
      image: row.image || null,
    }));
    const { error } = await supabase.from('cards').insert(batch);
    if (error) {
      if (__DEV__) console.warn('Card batch insert failed:', error.message);
      failedRows.push(...rows.slice(i, i + batchSize));
    } else {
      inserted += batch.length;
    }
    onProgress?.(Math.min(i + batchSize, rows.length));
  }
  if (inserted > 0) {
    await invalidateCache(`cards_deck_${deckId}`);
    await invalidateCache(`progress_deck_${deckId}_`);
    await invalidateCache(`deck_detail_${deckId}`);
  }
  return { inserted, failedRows };
};

export const updateCard = async (cardId, cardData) => {
  try {
    // 1. Önce kartın mevcut (eski) halini veritabanından çekiyoruz.
    // Sadece 'image' sütununu çekmek işlemi hızlandırır.
    const { data: existingCard, error: fetchError } = await supabase
      .from('cards')
      .select('image')
      .eq('id', cardId)
      .single(); // Sadece tek bir satır döneceğini biliyoruz

    if (fetchError) throw fetchError;

    const oldImage = existingCard?.image;
    const newImage = cardData.image || null;

    // 4. Kartı veritabanında güncelliyoruz (Senin mevcut kodun)
    const { data, error: updateError } = await supabase
      .from('cards')
      .update({
        question: cardData.question,
        answer: cardData.answer,
        example: cardData.example || null,
        note: cardData.note || null,
        image: newImage,
      })
      .eq('id', cardId)
      .select();

    if (updateError) throw updateError;

    const card = data?.[0] || null;

    // 5. Kayıt başarılı: görsel değiştiyse veya kaldırıldıysa eski dosyayı sil
    if (oldImage && oldImage !== newImage) {
      await removeUnusedCardImages([oldImage]);
    }

    // 6. Önbelleği (Cache) temizliyoruz
    if (card) {
      await invalidateCache(`card_detail_${cardId}`);
      if (card.deck_id) await invalidateCache(`cards_deck_${card.deck_id}`);
      if (card.deck_id) await invalidateCache(`progress_deck_${card.deck_id}_`);
    }

    return card;

  } catch (error) {
    console.error("Kart güncellenirken hata oluştu:", error);
    throw error;
  }
};

/**
 * Kartı siler. deckId verilirse ilgili deste kart listesi cache'i de temizlenir (mutation invalidation).
 */
export const deleteCard = async (cardId, deckId = null) => {
  // 1. Görsel yolu ve deste: deste id'si buradan alınır, çağıran vermese de
  //    o destenin liste önbelleği temizlenir (B9).
  const { data: card, error: fetchError } = await supabase
    .from('cards')
    .select('image, deck_id')
    .eq('id', cardId)
    .single();

  if (fetchError) throw fetchError;

  // 3. Kartı veritabanından siliyoruz (Senin orijinal kodun)
  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', cardId);

  if (error) throw error;

  // Kayıt silindi: artık hiçbir kartın kullanmadığı görseli sil
  if (card?.image) await removeUnusedCardImages([card.image]);

  // 4. Önbelleği temizliyoruz (Senin orijinal kodun)
  await invalidateCache(`card_detail_${cardId}`);
  const ownerDeckId = deckId || card?.deck_id;
  if (ownerDeckId) await invalidateCache(`cards_deck_${ownerDeckId}`);
  if (ownerDeckId) await invalidateCache(`progress_deck_${ownerDeckId}_`);
  await invalidateCache('fav_cards_');
};

export const getCardDetail = async (cardId, forceRefresh = false) => cachedQuery(`card_detail_${cardId}`, async () => {
  const { data, error } = await supabase
    .from('cards')
    .select('id, question, answer, image, example, note, created_at')
    .eq('id', cardId)
    .single();
  if (error) throw error;
  return data;
}, { staleTime: STALE.SHARED, force: forceRefresh, persist: false });

// One card's learning state for the user: { status, next_review }, or null
// when it has never been studied.
export const getCardProgress = async (userId, cardId) => {
  if (!userId || !cardId) return null;
  const { data, error } = await supabase
    .from('user_card_progress')
    .select('status, next_review')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
};

export const upsertCardProgress = async (userId, cardId, status, nextReview) => {
  const { error } = await supabase
    .from('user_card_progress')
    .upsert({
      user_id: userId,
      card_id: cardId,
      status,
      next_review: nextReview,
    }, { onConflict: 'user_id,card_id' });
  if (error) throw error;
};

export const getCardsToLearn = async (deckId, userId, chapterId = null, unassignedOnly = false, limit = 30, offset = 0) => {
  const { data, error } = await supabase.rpc('get_cards_to_learn', {
    p_deck_id: deckId,
    p_user_id: userId,
    p_chapter_id: chapterId,
    p_unassigned_only: unassignedOnly,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  let rows = data || [];
  if (userId) {
    rows = await filterReportedLearningRowsForUser(rows, userId);
  }
  return rows;
};

export const startSwipeSession = async ({ deckId, chapterId = null, unassignedOnly = false }) => {
  const { data, error } = await supabase.rpc('swipe_session_start', {
    p_deck_id: deckId,
    p_chapter_id: chapterId,
    p_unassigned_only: unassignedOnly,
  });
  if (error) throw error;
  return typeof data === 'string' ? data : data?.session_id;
};

export const getSwipeSessionQueueCount = async (sessionId) => {
  if (!sessionId) return 0;
  const { count, error } = await supabase
    .from('swipe_session_queue')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  if (error) throw error;
  return count || 0;
};

/**
 * End-of-session summary in one RPC (swipe_session_summary): cards studied,
 * now learned / learning, and the nearest review of the learning ones.
 */
export const getSwipeSessionCompletionCounts = async (sessionId, userId) => {
  if (!sessionId || !userId) return null;
  const { data, error } = await supabase.rpc('swipe_session_summary', { p_session_id: sessionId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) || {};
  return {
    studied: Number(row.studied || 0),
    learned: Number(row.learned || 0),
    learning: Number(row.learning || 0),
    nextReview: row.next_review_at ? { at: row.next_review_at, count: Number(row.next_review_count || 0) } : null,
  };
};

export const getChapterFutureReviewSummary = async (userId, deckId, chapterId) => {
  if (!userId || !deckId || !chapterId) return { nearest: null, farthest: null };
  const { data, error } = await supabase.rpc('chapter_future_reviews', {
    p_deck_id: deckId,
    p_chapter_id: chapterId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.nearest_at) return { nearest: null, farthest: null };
  return {
    nearest: { at: row.nearest_at, count: Number(row.nearest_count || 0) },
    farthest: { at: row.farthest_at },
  };
};

export const getSwipeSessionNextCards = async ({
  sessionId,
  afterSortKey = null,
  afterQueueId = null,
  currentSortKey = null,
  currentQueueId = null,
  limit = 20,
}) => {
  const { data, error } = await supabase.rpc('swipe_session_next_cards', {
    p_session_id: sessionId,
    p_after_sort_key: afterSortKey,
    p_after_queue_id: afterQueueId,
    p_current_sort_key: currentSortKey,
    p_current_queue_id: currentQueueId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data || []).map((card) => ({
    ...card,
    id: card.card_id,
  }));
};

export const recordSwipeSessionSwipe = async ({
  sessionId,
  cardId,
  direction,
  skipMinutes = null,
}) => {
  const { data, error } = await supabase.rpc('swipe_session_record_swipe', {
    p_session_id: sessionId,
    p_card_id: cardId,
    p_direction: direction,
    p_skip_minutes: skipMinutes,
  });
  if (error) throw error;
  return data;
};

export const undoLastSwipe = async ({ sessionId }) => {
  const { data, error } = await supabase.rpc('swipe_session_undo_last_swipe', {
    p_session_id: sessionId,
  });
  if (error) throw error;
  return data;
};

// Server-side swipe settings (public.swipe_config). Read once per app run; the
// defaults match the config so an older database still behaves the same.
const SWIPE_CLIENT_CONFIG_DEFAULTS = { left_delay_seconds: 60, undo_limit: 10 };
let swipeClientConfigPromise = null;
export const getSwipeClientConfig = () => {
  if (!swipeClientConfigPromise) {
    swipeClientConfigPromise = supabase
      .rpc('swipe_client_config')
      .then(({ data, error }) => (error || !data ? SWIPE_CLIENT_CONFIG_DEFAULTS : { ...SWIPE_CLIENT_CONFIG_DEFAULTS, ...data }))
      .catch(() => SWIPE_CLIENT_CONFIG_DEFAULTS)
      .then((cfg) => {
        if (cfg === SWIPE_CLIENT_CONFIG_DEFAULTS) swipeClientConfigPromise = null; // retry next time
        return cfg;
      });
  }
  return swipeClientConfigPromise;
};

export const endSwipeSession = async ({ sessionId }) => {
  if (!sessionId) return null;
  const { data, error } = await supabase.rpc('swipe_session_end', {
    p_session_id: sessionId,
  });
  if (error) throw error;
  return data;
};

export const batchUpsertProgress = async (progressItems) => {
  if (!progressItems || progressItems.length === 0) return;
  const { error } = await supabase
    .from('user_card_progress')
    .upsert(progressItems, { onConflict: 'user_id,card_id' });
  if (error) throw error;
};

// Deck totals (learned / learning / new) are cached (RAM + disk), so DeckDetail
// shows the last numbers at once. Swipe, card add / delete and reports
// invalidate them (progress_deck_<deck>_…).
const deckProgressKey = (deckId, userId) => `progress_deck_${deckId}_${userId}`;
export const getDeckProgressCounts = async (userId, deckId, forceRefresh = false) => (userId
  ? cachedQuery(deckProgressKey(deckId, userId), () => progressCountsRpc(deckId, 'deck'), { staleTime: STALE.SHARED, force: forceRefresh })
  : progressCountsRpc(deckId, 'deck'));

/** Last known deck totals (even if stale), or null. No request. */
export const peekDeckProgressCounts = (userId, deckId) => (userId ? peekCachedQuery(deckProgressKey(deckId, userId)) : null);

export const getTotalLearnedCardsCount = async (userId) => {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('user_card_progress')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'learned');

  if (error) throw error;
  return count || 0;
};
