import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache süreleri (milisaniye)
const CACHE_DURATIONS = {
  PROFILE: 30 * 60 * 1000, // 30 dakika
  PROFILE_IMAGE: 7 * 24 * 60 * 60 * 1000, // 7 gün (görseller daha az değişir)
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
