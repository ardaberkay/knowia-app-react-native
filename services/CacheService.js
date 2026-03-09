import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache süreleri (milisaniye)
export const CACHE_DURATIONS = {
  // Referans veriler
  LANGUAGES: 7 * 24 * 60 * 60 * 1000,       // 1 hafta
  CATEGORIES: 7 * 24 * 60 * 60 * 1000,      // 1 hafta

  // Profil
  PROFILE: 7 * 24 * 60 * 60 * 1000,         // 1 hafta (mutation: EditProfile çıkışında)
  PROFILE_IMAGE: 7 * 24 * 60 * 60 * 1000,   // 1 hafta

  // Engel/Gizli
  BLOCKED_HIDDEN: 24 * 60 * 60 * 1000,      // 24 saat (mutation: engel/gizle aksiyonunda)

  // Paylaşılan içerik
  DISCOVER: 4 * 60 * 60 * 1000,             // 4 saat (pull-to-refresh bypass)
  DECK_LIST: 4 * 60 * 60 * 1000,            // 4 saat (pull-to-refresh bypass)
  DECK_DETAIL: 4 * 60 * 60 * 1000,          // 4 saat (mutation: kendi destesinde düzenleme)
  CARDS_CONTENT: 4 * 60 * 60 * 1000,        // 4 saat (mutation: kendi destesinde CRUD)
  CARD_DETAIL: 4 * 60 * 60 * 1000,          // 4 saat (mutation: kart düzenleme/silme)
  CHAPTERS: 4 * 60 * 60 * 1000,             // 4 saat (mutation: chapter CRUD)

  // Kullanıcıya özel
  FAVORITES_DECK_IDS: 4 * 60 * 60 * 1000,   // 4 saat (mutation: favori toggle)
  FAVORITES_CARD_IDS: 4 * 60 * 60 * 1000,   // 4 saat (mutation: favori toggle)

  // Destelerim listesi (mutation: yeni deste, düzenleme, silme, paylaşım)
  MY_DECKS: 7 * 24 * 60 * 60 * 1000,       // 1 hafta
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

/**
 * Discover deck verilerini cache'le
 * @param {string} tab - Tab adı (trend, favorites, starts, unique, new)
 * @param {string} timeFilter - Zaman filtresi (all, today, week, month, year)
 * @param {array} decks - Deck verileri
 */
export const cacheDiscoverDecks = async (tab, timeFilter, decks) => {
  try {
    const cacheKey = `discover_${tab}_${timeFilter}`;
    const cacheData = {
      data: decks,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching discover decks:', error);
  }
};

/**
 * Cache'den discover deck verilerini yükle
 * @param {string} tab - Tab adı (trend, favorites, starts, unique, new)
 * @param {string} timeFilter - Zaman filtresi (all, today, week, month, year)
 * @returns {object|null} - Cache'lenmiş deck verileri ve timestamp veya null
 */
export const getCachedDiscoverDecks = async (tab, timeFilter) => {
  try {
    const cacheKey = `discover_${tab}_${timeFilter}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    
    if (cached) {
      const cacheData = JSON.parse(cached);
      const cacheAge = Date.now() - (cacheData.timestamp || 0);
      
      // Cache süresi dolmamışsa (stale data bile kabul edilebilir)
      if (cacheAge < CACHE_DURATIONS.DISCOVER) {
        return {
          data: cacheData.data,
          timestamp: cacheData.timestamp,
          isStale: false,
        };
      } else {
        // Süresi dolmuş ama stale-while-revalidate için kullanılabilir
        return {
          data: cacheData.data,
          timestamp: cacheData.timestamp,
          isStale: true,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cached discover decks:', error);
    return null;
  }
};

/**
 * Discover deck cache'ini temizle (belirli tab ve timeFilter için)
 * @param {string} tab - Tab adı (trend, favorites, starts, unique, new)
 * @param {string} timeFilter - Zaman filtresi (all, today, week, month, year)
 */
export const clearDiscoverDecksCache = async (tab, timeFilter) => {
  try {
    const cacheKey = `discover_${tab}_${timeFilter}`;
    await AsyncStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Error clearing discover decks cache:', error);
  }
};

// ─── Genel Cache Helper'ları ───

export const cacheData = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (error) {
    console.error('Error caching data:', error);
  }
};

export const getCachedData = async (key, ttl) => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    if (age < ttl) return { data, isStale: false };
    if (age < ttl * 2) return { data, isStale: true };
    await AsyncStorage.removeItem(key);
    return null;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
};

export const invalidateCache = async (keyPrefix) => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const matching = allKeys.filter(k => k.startsWith(keyPrefix));
    if (matching.length > 0) await AsyncStorage.multiRemove(matching);
  } catch (error) {
    console.error('Error invalidating cache:', error);
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
