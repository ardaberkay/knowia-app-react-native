import { supabase } from '../lib/supabase';
import { cacheData, getCachedData, invalidateCache, CACHE_DURATIONS } from './CacheService';

/**
 * Engellenen kullanıcı ID'lerini döndürür (blocker_id = userId).
 */
export const getBlockedUserIds = async (userId) => {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId);
  if (error) throw error;
  return new Set((data || []).map((row) => row.blocked_id));
};

/**
 * Gizlenen deste ID'lerini döndürür.
 */
export const getHiddenDeckIds = async (userId) => {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('user_hidden_decks')
    .select('deck_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map((row) => row.deck_id));
};

/**
 * Blocked + Hidden ID'lerini cache'li getir (24 saat TTL).
 */
export const getCachedBlockedAndHidden = async (userId) => {
  if (!userId) return [new Set(), new Set()];
  const cacheKey = `blocked_hidden_${userId}`;
  const cached = await getCachedData(cacheKey, CACHE_DURATIONS.BLOCKED_HIDDEN);
  if (cached && !cached.isStale) {
    return [new Set(cached.data.blocked), new Set(cached.data.hidden)];
  }
  const [blocked, hidden] = await Promise.all([getBlockedUserIds(userId), getHiddenDeckIds(userId)]);
  await cacheData(cacheKey, { blocked: [...blocked], hidden: [...hidden] });
  return [blocked, hidden];
};

export const blockUser = async (blockerId, blockedId) => {
  if (!blockerId || !blockedId) return;
  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
  await invalidateCache(`blocked_hidden_${blockerId}`);
};

export const unblockUser = async (blockerId, blockedId) => {
  if (!blockerId || !blockedId) return;
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw error;
  await invalidateCache(`blocked_hidden_${blockerId}`);
};

export const hideDeck = async (userId, deckId) => {
  if (!userId || !deckId) return;
  const { error } = await supabase
    .from('user_hidden_decks')
    .insert({ user_id: userId, deck_id: deckId });
  if (error) throw error;
  await invalidateCache(`blocked_hidden_${userId}`);
};

export const unhideDeck = async (userId, deckId) => {
  if (!userId || !deckId) return;
  const { error } = await supabase
    .from('user_hidden_decks')
    .delete()
    .eq('user_id', userId)
    .eq('deck_id', deckId);
  if (error) throw error;
  await invalidateCache(`blocked_hidden_${userId}`);
};

/**
 * Bu hedef için kullanıcının daha önce seçtiği şikayet sebeplerini döndürür (reason sütununda text olarak saklanıyor).
 * Aynı madde ile tekrar şikayet engellemek için kullanılır.
 * @param {string} reporterId - profiles.id
 * @param {string} reportType - 'user' | 'deck' | 'card'
 * @param {string} targetId - Hedef id
 * @returns {Promise<string[]>} - reason değerleri (kod veya 'other')
 */
export const getMyReportReasonCodesForTarget = async (reporterId, reportType, targetId) => {
  if (!reporterId || !reportType || !targetId) return [];
  const { data, error } = await supabase
    .from('reports')
    .select('reason')
    .eq('reporter_id', reporterId)
    .eq('report_type', reportType)
    .eq('target_id', targetId);
  if (error) throw error;
  return (data || [])
    .map((r) => {
      if (!r.reason) return null;
      if (r.reason === 'other' || r.reason.startsWith('other:')) return 'other';
      return r.reason;
    })
    .filter(Boolean);
};

/**
 * Kullanıcıyı şikayet et. reason sütununa sebep kodu (text) yazılır; 'other' ise "other: açıklama" saklanır.
 */
export const reportUser = async (reporterId, targetUserId, reasonCode, reasonText) => {
  if (!reporterId || !targetUserId || !reasonCode) return;
  const reason = reasonCode === 'other' && reasonText
    ? `other: ${reasonText}`
    : reasonCode;
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    report_type: 'user',
    target_id: targetUserId,
    reason,
  });
  if (error) throw error;
};

/**
 * Desteyi şikayet et.
 */
export const reportDeck = async (reporterId, deckId, reasonCode, reasonText) => {
  if (!reporterId || !deckId || !reasonCode) return;
  const reason = reasonCode === 'other' && reasonText
    ? `other: ${reasonText}`
    : reasonCode;
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    report_type: 'deck',
    target_id: deckId,
    reason,
  });
  if (error) throw error;
};

/**
 * Kartı şikayet et.
 */
export const reportCard = async (reporterId, cardId, reasonCode, reasonText) => {
  if (!reporterId || !cardId || !reasonCode) return;
  const reason = reasonCode === 'other' && reasonText
    ? `other: ${reasonText}`
    : reasonCode;
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    report_type: 'card',
    target_id: cardId,
    reason,
  });
  if (error) throw error;
};

export function filterDecksByBlockAndHide(decks, blockedIds, hiddenIds) {
  return decks.filter((d) => !blockedIds.has(d.user_id) && !hiddenIds.has(d.id));
}
