import { supabase } from '../lib/supabase';
import { cacheData, getCachedData, invalidateCache, CACHE_DURATIONS } from './CacheService';

/**
 * List chapters for a deck ordered by ordinal then created_at (newest at bottom).
 * 4 saat cache (mutation: chapter ekle/sil sonrası invalidate).
 * @param {string} deckId
 * @param {boolean} forceRefresh - true ise cache bypass
 */
export async function listChapters(deckId, forceRefresh = false) {
  const cacheKey = `chapters_${deckId}`;
  if (!forceRefresh) {
    const cached = await getCachedData(cacheKey, CACHE_DURATIONS.CHAPTERS);
    if (cached && !cached.isStale) return cached.data;
  }
  const { data, error } = await supabase
    .from('chapters')
    .select('id, ordinal, created_at')
    .eq('deck_id', deckId)
    .order('ordinal', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  const result = data || [];
  await cacheData(cacheKey, result);
  return result;
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
  await invalidateCache(`chapters_${deckId}`);
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

/**
 * Delete a chapter by id.
 * @param {string} chapterId
 * @param {string} [deckId] - Varsa bu destenin chapters cache'i invalidate edilir
 */
export async function deleteChapter(chapterId, deckId = null) {
  const { error } = await supabase
    .from('chapters')
    .delete()
    .eq('id', chapterId);
  if (error) throw error;
  if (deckId) await invalidateCache(`chapters_${deckId}`);
  return true;
}

/**
 * Reorder chapter ordinals sequentially (1, 2, 3, ...) for a deck
 * This ensures no gaps in ordinal values after deletion
 * @param {string} deckId
 */
export async function reorderChapterOrdinals(deckId) {
  // Get all chapters ordered by current ordinal
  const { data: chapters, error: fetchError } = await supabase
    .from('chapters')
    .select('id, ordinal')
    .eq('deck_id', deckId)
    .order('ordinal', { ascending: true })
    .order('created_at', { ascending: true });
  
  if (fetchError) throw fetchError;
  if (!chapters || chapters.length === 0) return;
  
  // Update ordinals sequentially (1, 2, 3, ...)
  const updates = chapters.map((chapter, index) => ({
    id: chapter.id,
    ordinal: index + 1,
  }));
  
  // Batch update all chapters
  for (const update of updates) {
    const { error } = await supabase
      .from('chapters')
      .update({ ordinal: update.ordinal })
      .eq('id', update.id);
    
    if (error) throw error;
  }
  await invalidateCache(`chapters_${deckId}`);
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
    let cardsQuery = supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('deck_id', deckId);

    if (chapterId) {
      cardsQuery = cardsQuery.eq('chapter_id', chapterId);
    } else {
      cardsQuery = cardsQuery.is('chapter_id', null);
    }

    const { count: total, error: cardsError } = await cardsQuery;
    if (cardsError) throw cardsError;

    if (!total || total === 0) {
      return { total: 0, learned: 0, learning: 0, new: 0, progress: 0 };
    }

    let learnedQuery = supabase
      .from('user_card_progress')
      .select('id, cards!inner(id)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'learned')
      .eq('cards.deck_id', deckId);

    let learningQuery = supabase
      .from('user_card_progress')
      .select('id, cards!inner(id)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'learning')
      .eq('cards.deck_id', deckId);

    if (chapterId) {
      learnedQuery = learnedQuery.eq('cards.chapter_id', chapterId);
      learningQuery = learningQuery.eq('cards.chapter_id', chapterId);
    } else {
      learnedQuery = learnedQuery.is('cards.chapter_id', null);
      learningQuery = learningQuery.is('cards.chapter_id', null);
    }

    const [learnedResult, learningResult] = await Promise.all([learnedQuery, learningQuery]);
    if (learnedResult.error) throw learnedResult.error;
    if (learningResult.error) throw learningResult.error;

    const learned = learnedResult.count || 0;
    const learning = learningResult.count || 0;
    const progress = total > 0 ? learned / total : 0;

    return { total, learned, learning, new: total - learned - learning, progress };
  } catch (error) {
    console.error('Error getting chapter progress:', error);
    return { total: 0, learned: 0, learning: 0, new: 0, progress: 0 };
  }
}

/**
 * Get progress for multiple chapters at once using count+head:true (0 rows downloaded).
 * Each chapter gets 3 parallel count queries (total, learned, learning).
 * All chapters run in parallel via Promise.all.
 */
export async function getChaptersProgress(chapters, deckId, userId) {
  const progressMap = new Map();

  try {
    const chapterPromises = chapters.map(async (ch) => {
      const chapterId = ch.id;
      const key = chapterId || 'unassigned';

      let totalQuery = supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('deck_id', deckId);

      let learnedQuery = supabase
        .from('user_card_progress')
        .select('id, cards!inner(id)', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'learned')
        .eq('cards.deck_id', deckId);

      let learningQuery = supabase
        .from('user_card_progress')
        .select('id, cards!inner(id)', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'learning')
        .eq('cards.deck_id', deckId);

      if (chapterId) {
        totalQuery = totalQuery.eq('chapter_id', chapterId);
        learnedQuery = learnedQuery.eq('cards.chapter_id', chapterId);
        learningQuery = learningQuery.eq('cards.chapter_id', chapterId);
      } else {
        totalQuery = totalQuery.is('chapter_id', null);
        learnedQuery = learnedQuery.is('cards.chapter_id', null);
        learningQuery = learningQuery.is('cards.chapter_id', null);
      }

      const [totalRes, learnedRes, learningRes] = await Promise.all([
        totalQuery, learnedQuery, learningQuery,
      ]);

      const total = totalRes.count || 0;
      const learned = learnedRes.count || 0;
      const learning = learningRes.count || 0;
      const progress = total > 0 ? learned / total : 0;

      return { key, total, learned, learning, new: total - learned - learning, progress };
    });

    const results = await Promise.all(chapterPromises);
    results.forEach(r => progressMap.set(r.key, {
      total: r.total, learned: r.learned, learning: r.learning, new: r.new, progress: r.progress,
    }));

    return progressMap;
  } catch (error) {
    console.error('Error fetching chapters progress:', error);
    chapters.forEach(ch => {
      progressMap.set(ch.id || 'unassigned', { total: 0, learned: 0, learning: 0, new: 0, progress: 0 });
    });
    return progressMap;
  }
}
