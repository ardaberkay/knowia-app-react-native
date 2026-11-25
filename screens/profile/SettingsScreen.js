import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import { scale, moderateScale, verticalScale } from 'react-native-size-matters';
import { useTheme } from '../../theme/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { updateNotificationPreference, clearPushToken } from '../../services/ProfileService';
import { registerForPushNotificationsAsync } from '../../services/NotificationService';
import { getHapticPreference, setHapticPreference, triggerHaptic } from '../../lib/hapticManager';
import LanguageSelector from '../../components/modals/LanguageSelector';
import { ProfileMenuCard } from './ProfileScreen';

const LANGUAGE_FLAGS = {
  tr: ['twemoji:flag-for-flag-turkey', 'Türkçe'],
  en: ['twemoji:flag-england', 'English'],
  es: ['twemoji:flag-spain', 'Spanish'],
  fr: ['twemoji:flag-france', 'French'],
  pt: ['twemoji:flag-portugal', 'Portuguese'],
  de: ['twemoji:flag-germany', 'German'],
};

/**
 * Profile › Settings: language, haptics, notifications.
 * (The dark mode switch is hidden while the app is dark-only; see theme.js.)
 */
export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const authUserId = session?.user?.id;
  const { profile: contextProfile } = useProfile();

  // Haptics
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  useEffect(() => { getHapticPreference().then(setHapticsEnabled); }, []);
  const handleToggleHaptics = async (value) => {
    setHapticsEnabled(value);
    await setHapticPreference(value);
    if (value) triggerHaptic('success');
  };

  // Notifications: on only if the profile wants them and the OS allows them.
  const [notificationsEnabled, setNotificationsEnabled] = useState(!!contextProfile?.notifications_enabled);
  useEffect(() => {
    let active = true;
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (active) setNotificationsEnabled(status === 'granted' && !!contextProfile?.notifications_enabled);
    });
    return () => { active = false; };
  }, [contextProfile?.notifications_enabled]);
  const handleToggleNotifications = async (value) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setNotificationsEnabled(true);
        await updateNotificationPreference(authUserId, true);
        if (authUserId) await registerForPushNotificationsAsync(authUserId);
      } else {
        setNotificationsEnabled(false);
        await updateNotificationPreference(authUserId, false);
        Alert.alert(
          t('profile.notifications'),
          t('notifications.openSettingsHint', 'Bildirimleri açmak için Ayarlar\'a gidin.'),
          [
            { text: t('common.cancel', 'İptal'), style: 'cancel' },
            { text: t('notifications.openSettings', 'Ayarlar'), onPress: () => Linking.openSettings() },
          ]
        );
      }
    } else {
      setNotificationsEnabled(false);
      await updateNotificationPreference(authUserId, false);
      if (authUserId) await clearPushToken(authUserId);
    }
  };

  // Language
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const handleLanguageChange = useCallback(async (lng) => {
    await i18n.changeLanguage(lng);
    setLanguageModalVisible(false);
  }, [i18n]);
  const [flag, languageName] = LANGUAGE_FLAGS[i18n.language] || ['', ''];

  const switchProps = (value) => ({
    trackColor: { false: '#ccc', true: '#5AA3F0' },
    thumbColor: value ? colors.secondary : '#f4f3f4',
    ios_backgroundColor: '#ccc',
  });

  const items = [
    {
      key: 'language',
      label: t('profile.language'),
      onPress: () => {
        triggerHaptic('selection');
        setLanguageModalVisible(true);
      },
      right: (
        <View style={styles.languageRow}>
          {flag ? <Iconify icon={flag} size={moderateScale(20)} /> : null}
          <Text style={{ color: colors.text, fontSize: moderateScale(15) }}>{languageName}</Text>
        </View>
      ),
      chevron: true,
    },
    {
      key: 'haptics',
      label: t('profile.haptics', 'Titreşim'),
      right: <Switch value={hapticsEnabled} onValueChange={handleToggleHaptics} {...switchProps(hapticsEnabled)} />,
    },
    {
      key: 'notifications',
      label: t('profile.notifications'),
      right: (
        <Switch
          value={notificationsEnabled}
          onValueChange={(value) => {
            triggerHaptic('light');
            handleToggleNotifications(value);
          }}
          {...switchProps(notificationsEnabled)}
        />
      ),
    },
  ];

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileMenuCard items={items} colors={colors} />
      </ScrollView>
      <LanguageSelector
        isVisible={languageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
        onLanguageChange={handleLanguageChange}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: scale(14),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(40),
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
});
