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


