import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAPTIC_STORAGE_KEY = '@knowia_haptics_enabled';

// The preference is read from storage once and then kept in memory:
// triggerHaptic runs on every swipe and carousel step, and a storage read
// (plus JSON parse) each time kept the JS thread busy during gestures.
let cachedPreference = null;

/**
 * Kullanıcının titreşim tercihini okur.
 * Varsayılan olarak (daha önce ayarlanmamışsa) true döner.
 */
export const getHapticPreference = async () => {
  if (cachedPreference !== null) return cachedPreference;
  try {
    const value = await AsyncStorage.getItem(HAPTIC_STORAGE_KEY);
    cachedPreference = value !== null ? JSON.parse(value) : true; // İlk açılışta varsayılan olarak açık
  } catch (error) {
    console.error('Titreşim ayarı okunurken hata:', error);
    return true;
  }
  return cachedPreference;
};

/**
 * Kullanıcının titreşim tercihini kaydeder.
 */
export const setHapticPreference = async (isEnabled) => {
  cachedPreference = isEnabled;
  try {
    await AsyncStorage.setItem(HAPTIC_STORAGE_KEY, JSON.stringify(isEnabled));
  } catch (error) {
    console.error('Titreşim ayarı kaydedilirken hata:', error);
  }
};

/**
 * Ayar açıksa belirtilen stilde titreşimi tetikler.
 * @param {string} style - 'light', 'medium', 'heavy', 'success', 'warning', 'error'
 */
export const triggerHaptic = async (style = 'light') => {
  const isEnabled = cachedPreference ?? await getHapticPreference();
  
  // Eğer kullanıcı ayarlardan titreşimi kapattıysa hiçbir şey yapmadan çık
  if (!isEnabled) return; 

  try {
    switch (style) {
      case 'selection':
        await Haptics.selectionAsync();
        break;
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      default:
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch (error) {
    console.error('Titreşim tetiklenirken hata:', error);
  }
};