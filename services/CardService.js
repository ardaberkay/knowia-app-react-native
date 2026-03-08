import { supabase } from '../lib/supabase';
import { invalidateCache, cacheData, getCachedData, CACHE_DURATIONS } from './CacheService';

const PAGE_SIZE = 50;

export const getCardsByDeck = async (deckId, page = 0, pageSize = PAGE_SIZE, sortBy = 'original') => {
  const from = page * pageSize;
  let query = supabase
    .from('cards')
    .select('id, question, answer, created_at')
    .eq('deck_id', deckId);

  if (sortBy === 'az') {
    query = query.order('question', { ascending: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return data || [];
};

export const getCardsByChapter = async (deckId, chapterId, page = 0, pageSize = PAGE_SIZE) => {
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
  return data || [];
};

export const getChapterProgressCounts = async (userId, deckId, chapterId) => {
  const isUnassigned = !chapterId;
  let totalQ = supabase.from('cards').select('id', { count: 'exact', head: true }).eq('deck_id', deckId);
  if (isUnassigned) totalQ = totalQ.is('chapter_id', null);
  else totalQ = totalQ.eq('chapter_id', chapterId);

  let learnedQ = supabase.from('user_card_progress')
    .select('id, cards!inner(id)', { count: 'exact', head: true })
    .eq('user_id', userId).eq('status', 'learned').eq('cards.deck_id', deckId);
  if (isUnassigned) learnedQ = learnedQ.is('cards.chapter_id', null);
  else learnedQ = learnedQ.eq('cards.chapter_id', chapterId);

  let learningQ = supabase.from('user_card_progress')
    .select('id, cards!inner(id)', { count: 'exact', head: true })
    .eq('user_id', userId).eq('status', 'learning').eq('cards.deck_id', deckId);
  if (isUnassigned) learningQ = learningQ.is('cards.chapter_id', null);
  else learningQ = learningQ.eq('cards.chapter_id', chapterId);

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
  const { data, error } = await supabase
    .from('cards')
    .update({
      question: cardData.question,
      answer: cardData.answer,
      example: cardData.example || null,
      note: cardData.note || null,
      image: cardData.image || null,
    })
    .eq('id', cardId)
    .select();
  if (error) throw error;
  const card = data?.[0] || null;
  if (card) await invalidateCache(`card_detail_${cardId}`);
  return card;
};

export const deleteCard = async (cardId) => {
  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', cardId);
  if (error) throw error;
  await invalidateCache(`card_detail_${cardId}`);
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
  return data || [];
};

export const batchUpsertProgress = async (progressItems) => {
  if (!progressItems || progressItems.length === 0) return;
  const { error } = await supabase
    .from('user_card_progress')
    .upsert(progressItems, { onConflict: 'user_id,card_id' });
  if (error) throw error;
};

export const getDeckProgressCounts = async (userId, deckId) => {
  const [totalResult, learnedResult, learningResult] = await Promise.all([
    supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('deck_id', deckId),
    supabase
      .from('user_card_progress')
      .select('id, cards!inner(id)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'learned')
      .eq('cards.deck_id', deckId),
    supabase
      .from('user_card_progress')
      .select('id, cards!inner(id)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'learning')
      .eq('cards.deck_id', deckId),
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