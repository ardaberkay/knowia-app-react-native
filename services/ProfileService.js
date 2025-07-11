import { supabase } from '../lib/supabase';

// Aktif kullanıcının profilini getirir
export async function getCurrentUserProfile() {
  // Önce oturumdaki kullanıcıyı al
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Kullanıcı oturumu bulunamadı');

  // profiles tablosundan verileri çek
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, created_at, email, updated_at, image_url, notifications_enabled')
    .eq('id', user.id)
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
export async function updateNotificationPreference(enabled) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return;
  await supabase
    .from('profiles')
    .update({ notifications_enabled: enabled })
    .eq('id', user.id);
}

/**
 * Kullanıcının tema tercih bilgisini getirir.
 * @returns {Promise<'system'|'dark'|'light'>}
 */
export async function getThemePreference() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return 'system';
    const { data, error } = await supabase
      .from('profiles')
      .select('theme_preference')
      .eq('id', user.id)
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
export async function updateThemePreference(preference) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return;
    await supabase
      .from('profiles')
      .update({ theme_preference: preference })
      .eq('id', user.id);
  } catch (e) {
    // Sessizce geç
  }
} 