import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './CacheService';
import { STALE } from '../lib/queryClient';

/** @param {string} deckId @param {string} userId */
export const chaptersProgressCacheKey = (deckId, userId) => `progress_chapters_${deckId}_${userId}`;

/**
 * List chapters for a deck ordered by ordinal then created_at (newest at bottom).
 * 4 saat cache (mutation: chapter ekle/sil sonrası invalidate).
 * @param {string} deckId
 * @param {boolean} forceRefresh - true ise cache bypass
 */
export async function listChapters(deckId, forceRefresh = false) {
  return cachedQuery(`chapters_${deckId}`, async () => {
    const { data, error } = await supabase
      .from('chapters')
      .select('id, ordinal, created_at')
      .eq('deck_id', deckId)
      .order('ordinal', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }, { staleTime: STALE.SHARED, force: forceRefresh });
}

/**
 * Create a new chapter with given ordinal
 * @param {string} deckId
 * @param {number} ordinal
 */
export async function createChapter(deckId, ordinal, userId = null) {
  const { data, error } = await supabase
    .from('chapters')
    .insert({ deck_id: deckId, ordinal })
    .select('id, ordinal, created_at')
    .single();
  if (error) throw error;
  await invalidateCache(`chapters_${deckId}`);
  if (userId) await invalidateCache(chaptersProgressCacheKey(deckId, userId));
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
export async function distributeUnassignedEvenly(deckId, chapterIds, userId = null) {
  const { error } = await supabase.rpc('distribute_unassigned_evenly', {
    p_deck: deckId,
    p_chapters: chapterIds,
  });
  if (error) throw error;
  if (userId) await invalidateCache(chaptersProgressCacheKey(deckId, userId));
  return true;
}

/**
 * Delete a chapter by id.
 * @param {string} chapterId
 * @param {string} [deckId] - Varsa bu destenin chapters cache'i invalidate edilir
 */
export async function deleteChapter(chapterId, deckId = null, userId = null) {
  const { error } = await supabase
    .from('chapters')
    .delete()
    .eq('id', chapterId);
  if (error) throw error;
  if (deckId) await invalidateCache(`chapters_${deckId}`);
  if (deckId && userId) await invalidateCache(chaptersProgressCacheKey(deckId, userId));
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
 * Fetch chapter progress (including unassigned) in one RPC call.
 * Returns a map keyed by chapter id or 'unassigned'.
 */
export async function getDeckChaptersProgressRpc(deckId, userId, forceRefresh = false) {
  if (!deckId || !userId) return new Map();
  // Cached as a plain object (JSON-safe), handed out as a Map keyed by chapter
  // id or 'unassigned'. Swipe / chapter changes invalidate it.
  const asObject = await cachedQuery(chaptersProgressCacheKey(deckId, userId), async () => {
    const { data, error } = await supabase.rpc('get_deck_chapters_progress', {
      p_deck_id: deckId,
      p_user_id: userId,
    });
    if (error) throw error;
    const out = {};
    (data || []).forEach((row) => {
      const key = row?.scope_key || (row?.chapter_id ?? 'unassigned');
      out[key] = {
        total: Number(row?.total_count || 0),
        learned: Number(row?.learned_count || 0),
        learning: Number(row?.learning_count || 0),
        new: Number(row?.new_count || 0),
        progress: Number(row?.progress || 0),
      };
    });
    return out;
  }, { staleTime: STALE.OWN, force: forceRefresh });
  return new Map(Object.entries(asObject || {}));
}
