import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Alert, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import i18n from '../lib/i18n';

// Hata veren her yerde bunu kullanabilirsin:
import Constants from 'expo-constants';

const projectId = Constants.expoConfig?.extra?.eas?.projectId;
const version = Constants.expoConfig?.version;

/**
 * Kullanıcıdan push bildirim izni alır ve Expo push token'ı Supabase'deki profiles tablosuna kaydeder.
 * @param {string} userId - Supabase profil tablosundaki kullanıcı id'si
 * @returns {Promise<string|null>} - Expo push token veya null
 */

export async function registerForPushNotificationsAsync(userId) {
  let token = null;

  if (!userId) return null;

  // Gerçek cihaz değilse push notification kurulumu yapma.
  // Bu bir hata değil.
  if (!Device.isDevice) {
    return null;
  }

  try {
    // Mevcut izin durumunu kontrol et
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    // Daha önce izin verilmemişse izin iste
    if (existingStatus !== 'granted') {
      const { status } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    // Kullanıcı izin vermediyse sessizce çık.
    // Bu bir hata değildir.
    if (finalStatus !== 'granted') {
      return null;
    }

    // Expo Push Token al
    const options = projectId ? { projectId } : {};

    token = (
      await Notifications.getExpoPushTokenAsync(options)
    ).data;

    // Token sahipliğini backend'de yönet
    const { error } = await supabase.rpc(
      'claim_push_token',
      {
        p_token: token,
      }
    );

    if (error) {
      if (__DEV__) {
        console.warn(
          'Push token claim edilemedi:',
          error.message
        );
      }

      return null;
    }

    return token;
  } catch (e) {
    // Gerçek teknik hatalar burada yakalanır.
    if (__DEV__) {
      console.warn(
        'Push notification kurulumu başarısız:',
        e?.message || e
      );
    }

    return null;
  }
}