import { supabase } from '../lib/supabase';
import { invalidateCache } from './CacheService';

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

export const getCardDetail = async (cardId) => {
  const { data, error } = await supabase
    .from('cards')
    .select('id, question, answer, image, example, note, created_at')
    .eq('id', cardId)
    .single();
  if (error) throw error;
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