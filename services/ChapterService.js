import { supabase } from '../lib/supabase';

/**
 * List chapters for a deck ordered by ordinal then created_at (newest at bottom)
 * @param {string} deckId
 */
export async function listChapters(deckId) {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, ordinal, created_at')
    .eq('deck_id', deckId)
    .order('ordinal', { ascending: true })
    .order('created_at', { ascending: true }); // Yeni eklenenler altta olacak (ascending = eski önce, yeni sonra)
  if (error) throw error;
  return data || [];
}

/**
 * Create a new chapter with given ordinal
 * @param {string} deckId
 * @param {number} ordinal
 */
export async function createChapter(deckId, ordinal) {
  const { data, error } = await supabase
    .from('chapters')
    .insert({ deck_id: deckId, ordinal })
    .select('id, ordinal, created_at')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Compute next ordinal as max(ordinal)+1 for a deck
 * @param {string} deckId
 */
export async function getNextOrdinal(deckId) {
  const { data, error } = await supabase
    .from('chapters')
    .select('ordinal')
    .eq('deck_id', deckId)
    .order('ordinal', { ascending: false })
    .limit(1);
  if (error) throw error;
  const maxOrd = data && data.length > 0 ? Number(data[0].ordinal) : 0;
  return maxOrd + 1;
}

/**
 * Distribute unassigned cards of a deck evenly/randomly across provided chapter ids
 * Calls RPC public.distribute_unassigned_evenly(p_deck uuid, p_chapters uuid[])
 * @param {string} deckId
 * @param {string[]} chapterIds
 */
export async function distributeUnassignedEvenly(deckId, chapterIds) {
  const { error } = await supabase.rpc('distribute_unassigned_evenly', {
    p_deck: deckId,
    p_chapters: chapterIds,
  });
  if (error) throw error;
  return true;
}

/** Delete a chapter by id */
export async function deleteChapter(chapterId) {
  const { error } = await supabase
    .from('chapters')
    .delete()
    .eq('id', chapterId);
  if (error) throw error;
  return true;
}

/**
 * Get progress for a chapter (total cards and learned cards count)
 * @param {string} chapterId - Chapter ID (null for unassigned cards)
 * @param {string} deckId - Deck ID
 * @param {string} userId - User ID
 * @returns {Promise<{total: number, learned: number, progress: number}>}
 */
export async function getChapterProgress(chapterId, deckId, userId) {
  try {
    // Get total cards in this chapter
    let cardsQuery = supabase
      .from('cards')
      .select('id')
      .eq('deck_id', deckId);
    
    if (chapterId) {
      cardsQuery = cardsQuery.eq('chapter_id', chapterId);
    } else {
      cardsQuery = cardsQuery.is('chapter_id', null);
    }
    
    const { data: cards, error: cardsError } = await cardsQuery;
    if (cardsError) throw cardsError;
    
    const total = cards?.length || 0;
    if (total === 0) {
      return { total: 0, learned: 0, progress: 0 };
    }
    
    // Get learned cards count
    const cardIds = cards.map(c => c.id);
    const { data: progressData, error: progressError } = await supabase
      .from('user_card_progress')
      .select('card_id')
      .eq('user_id', userId)
      .in('card_id', cardIds)
      .eq('status', 'learned');
    
    if (progressError) throw progressError;
    const learned = progressData?.length || 0;
    const progress = total > 0 ? learned / total : 0;
    
    return { total, learned, progress };
  } catch (error) {
    console.error('Error getting chapter progress:', error);
    return { total: 0, learned: 0, progress: 0 };
  }
}

/**
 * Get progress for multiple chapters at once
 * @param {Array<{id: string|null}>} chapters - Array of chapters (id can be null for unassigned)
 * @param {string} deckId - Deck ID
 * @param {string} userId - User ID
 * @returns {Promise<Map<string, {total: number, learned: number, progress: number}>>}
 */
export async function getChaptersProgress(chapters, deckId, userId) {
  const progressMap = new Map();
  
  // Get all card IDs for this deck grouped by chapter
  const { data: allCards, error: cardsError } = await supabase
    .from('cards')
    .select('id, chapter_id')
    .eq('deck_id', deckId);
  
  if (cardsError) {
    console.error('Error fetching cards:', cardsError);
    return progressMap;
  }
  
  // Group cards by chapter_id
  const cardsByChapter = new Map();
  chapters.forEach(ch => {
    const key = ch.id || 'unassigned';
    cardsByChapter.set(key, []);
  });
  
  (allCards || []).forEach(card => {
    const key = card.chapter_id || 'unassigned';
    if (cardsByChapter.has(key)) {
      cardsByChapter.get(key).push(card.id);
    }
  });
  
  // Get all card IDs
  const allCardIds = (allCards || []).map(c => c.id);
  if (allCardIds.length === 0) {
    chapters.forEach(ch => {
      progressMap.set(ch.id || 'unassigned', { total: 0, learned: 0, progress: 0 });
    });
    return progressMap;
  }
  
  // Get learned cards for all chapters at once
  const { data: progressData, error: progressError } = await supabase
    .from('user_card_progress')
    .select('card_id')
    .eq('user_id', userId)
    .in('card_id', allCardIds)
    .eq('status', 'learned');
  
  if (progressError) {
    console.error('Error fetching progress:', progressError);
    chapters.forEach(ch => {
      progressMap.set(ch.id || 'unassigned', { total: 0, learned: 0, progress: 0 });
    });
    return progressMap;
  }
  
  const learnedCardIds = new Set((progressData || []).map(p => p.card_id));
  
  // Calculate progress for each chapter
  chapters.forEach(ch => {
    const key = ch.id || 'unassigned';
    const cardIds = cardsByChapter.get(key) || [];
    const total = cardIds.length;
    const learned = cardIds.filter(id => learnedCardIds.has(id)).length;
    const progress = total > 0 ? learned / total : 0;
    progressMap.set(key, { total, learned, progress });
  });
  
  return progressMap;
}


