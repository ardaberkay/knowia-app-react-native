import { supabase } from '../lib/supabase';
import { invalidateCache, cacheData, getCachedData, CACHE_DURATIONS } from './CacheService';

const PAGE_SIZE = 50;

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

const buildNotInList = (ids) => `(${ids.map((id) => `"${id}"`).join(',')})`;

const getHiddenCardIdsForScope = async (userId, deckId, chapterId, isAll, isUnassigned) => {
  if (!userId) return [];

  const { data: reports, error: reportsError } = await supabase
    .from('reports')
    .select('target_id')
    .eq('reporter_id', userId)
    .eq('report_type', 'card');

  if (reportsError) throw reportsError;

  const targetIds = (reports || []).map((r) => r.target_id);
  if (targetIds.length === 0) return [];

  let cardsQuery = supabase
    .from('cards')
    .select('id')
    .eq('deck_id', deckId)
    .in('id', targetIds);

  if (!isAll) {
    if (isUnassigned) {
      cardsQuery = cardsQuery.is('chapter_id', null);
    } else if (chapterId) {
      cardsQuery = cardsQuery.eq('chapter_id', chapterId);
    }
  }

  const { data: cardsData, error: cardsError } = await cardsQuery;
  if (cardsError) throw cardsError;

  return (cardsData || []).map((c) => c.id);
};

/**
 * Destedeki kartları sayfalı ve isteğe bağlı cache ile döndürür.
 * forceRefresh true ise cache bypass edilir (pull-to-refresh için).
 * @param {string} deckId - Deste id
 * @param {number} page - Sayfa (0 tabanlı)
 * @param {number} pageSize - Sayfa boyutu
 * @param {string} sortBy - 'original' | 'az'
 * @param {boolean} forceRefresh - Cache bypass
 * @param {string} [userId] - Filtre için gerekli (learned/unlearned/fav)
 * @param {string} [filter] - 'learned' | 'unlearned' | 'fav' - Tüm liste üzerinde sunucu tarafı filtre
 * @param {string|null} [searchQuery] - Soru/cevap metninde sunucu tarafı ilike (tüm deste)
 */
const buildIlikePattern = (searchQuery) => {
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

const applyQuestionAnswerOrIlike = (query, likePattern, { nestedCards = false } = {}) => {
  if (!likePattern) return query;
  const escaped = likePattern.replace(/"/g, '');
  const qCol = nestedCards ? 'cards.question' : 'question';
  const aCol = nestedCards ? 'cards.answer' : 'answer';
  return query.or(`${qCol}.ilike."${escaped}",${aCol}.ilike."${escaped}"`);
};

export const getCardsByDeck = async (deckId, page = 0, pageSize = PAGE_SIZE, sortBy = 'original', forceRefresh = false, userId = null, filter = null, searchQuery = null) => {
  const searchNorm = searchQuery && String(searchQuery).trim() ? String(searchQuery).trim() : '';
  const searchKeyPart = searchNorm ? `_q_${encodeURIComponent(searchNorm).slice(0, 80)}` : '';
  const cacheKey = `cards_deck_${deckId}_p${page}_${sortBy}_${filter || 'all'}${searchKeyPart}`;
  if (!forceRefresh) {
    const cached = await getCachedData(cacheKey, CACHE_DURATIONS.CARDS_CONTENT);
    if (cached && !cached.isStale) return cached.data;
  }
  const from = page * pageSize;
  const likePattern = buildIlikePattern(searchNorm);

  let result = [];

  if (filter === 'learned' && userId) {
    let query = supabase
      .from('user_card_progress')
      .select('card_id, status, cards!inner(id, question, answer, created_at, deck_id)')
      .eq('user_id', userId)
      .eq('status', 'learned')
      .eq('cards.deck_id', deckId);
    query = applyQuestionAnswerOrIlike(query, likePattern, { nestedCards: true });
    query = query.order('card_id', { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    result = (data || []).map((row) => ({ ...row.cards }));
  } else if (filter === 'fav' && userId) {
    let favQuery = supabase
      .from('favorite_cards')
      .select('card_id, created_at, cards!inner(id, question, answer, created_at, deck_id)')
      .eq('user_id', userId)
      .eq('cards.deck_id', deckId);
    favQuery = applyQuestionAnswerOrIlike(favQuery, likePattern, { nestedCards: true });
    favQuery = favQuery.order('created_at', { ascending: false });
    const { data, error } = await favQuery.range(from, from + pageSize - 1);
    if (error) throw error;
    result = (data || []).map((row) => {
      const { deck_id, ...card } = row.cards;
      return card;
    });
  } else if (filter === 'unlearned' && userId) {
    const { data: learnedRows } = await supabase
      .from('user_card_progress')
      .select('card_id, cards!inner(deck_id)')
      .eq('user_id', userId)
      .eq('status', 'learned')
      .eq('cards.deck_id', deckId);
    const learnedIds = (learnedRows || []).map((r) => r.card_id);
    if (learnedIds.length > 0) {
      let unlearnedQuery = supabase
        .from('cards')
        .select('id, question, answer, created_at')
        .eq('deck_id', deckId)
        .not('id', 'in', `(${learnedIds.map((id) => `"${id}"`).join(',')})`);
      unlearnedQuery = applyQuestionAnswerOrIlike(unlearnedQuery, likePattern, { nestedCards: false });
      unlearnedQuery = sortBy === 'az' ? unlearnedQuery.order('question', { ascending: true }) : unlearnedQuery.order('created_at', { ascending: false });
      const { data, error } = await unlearnedQuery.range(from, from + pageSize - 1);
      if (error) throw error;
      result = data || [];
    } else {
      let unlearnedQuery = supabase
        .from('cards')
        .select('id, question, answer, created_at')
        .eq('deck_id', deckId);
      unlearnedQuery = applyQuestionAnswerOrIlike(unlearnedQuery, likePattern, { nestedCards: false });
      unlearnedQuery = sortBy === 'az' ? unlearnedQuery.order('question', { ascending: true }) : unlearnedQuery.order('created_at', { ascending: false });
      const { data, error } = await unlearnedQuery.range(from, from + pageSize - 1);
      if (error) throw error;
      result = data || [];
    }
  } else {
    let query = supabase
      .from('cards')
      .select('id, question, answer, created_at')
      .eq('deck_id', deckId);
    query = applyQuestionAnswerOrIlike(query, likePattern, { nestedCards: false });
    if (sortBy === 'az') {
      query = query.order('question', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    result = data || [];
  }

  if (userId) {
    result = await filterReportedCardsForUser(result, userId);
  }

  if (result.length > 0) await cacheData(cacheKey, result);
  return result;
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
  if (deckId && userId) await invalidateCache(`progress_chapters_${deckId}_${userId}`);
};

export const getCardsByChapter = async (deckId, chapterId, page = 0, pageSize = PAGE_SIZE, userId = null) => {
  const from = page * pageSize;
  let query = supabase
    .from('cards')
    .select('id, question, answer, created_at')
    .eq('deck_id', deckId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (chapterId) {
    query = query.eq('chapter_id', chapterId);
  } else {
    query = query.is('chapter_id', null);
  }
  const { data, error } = await query;
  if (error) throw error;
  const cards = data || [];
  if (!userId) return cards;
  return filterReportedCardsForUser(cards, userId);
};

export const getChapterProgressCounts = async (userId, deckId, chapterId) => {
  // chapterId anlamları:
  // - undefined  -> Tüm kartlar (chapter filtresi yok)
  // - null       -> Sadece atanmamış kartlar (chapter_id IS NULL)
  // - string/id  -> Belirli bölüm (chapter_id = chapterId)
  const isAll = typeof chapterId === 'undefined';
  const isUnassigned = chapterId === null;

  let totalQ = supabase
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('deck_id', deckId);

  if (!isAll) {
    if (isUnassigned) totalQ = totalQ.is('chapter_id', null);
    else totalQ = totalQ.eq('chapter_id', chapterId);
  }

  let learnedQ = supabase
    .from('user_card_progress')
    .select('id, cards!inner(id)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'learned')
    .eq('cards.deck_id', deckId);

  if (!isAll) {
    if (isUnassigned) learnedQ = learnedQ.is('cards.chapter_id', null);
    else learnedQ = learnedQ.eq('cards.chapter_id', chapterId);
  }

  let learningQ = supabase
    .from('user_card_progress')
    .select('id, cards!inner(id)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'learning')
    .eq('cards.deck_id', deckId);

  if (!isAll) {
    if (isUnassigned) learningQ = learningQ.is('cards.chapter_id', null);
    else learningQ = learningQ.eq('cards.chapter_id', chapterId);
  }

  const hiddenIds = await getHiddenCardIdsForScope(userId, deckId, chapterId, isAll, isUnassigned);
  if (hiddenIds.length > 0) {
    const notIn = buildNotInList(hiddenIds);
    totalQ = totalQ.not('id', 'in', notIn);
    learnedQ = learnedQ.not('cards.id', 'in', notIn);
    learningQ = learningQ.not('cards.id', 'in', notIn);
  }

  const [totalR, learnedR, learningR] = await Promise.all([totalQ, learnedQ, learningQ]);
  if (totalR.error) throw totalR.error;
  if (learnedR.error) throw learnedR.error;
  if (learningR.error) throw learningR.error;

  const total = totalR.count || 0;
  const learned = learnedR.count || 0;
  const learning = learningR.count || 0;
  return { total, learned, learning, new: total - learned - learning };
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
  return data?.[0] || null;
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

    // 2. KONTROL: Eğer eski bir görsel varsa VE yeni görselden farklıysa
    // (Yani kullanıcı resmi değiştirdiyse VEYA resmi tamamen sildiyse)
    if (oldImage && oldImage !== newImage) {
      
      // Eski görselin tam URL'sini parçalayıp Supabase'in istediği yolu buluyoruz
      const urlParts = oldImage.split('/images/');
      const oldImagePath = urlParts.length > 1 ? urlParts[1] : null;

      // 3. Eski görseli 'images' bucket'ından siliyoruz
      if (oldImagePath) {
        const { error: storageError } = await supabase
          .storage
          .from('images')
          .remove([oldImagePath]);

        if (storageError) {
          console.error("Eski görsel storage'dan silinemedi, ancak güncelleme devam edecek:", storageError);
          // Not: Görsel silinemese bile kartın metin verilerini güncellemek 
          // kullanıcı deneyimi açısından daha iyidir, bu yüzden burada 'throw' yapmıyoruz.
        }
      }
    }

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

    // 5. Önbelleği (Cache) temizliyoruz
    if (card) {
      await invalidateCache(`card_detail_${cardId}`);
      if (card.deck_id) await invalidateCache(`cards_deck_${card.deck_id}`);
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
  // 1. Silinecek kartın görsel yolunu (URL) veritabanından çekiyoruz
  const { data: card, error: fetchError } = await supabase
    .from('cards')
    .select('image')
    .eq('id', cardId)
    .single();

  if (fetchError) throw fetchError;

  // 2. Eğer kartın bir görseli varsa, tam URL'yi parçalayıp Storage'dan siliyoruz
  if (card && card.image) {
    const urlParts = card.image.split('/images/');
    const imagePath = urlParts.length > 1 ? urlParts[1] : null;

    if (imagePath) {
      const { error: storageError } = await supabase
        .storage
        .from('images')
        .remove([imagePath]);

      if (storageError) {
        console.error("Görsel storage'dan silinemedi:", storageError);
        // Hata olsa bile kartın veritabanından silinmesini engellememek için throw kullanmıyoruz.
      }
    }
  }

  // 3. Kartı veritabanından siliyoruz (Senin orijinal kodun)
  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', cardId);

  if (error) throw error;

  // 4. Önbelleği temizliyoruz (Senin orijinal kodun)
  await invalidateCache(`card_detail_${cardId}`);
  if (deckId) await invalidateCache(`cards_deck_${deckId}`);
};

export const getCardDetail = async (cardId, forceRefresh = false) => {
  const cacheKey = `card_detail_${cardId}`;
  if (!forceRefresh) {
    const cached = await getCachedData(cacheKey, CACHE_DURATIONS.CARD_DETAIL);
    if (cached && !cached.isStale) return cached.data;
  }
  const { data, error } = await supabase
    .from('cards')
    .select('id, question, answer, image, example, note, created_at')
    .eq('id', cardId)
    .single();
  if (error) throw error;
  if (data) await cacheData(cacheKey, data);
  return data;
};

export const getUserCardProgressForCards = async (userId, cardIds) => {
  if (!userId || !cardIds || cardIds.length === 0) return {};
  const CHUNK_SIZE = 200;
  const statusMap = {};
  for (let i = 0; i < cardIds.length; i += CHUNK_SIZE) {
    const chunk = cardIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('user_card_progress')
      .select('card_id, status')
      .eq('user_id', userId)
      .in('card_id', chunk);
    if (error) throw error;
    (data || []).forEach(p => { statusMap[p.card_id] = p.status; });
  }
  return statusMap;
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

export const batchUpsertProgress = async (progressItems) => {
  if (!progressItems || progressItems.length === 0) return;
  const { error } = await supabase
    .from('user_card_progress')
    .upsert(progressItems, { onConflict: 'user_id,card_id' });
  if (error) throw error;
};

export const getDeckProgressCounts = async (userId, deckId) => {
  let totalQ = supabase
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('deck_id', deckId);

  let learnedQ = supabase
    .from('user_card_progress')
    .select('id, cards!inner(id)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'learned')
    .eq('cards.deck_id', deckId);

  let learningQ = supabase
    .from('user_card_progress')
    .select('id, cards!inner(id)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'learning')
    .eq('cards.deck_id', deckId);

  const hiddenIds = await getHiddenCardIdsForScope(userId, deckId, undefined, true, false);
  if (hiddenIds.length > 0) {
    const notIn = buildNotInList(hiddenIds);
    totalQ = totalQ.not('id', 'in', notIn);
    learnedQ = learnedQ.not('cards.id', 'in', notIn);
    learningQ = learningQ.not('cards.id', 'in', notIn);
  }

  const [totalResult, learnedResult, learningResult] = await Promise.all([
    totalQ,
    learnedQ,
    learningQ,
  ]);

  if (totalResult.error) throw totalResult.error;
  if (learnedResult.error) throw learnedResult.error;
  if (learningResult.error) throw learningResult.error;

  const total = totalResult.count || 0;
  const learned = learnedResult.count || 0;
  const learning = learningResult.count || 0;

  return {
    total,
    learned,
    learning,
    new: total - learned - learning,
  };
};