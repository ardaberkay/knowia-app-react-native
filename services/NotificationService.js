import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Alert, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import i18n from '../lib/i18n';

const projectId = require('../app.json')?.expo?.extra?.eas?.projectId ?? null;


/**
 * Kullanıcıdan push bildirim izni alır ve Expo push token'ı Supabase'deki profiles tablosuna kaydeder.
 * @param {string} userId - Supabase profil tablosundaki kullanıcı id'si
 * @returns {Promise<string|null>} - Expo push token veya null
 */
export async function registerForPushNotificationsAsync(userId) {
  let token = null;

  // Sadece gerçek cihazda çalışır, emulator/simülatörde çalışmaz!
  if (!Device.isDevice) {
    Alert.alert(
      i18n.t('common.error', 'Hata'),
      i18n.t('notifications.errorMessageNotificationDevice', 'Push bildirimleri için gerçek bir cihaz gereklidir.')
    );
    return null;
  }

  // Bildirim izni kontrolü ve isteği
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    Alert.alert(
      i18n.t('common.error', 'Hata'),
      i18n.t('notifications.errorMessageNotification', 'Push bildirim izni verilmedi!') +
        ' ' +
        i18n.t('notifications.openSettingsHint', 'Açmak için Ayarlar\'a gidin.'),
      [
        { text: i18n.t('common.cancel', 'İptal'), style: 'cancel' },
        { text: i18n.t('notifications.openSettings', 'Ayarlar'), onPress: () => Linking.openSettings() },
      ]
    );
    return null;
  }

  try {
    const options = projectId ? { projectId } : {};
    token = (await Notifications.getExpoPushTokenAsync(options)).data;
  } catch (e) {
    if (__DEV__) {
      console.warn('Push token alınamadı (dev build veya push yapılandırması eksik olabilir):', e?.message || e);
    }
    return null;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', userId);

  if (error) {
    console.error('Push token kaydedilemedi:', error.message);
    return null;
  }

  return token;
} 