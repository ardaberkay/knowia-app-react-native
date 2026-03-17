import { supabase } from '../lib/supabase';
import { invalidateCache } from './CacheService';

export async function getCurrentUserProfile(userId) {
  if (!userId) throw new Error('Kullanıcı oturumu bulunamadı');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, created_at, email, updated_at, image_url, notifications_enabled')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Kullanıcının son aktif olduğu zamanı günceller.
 * @param {string} userId - profiles tablosundaki kullanıcı id'si
 */
export async function updateLastActiveAt(userId) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({ last_active_at: now })
    .eq('id', userId);
  if (error) {
    console.error('last_active_at güncellenemedi:', error.message);
  }
}

/**
 * Kullanıcının bildirim tercihlerini günceller.
 * @param {boolean} enabled - Bildirimler açık mı kapalı mı
 */
export async function updateNotificationPreference(userId, enabled) {
  if (!userId) return;
  await supabase
    .from('profiles')
    .update({ notifications_enabled: enabled })
    .eq('id', userId);
}

/**
 * Kullanıcının tema tercih bilgisini getirir.
 * @returns {Promise<'system'|'dark'|'light'>}
 */
export async function getThemePreference(userId) {
  try {
    if (!userId) return 'system';
    const { data, error } = await supabase
      .from('profiles')
      .select('theme_preference')
      .eq('id', userId)
      .single();
    if (error) return 'system';
    return data?.theme_preference || 'system';
  } catch (e) {
    return 'system';
  }
}

/**
 * Kullanıcının tema tercih bilgisini günceller.
 * @param {'system'|'dark'|'light'} preference
 */
export async function updateThemePreference(userId, preference) {
  try {
    if (!userId) return;
    await supabase
      .from('profiles')
      .update({ theme_preference: preference })
      .eq('id', userId);
  } catch (e) {
    // Sessizce geç
  }
}

export async function updateProfile(userId, { username, imageUrl }) {
  if (!userId) throw new Error('userId gerekli');
  const { error } = await supabase
    .from('profiles')
    .update({ username, image_url: imageUrl })
    .eq('id', userId);
  if (error) throw error;
  await invalidateCache(`profile_${userId}`);
  await invalidateCache(`profile_image_${userId}`);
}

export async function clearPushToken(userId) {
  if (!userId) return;
  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: null })
    .eq('id', userId);
  if (error) console.error('Push token temizlenemedi:', error.message);
}