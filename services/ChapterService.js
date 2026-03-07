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
    // 1. Toplam kart sayısını bulalım (Sadece sayıyı alır, veriyi indirmez - Limite takılmaz)
    let cardsQuery = supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('deck_id', deckId);

    if (chapterId) {
      cardsQuery = cardsQuery.eq('chapter_id', chapterId);
    } else {
      cardsQuery = cardsQuery.is('chapter_id', null);
    }

    const { count: total, error: cardsError } = await cardsQuery;
    if (cardsError) throw cardsError;

    if (!total || total === 0) {
      return { total: 0, learned: 0, progress: 0 };
    }

    // 2. Sadece "learned" olanların SAYISINI count ile alalım (Veriyi indirmeyiz, limite takılmaz)
    let progressQuery = supabase
      .from('user_card_progress')
      .select('cards!inner(chapter_id, deck_id)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'learned')
      .eq('cards.deck_id', deckId);

    if (chapterId) {
      progressQuery = progressQuery.eq('cards.chapter_id', chapterId);
    } else {
      progressQuery = progressQuery.is('cards.chapter_id', null);
    }

    const { count: learned, error: progressError } = await progressQuery;
    if (progressError) throw progressError;

    const learnedCount = learned || 0;
    const progress = total > 0 ? learnedCount / total : 0;

    return { total, learned: learnedCount, progress };
  } catch (error) {
    console.error('Error getting chapter progress:', error);
    return { total: 0, learned: 0, progress: 0 };
  }
}

/**
 * Get progress for multiple chapters at once (Supports infinite cards via Pagination)
 * @param {Array<{id: string|null}>} chapters - Array of chapters
 * @param {string} deckId - Deck ID
 * @param {string} userId - User ID
 * @returns {Promise<Map<string, {total: number, learned: number, progress: number}>>}
 */
export async function getChaptersProgress(chapters, deckId, userId) {
  const progressMap = new Map();

  try {
    // 1. ADIM: Tüm kartları 1000'erlik paketler halinde çek (Sayfalama)
    let allCards = [];
    let from = 0;
    const step = 1000;
    let hasMoreCards = true;

    while (hasMoreCards) {
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('id, chapter_id')
        .eq('deck_id', deckId)
        .range(from, from + step - 1);

      if (cardsError) throw cardsError;

      if (cardsData && cardsData.length > 0) {
        allCards.push(...cardsData);
      }

      // Gelen veri 1000'den azsa döngüyü kır
      if (!cardsData || cardsData.length < step) {
        hasMoreCards = false;
      } else {
        from += step;
      }
    }

    // Her chapter'daki toplam kart sayısını hesapla
    const chapterTotals = new Map();
    allCards.forEach(card => {
      const key = card.chapter_id || 'unassigned';
      chapterTotals.set(key, (chapterTotals.get(key) || 0) + 1);
    });

    // 2. ADIM: Progress durumlarını da sayfalama ile çek (.in kullanmadan, Join ile)
    let allProgressData = [];
    let progressFrom = 0;
    let hasMoreProgress = true;

    while (hasMoreProgress) {
      const { data: progressData, error: progressError } = await supabase
        .from('user_card_progress')
        .select('status, cards!inner(chapter_id, deck_id)')
        .eq('user_id', userId)
        .in('status', ['learned', 'learning'])
        .eq('cards.deck_id', deckId)
        .range(progressFrom, progressFrom + step - 1);

      if (progressError) throw progressError;

      if (progressData && progressData.length > 0) {
        allProgressData.push(...progressData);
      }

      if (!progressData || progressData.length < step) {
        hasMoreProgress = false;
      } else {
        progressFrom += step;
      }
    }

    // Progress datalarını chapter_id ve status'e göre grupla
    const chapterStats = new Map();
    allProgressData.forEach(p => {
      const chapterId = (Array.isArray(p.cards) ? p.cards[0].chapter_id : p.cards.chapter_id) || 'unassigned';
      
      if (!chapterStats.has(chapterId)) {
        chapterStats.set(chapterId, { learned: 0, learning: 0 });
      }
      
      const stats = chapterStats.get(chapterId);
      if (p.status === 'learned') stats.learned += 1;
      if (p.status === 'learning') stats.learning += 1;
    });

    // 3. İstenen her chapter için map'i oluştur ve eksik statüleri tamamla
    chapters.forEach(ch => {
      const key = ch.id || 'unassigned';
      const total = chapterTotals.get(key) || 0;
      
      const stats = chapterStats.get(key) || { learned: 0, learning: 0 };
      const learned = stats.learned;
      const learning = stats.learning;
      const newCount = total - learned - learning; 
      
      const progress = total > 0 ? learned / total : 0;
      
      progressMap.set(key, { total, learned, learning, new: newCount, progress });
    });

    return progressMap;
  } catch (error) {
    console.error('Error fetching chapters progress:', error);
    chapters.forEach(ch => {
      progressMap.set(ch.id || 'unassigned', { total: 0, learned: 0, learning: 0, new: 0, progress: 0 });
    });
    return progressMap;
  }
}
