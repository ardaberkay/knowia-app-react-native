import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient, invalidateQueriesForCacheKey, clearQueryCache, PERSIST_MAX_AGE } from '../lib/queryClient';

const SWIPE_TUTORIAL_STORAGE_KEY = 'knowia_seen_swipe_tutorial';

// Profile cache (cache-first in ProfileScreen). Lists and the other service
// caches live in TanStack Query: see cachedQuery below and lib/queryClient.js.
export const CACHE_DURATIONS = {
  PROFILE: 7 * 24 * 60 * 60 * 1000,         // 1 hafta (mutation: EditProfile çıkışında)
  PROFILE_IMAGE: 7 * 24 * 60 * 60 * 1000,   // 1 hafta
};

export const hasSeenSwipeTutorial = async () => {
  try {
    return (await AsyncStorage.getItem(SWIPE_TUTORIAL_STORAGE_KEY)) === 'true';
  } catch (error) {
    console.error('Error getting swipe tutorial state:', error);
    return false;
  }
};

export const markSwipeTutorialSeen = async () => {
  try {
    await AsyncStorage.setItem(SWIPE_TUTORIAL_STORAGE_KEY, 'true');
  } catch (error) {
    console.error('Error saving swipe tutorial state:', error);
  }
};

/**
 * Profil bilgilerini cache'le
 * @param {string} userId - Kullanıcı ID'si
 * @param {object} profileData - Profil verisi
 */
export const cacheProfile = async (userId, profileData) => {
  try {
    const cacheKey = `profile_${userId}`;
    const cacheData = {
      data: profileData,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching profile:', error);
  }
};

/**
 * Cache'den profil bilgilerini yükle
 * @param {string} userId - Kullanıcı ID'si
 * @returns {object|null} - Cache'lenmiş profil verisi veya null
 */
export const getCachedProfile = async (userId) => {
  try {
    const cacheKey = `profile_${userId}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    
    if (cached) {
      const cacheData = JSON.parse(cached);
      const cacheAge = Date.now() - (cacheData.timestamp || 0);
      
      // Cache süresi dolmamışsa
      if (cacheAge < CACHE_DURATIONS.PROFILE) {
        return cacheData.data;
      } else {
        // Süresi dolmuşsa cache'i temizle
        await AsyncStorage.removeItem(cacheKey);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cached profile:', error);
    return null;
  }
};

/**
 * Profil görselini cache'le
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} imageUrl - Görsel URL'i
 */
export const cacheProfileImage = async (userId, imageUrl) => {
  try {
    if (!imageUrl) return;
    
    const cacheKey = `profile_image_${userId}`;
    const cacheData = {
      imageUrl: imageUrl,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching profile image:', error);
  }
};

/**
 * Cache'den profil görselini yükle
 * @param {string} userId - Kullanıcı ID'si
 * @returns {string|null} - Cache'lenmiş görsel URL'i veya null
 */
export const getCachedProfileImage = async (userId) => {
  try {
    const cacheKey = `profile_image_${userId}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    
    if (cached) {
      const cacheData = JSON.parse(cached);
      const cacheAge = Date.now() - (cacheData.timestamp || 0);
      
      // Cache süresi dolmamışsa
      if (cacheAge < CACHE_DURATIONS.PROFILE_IMAGE) {
        return cacheData.imageUrl;
      } else {
        // Süresi dolmuşsa cache'i temizle
        await AsyncStorage.removeItem(cacheKey);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cached profile image:', error);
    return null;
  }
};

/**
 * Kullanıcının cache'ini temizle (logout veya profil güncellemesi sonrası)
 * @param {string} userId - Kullanıcı ID'si
 */
export const clearUserCache = async (userId) => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(`profile_${userId}`),
      AsyncStorage.removeItem(`profile_image_${userId}`),
    ]);
  } catch (error) {
    console.error('Error clearing user cache:', error);
  }
};

// ─── Genel Cache Helper'ları ───

/**
 * Read-through cache on TanStack Query (RAM, de-duplicated requests). Fresh
 * data (younger than staleTime) comes back without a request; otherwise
 * fetcher runs. persist = also kept on disk for a cold start (small entry
 * point data only; card lists stay in RAM). invalidateCache(prefix) marks
 * every key starting with prefix stale. A copy is returned, so callers may
 * mutate the result without touching the cache.
 */
export const cachedQuery = async (cacheKey, fetcher, { staleTime, force = false, persist = true } = {}) => {
  const data = await queryClient.fetchQuery({
    queryKey: ['kv', cacheKey],
    queryFn: async () => {
      const result = await fetcher();
      return result === undefined ? null : result;
    },
    staleTime: force ? 0 : staleTime,
    gcTime: persist ? PERSIST_MAX_AGE : undefined,
    meta: persist ? { persist: true } : undefined,
  });
  return data == null ? data : JSON.parse(JSON.stringify(data));
};

/**
 * Mark cachedQuery entries starting with prefix stale (RAM only, no request
 * now): the next read fetches them. For changes that only touch a field shown
 * in cached rows (e.g. a card's favourite / learned state).
 */
export const markCachedQueriesStale = (prefix) => queryClient.invalidateQueries({
  predicate: (q) => q.queryKey[0] === 'kv' && String(q.queryKey[1]).startsWith(String(prefix)),
  refetchType: 'none',
});

/**
 * Change cachedQuery entries starting with prefix in place (no request): for
 * a change we know exactly, e.g. one card's favourite flag. Entries stay
 * fresh, so the next read shows the change without refetching the list.
 */
export const patchCachedQueries = (prefix, updater) => queryClient.setQueriesData(
  { predicate: (q) => q.queryKey[0] === 'kv' && String(q.queryKey[1]).startsWith(String(prefix)) },
  (data) => (data == null ? data : updater(data)),
);

/**
 * What cachedQuery holds for this key right now, fresh or stale, without a
 * request (a copy), or null. Lets a screen show the last list at once and
 * refresh it silently (stale-while-revalidate).
 */
export const peekCachedQuery = (cacheKey) => {
  const data = queryClient.getQueryData(['kv', cacheKey]);
  return data == null ? null : JSON.parse(JSON.stringify(data));
};

/** Drop one cachedQuery entry (e.g. an incomplete answer that must not be reused). */
export const dropCachedQuery = (cacheKey) => queryClient.removeQueries({ queryKey: ['kv', cacheKey], exact: true });


export const invalidateCache = async (keyPrefix) => {
  // Screens on TanStack Query: the matching queries are invalidated too.
  invalidateQueriesForCacheKey(keyPrefix);
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const matching = allKeys.filter(k => k.startsWith(keyPrefix));
    if (matching.length > 0) await AsyncStorage.multiRemove(matching);
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
};

// Every cache key prefix the app writes (user data and shared lists). The
// Supabase session and device settings live under other keys and stay.
const CACHE_KEY_PREFIXES = [
  'cards_', 'card_detail_', 'deck_', 'discover_', 'chapters_', 'fav_', 'blocked_',
  'progress_', 'languages_', 'categories_', 'mydecks_', 'profile_', 'activity_summary_',
];

/** Sign-out / account switch: no list of the previous user may survive (B6). */
export const clearAllCaches = async () => {
  await clearQueryCache();
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const keys = allKeys.filter((k) => CACHE_KEY_PREFIXES.some((p) => k.startsWith(p)));
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.error('Error clearing caches:', error);
  }
};

export const cleanupStaleCache = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k =>
      k.startsWith('cards_') || k.startsWith('deck_') || k.startsWith('discover_') ||
      k.startsWith('chapters_') || k.startsWith('fav_') || k.startsWith('blocked_') ||
      k.startsWith('progress_') || k.startsWith('languages_') || k.startsWith('categories_') ||
      k.startsWith('mydecks_')
    );
    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const keysToRemove = [];
    for (const key of cacheKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        try {
          const { timestamp } = JSON.parse(raw);
          if (Date.now() - timestamp > TWO_WEEKS) keysToRemove.push(key);
        } catch { keysToRemove.push(key); }
      }
    }
    if (keysToRemove.length > 0) await AsyncStorage.multiRemove(keysToRemove);
  } catch (error) {
    console.error('Error cleaning up stale cache:', error);
  }
};
