import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { supabase } from '../lib/supabase';
import { invalidateCache, cachedQuery, peekCachedQuery } from './CacheService';
import { STALE } from '../lib/queryClient';
import i18n from '../lib/i18n';

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

// ─── Study activity: daily goal, streak, heatmap ───
//
// Server side: user_daily_activity (one row per user per active day) is
// counted inside the swipe RPCs; get_activity_summary returns today, the
// streak, totals and the last `days` days in one call.
//
// Kept cheap on Supabase's free tier: Home asks for days = 1 (a few hundred
// bytes), only Profile asks for the heatmap. Results are cached on the device
// and refetched only when a study session ends or the day changes.

/**
 * Daily goal presets (swipes per day). `key` names the i18n strings
 * profile.activity.goals.<key>.title / .desc. 50 is the default.
 */
export const DAILY_GOAL_PRESETS = [
  { goal: 20, key: 'warmup' },
  { goal: 50, key: 'steady' },
  { goal: 100, key: 'ambitious' },
  { goal: 150, key: 'legend' },
];
export const DEFAULT_DAILY_GOAL = 50;
/** Range for a goal the user types in ("Kendi hedefim"). */
export const CUSTOM_GOAL_MIN = 5;
export const CUSTOM_GOAL_MAX = 500;
/** Seconds per swipe (read, think, flip, swipe), for the "~10 min" hints. */
export const SECONDS_PER_SWIPE = 12;
export const goalMinutes = (goal) => Math.max(1, Math.round((goal * SECONDS_PER_SWIPE) / 60));

// The local date is part of the key: a summary from an earlier day is never reused.
const activityKey = (userId, days) => `activity_summary_${userId}_${days}_${localDateString()}`;
const TIMEZONE_SYNC_KEY = 'activity_timezone_synced';

/** The device's local date as YYYY-MM-DD (matches the server's `today`). */
export function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** IANA time zone of the device (e.g. Europe/Istanbul), or null. */
export function getDeviceTimeZone() {
  try {
    const fromCalendar = Localization.getCalendars?.()?.[0]?.timeZone;
    if (fromCalendar) return fromCalendar;
  } catch {
    // fall through
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Study summary for the signed-in user.
 * @param {string} userId
 * @param {{ days?: number, force?: boolean }} options days: 1 for Home, 182 for the heatmap.
 * @returns {Promise<object|null>} get_activity_summary's JSON, or null if unavailable.
 */
export async function getActivitySummary(userId, { days = 1, force = false } = {}) {
  if (!userId) return null;
  const key = activityKey(userId, days);
  try {
    // Only our own study sessions / goal changes change it, and they
    // invalidate it (invalidateActivitySummary), so it can stay fresh long.
    return await cachedQuery(key, async () => {
      const { data, error } = await supabase.rpc('get_activity_summary', { p_days: days });
      if (error) throw error;
      return data;
    }, { staleTime: STALE.OWN, force });
  } catch (e) {
    console.error('Aktivite özeti alınamadı:', e?.message || e);
    return peekCachedQuery(key);
  }
}

/** Today's summary as last loaded (no request), or null. Lets a screen show it on the first frame. */
export const peekActivitySummary = (userId, days = 1) => (userId ? peekCachedQuery(activityKey(userId, days)) : null);

/** Drop cached summaries (after a study session or a goal change). */
export async function invalidateActivitySummary(userId) {
  if (!userId) return;
  await invalidateCache(`activity_summary_${userId}_`);
}

/**
 * Saves the device time zone on the server when it differs from the last one
 * sent, so a day is counted in the user's local time. Cheap to call on focus.
 */
export async function syncActivityTimeZone(userId) {
  if (!userId) return;
  const tz = getDeviceTimeZone();
  if (!tz) return;
  try {
    const synced = await AsyncStorage.getItem(TIMEZONE_SYNC_KEY);
    if (synced === `${userId}:${tz}`) return;
    const { error } = await supabase.rpc('set_activity_settings', { p_timezone: tz });
    if (error) throw error;
    await AsyncStorage.setItem(TIMEZONE_SYNC_KEY, `${userId}:${tz}`);
    await invalidateActivitySummary(userId);
  } catch (e) {
    console.error('Saat dilimi kaydedilemedi:', e?.message || e);
  }
}

const LANGUAGE_SYNC_KEY = 'profile_language_synced';

/**
 * Saves the app language on the server (profiles.language) when it differs
 * from the last one sent: study reminders are written in it (Turkish → TR,
 * everything else → EN). Cheap to call on focus.
 */
export async function syncProfileLanguage(userId, language = i18n.language) {
  const lang = String(language || '').toLowerCase().split(/[-_]/)[0];
  if (!userId || !/^[a-z]{2}$/.test(lang)) return;
  try {
    const synced = await AsyncStorage.getItem(LANGUAGE_SYNC_KEY);
    if (synced === `${userId}:${lang}`) return;
    const { error } = await supabase.from('profiles').update({ language: lang }).eq('id', userId);
    if (error) throw error;
    await AsyncStorage.setItem(LANGUAGE_SYNC_KEY, `${userId}:${lang}`);
  } catch (e) {
    if (__DEV__) console.warn('Dil kaydedilemedi:', e?.message || e);
  }
}

/** Sets the daily goal (swipes per day). Throws on failure. */
export async function setDailyGoal(userId, goal) {
  if (!userId) return;
  const { error } = await supabase.rpc('set_activity_settings', { p_daily_goal: goal });
  if (error) throw error;
  await invalidateActivitySummary(userId);
}