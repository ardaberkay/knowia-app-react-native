import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Share, Switch, Alert, Linking } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { getCurrentUserProfile, updateNotificationPreference } from '../../services/ProfileService';
import { registerForPushNotificationsAsync } from '../../services/NotificationService';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { cacheProfile, getCachedProfile, cacheProfileImage } from '../../services/CacheService';
import ProfileSkeleton from '../../components/skeleton/ProfileSkeleton';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../../components/modals/LanguageSelector';
import { Iconify } from 'react-native-iconify';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { scale, moderateScale, verticalScale } from 'react-native-size-matters';
import * as WebBrowser from 'expo-web-browser';
import { getHapticPreference, setHapticPreference, triggerHaptic } from '../../lib/hapticManager';


export default function ProfileScreen() {
  const { colors, isDarkMode, toggleTheme, themePreference, loading: themeLoading } = useTheme();
  const navigation = useNavigation();
  const { profile: contextProfile } = useProfile();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(contextProfile?.notifications_enabled ?? false);
  const [userId, setUserId] = useState(null);
  const { logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);
  const { showSuccess, showError } = useSnackbarHelpers();
  const isInitialMount = useRef(true);
  const shouldRefreshOnFocus = useRef(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  //haptic ayarlarını yükle
  useEffect(() => {
    const loadHaptics = async () => {
      const isEnabled = await getHapticPreference();
      setHapticsEnabled(isEnabled);
    };
    loadHaptics();
  }, []);

  //haptic ayarlarını değiştir
  const handleToggleHaptics = async (value) => {
    setHapticsEnabled(value);
    await setHapticPreference(value);
    
    // Kullanıcı titreşimi açtığında çalıştığını hissettir
    if (value) {
      triggerHaptic('success'); 
    }
  };

  // Profil yükleme fonksiyonu
  const loadProfile = useCallback(async (useCache = true) => {
    try {
      setLoading(true);
      setError(null);

      // Önce kullanıcı ID'sini al
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setError(t('profile.errorMessageProfile'));
        return;
      }

      // Cache kullanılacaksa önce cache'den yükle
      if (useCache) {
        const cachedProfile = await getCachedProfile(user.id);
        if (cachedProfile) {
          setProfile(cachedProfile);
          setUserId(cachedProfile.id);

          // Bildirim durumunu kontrol et
          const { status } = await Notifications.getPermissionsAsync();
          if (status === 'granted' && cachedProfile.notifications_enabled) {
            setNotificationsEnabled(true);
          } else {
            setNotificationsEnabled(false);
          }

          setLoading(false);

          // Arka planda güncel veriyi çek ve cache'le
          try {
            const freshProfile = await getCurrentUserProfile();
            setProfile(freshProfile);
            setUserId(freshProfile.id);
            await cacheProfile(user.id, freshProfile);

            // Profil görselini de cache'le
            if (freshProfile?.image_url) {
              await cacheProfileImage(user.id, freshProfile.image_url);
            }

            // Bildirim durumunu güncelle
            const { status: freshStatus } = await Notifications.getPermissionsAsync();
            if (freshStatus === 'granted' && freshProfile.notifications_enabled) {
              setNotificationsEnabled(true);
            } else {
              setNotificationsEnabled(false);
            }
          } catch (err) {
            // Hata durumunda cache'deki veriyi kullanmaya devam et
            console.error('Error fetching fresh profile:', err);
          }
          return;
        }
      }

      // Cache yoksa veya cache kullanılmayacaksa API'den çek
      const profile = await getCurrentUserProfile();
      setProfile(profile);
      setUserId(profile.id);

      // Cache'le
      await cacheProfile(user.id, profile);
      if (profile?.image_url) {
        await cacheProfileImage(user.id, profile.image_url);
      }

      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted' && profile.notifications_enabled) {
        setNotificationsEnabled(true);
      } else {
        setNotificationsEnabled(false);
      }
    } catch (e) {
      setNotificationsEnabled(false);
      setError(t('profile.errorMessageProfile'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Context'teki profil yüklendiğinde bildirim değerini senkronize et (ilk açılışta animasyonu önlemek için)
  useEffect(() => {
    if (contextProfile != null) {
      setNotificationsEnabled(!!contextProfile.notifications_enabled);
    }
  }, [contextProfile?.notifications_enabled]);

  // İlk yükleme - cache kullan
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadProfile(true);
    }
  }, [loadProfile]);

  // EditProfileScreen'den geri gelindiğinde yenile
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // İlk mount'ta çalışmasın
      if (isInitialMount.current) {
        return;
      }

      // Sadece EditProfileScreen'den gelindiğinde yenile
      if (shouldRefreshOnFocus.current) {
        shouldRefreshOnFocus.current = false;
        loadProfile(false);
      }
    });

    return unsubscribe;
  }, [navigation, loadProfile]);

  const handleInviteFriends = useCallback(async () => {
    try {
      await Share.share({
        message: t('profile.inviteMessage', 'Bilgi evreninde öğrenme yolunu Knowia ile bul! Ücretsiz kaydol:') + 'https://seninuygulaman.com/davet',
      });
    } catch (error) {
      // Paylaşım iptal edildiyse veya hata olursa sessiz geç
    }
  }, [t]);

  const handleToggleNotifications = async (value) => {
    if (value) {
      // Switch açılıyorsa izin iste
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setNotificationsEnabled(true);
        await updateNotificationPreference(true);
        const uid = userId || (await supabase.auth.getUser()).data?.user?.id;
        if (uid) {
          await registerForPushNotificationsAsync(uid);
        }
      } else {
        setNotificationsEnabled(false);
        await updateNotificationPreference(false);
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
      await updateNotificationPreference(false);
      // Token'ı Supabase'den sil
      if (userId) {
        await supabase
          .from('profiles')
          .update({ expo_push_token: null })
          .eq('id', userId);
      }
    }
  };

  const handleLanguageChange = useCallback(async (lng) => {
    await i18n.changeLanguage(lng);
    setLanguageModalVisible(false);
  }, [i18n]);

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const callEdgeFunction = useCallback(async (functionName) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      showError(t('profile.deleteDeactivateError', 'İşlem sırasında bir hata oluştu'));
      return false;
    }
    const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || res.statusText);
    }
    return true;
  }, [showError, t]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t('profile.deleteAccountTitle'),
      t('profile.deleteAccountIrreversible'),
      [
        { text: t('library.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('profile.deleteAccountConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              const ok = await callEdgeFunction('delete-account');
              if (ok) {
                showSuccess(t('profile.deleteSuccess'));
                await logout();
              }
            } catch (e) {
              showError(t('profile.deleteDeactivateError'));
            }
          },
        },
      ]
    );
  }, [t, callEdgeFunction, showSuccess, showError, logout]);

  // Menü kategorileri
  const accountItems = useMemo(() => [
    {
      label: t('profile.edit'),
      onPress: () => {
        shouldRefreshOnFocus.current = true;
        navigation.navigate('EditProfile');
      }
    },
    { label: t('profile.invite'), onPress: handleInviteFriends },
  ], [t, navigation, handleInviteFriends]);

  const appSettingsItems = useMemo(() => [
    {
      label: t('profile.night_mode'),
      right: (
        <TouchableOpacity onPress={toggleTheme} style={{ flexDirection: 'row', alignItems: 'center' }}>

          <View style={{ width: scale(40) }}>
            <Switch
              value={themePreference === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: '#ccc', true: '#5AA3F0' }}
              thumbColor={isDarkMode ? colors.secondary : '#f4f3f4'}
              ios_backgroundColor="#ccc"
              disabled={themePreference === 'system'}
            />
          </View>
        </TouchableOpacity>
      ),
      onPress: toggleTheme,
    },
    {
      label: t('profile.language'),
      onPress: () => setLanguageModalVisible(true),
      right: (
        <View style={styles.languageRow}>
          <Iconify icon={i18n.language === 'tr' ? 'twemoji:flag-for-flag-turkey' : i18n.language === 'en' ? 'twemoji:flag-england' : i18n.language === 'es' ? 'twemoji:flag-spain' : i18n.language === 'fr' ? 'twemoji:flag-france' : i18n.language === 'pt' ? 'twemoji:flag-portugal' : i18n.language === 'de' ? 'twemoji:flag-germany' : ''} size={moderateScale(20)} />
          <Text style={{ color: colors.text, marginRight: scale(8), fontSize: moderateScale(15) }}>
            {i18n.language === 'tr' ? 'Türkçe' : i18n.language === 'en' ? 'English' : i18n.language === 'es' ? 'Spanish' : i18n.language === 'fr' ? 'French' : i18n.language === 'pt' ? 'Portuguese' : i18n.language === 'de' ? 'German' : ''}
          </Text>
        </View>
      ),
    },
    {
      label: t('profile.haptics', 'Titreşim'), 
      right: (
        <View style={{ width: scale(40) }}>
          <Switch
            value={hapticsEnabled}
            onValueChange={handleToggleHaptics}
            trackColor={{ false: '#ccc', true: '#5AA3F0' }} 
            thumbColor={isDarkMode ? colors.secondary : '#f4f3f4'}
            ios_backgroundColor="#ccc"
          />
        </View>
      ),
      onPress: () => handleToggleHaptics(!hapticsEnabled), 
    },
    {
      label: t('profile.notifications'),
      right: (
        <Switch
          value={notificationsEnabled}
          onValueChange={handleToggleNotifications}
          trackColor={{ false: '#ccc', true: '#5AA3F0' }}
          thumbColor={notificationsEnabled ? colors.secondary : '#f4f3f4'}
          ios_backgroundColor="#ccc"
        />
      ),
      onPress: () => { },
    },
  ], [t, toggleTheme, themePreference, isDarkMode, colors, i18n.language, notificationsEnabled, handleToggleNotifications]);

  const openLink = useCallback(async (url) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: colors.buttonColor,
        enableBarCollapsing: true,
      });
    } catch (err) {
      showError(t('profile.linkError', 'Link açılamadı'));
    }
  }, [colors.buttonColor, showError, t]);

  const PROFILE_LINKS = {
    about: 'https://www.knowia.online/about',
    privacy: 'https://www.knowia.online/policy',
    terms: 'https://www.knowia.online/terms',
    feedback: 'https://www.knowia.online/contact',
  };

  const infoItems = useMemo(() => [
    { label: t('profile.about'), onPress: () => openLink(PROFILE_LINKS.about) },
    { label: t('profile.privacy'), onPress: () => openLink(PROFILE_LINKS.privacy) },
    { label: t('profile.terms'), onPress: () => openLink(PROFILE_LINKS.terms) },
    { label: t('profile.feedback'), onPress: () => openLink(PROFILE_LINKS.feedback) },
  ], [t, openLink]);

  const handleLogout = async () => {
    try {
      const { error } = await logout();
      if (error) throw error;
    } catch (error) {
      showError(t('profile.logoutError', 'Çıkış yapılırken bir hata oluştu'));
    }
  };

  // Kategori render fonksiyonu
  const renderMenuSection = (title, items) => (
    <View style={styles.menuSection}>
      <Text style={[typography.styles.subtitle, { color: colors.buttonColor }, styles.sectionTitle]}>{title}</Text>
      {items.map((item, idx) => (
        <TouchableOpacity key={idx} style={styles.menuItem} onPress={item.onPress} activeOpacity={item.right ? 1 : 0.2}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[typography.styles.body, { color: colors.text }, styles.menuText]}>{item.label}</Text>
            {item.right ? item.right : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sabit profil alanı */}
      <View style={styles.profileRow}>
        {(loading || themeLoading) ? (
          <ProfileSkeleton />
        ) : error ? (
          <Text style={[typography.styles.body, { color: colors.error }]}>{t('profile.error', 'Hata')}: {error}</Text>
        ) : profile ? (
          <>
            <Image source={
              profile.image_url
                ? { uri: profile.image_url }
                : require('../../assets/avatar-default.png')
            } style={styles.avatar} />
            <View style={styles.userInfo}>
              <Text style={[typography.styles.h2, { color: colors.text }, styles.name]}>{profile.username}</Text>
              <Text style={[typography.styles.body, { color: colors.subtext }, styles.email]}>{profile.email}</Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Scrollable alan: menü + alt butonlar */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.menuList}>
          {renderMenuSection(t('profile.account'), accountItems)}
          {renderMenuSection(t('profile.settings'), appSettingsItems)}
          {renderMenuSection(t('profile.info'), infoItems)}
        </View>
        {/* Alt butonlar */}
        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={[typography.styles.button, { color: colors.buttonText }, styles.logoutText]}>{t('profile.logout')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.deleteAccountButton, { borderColor: colors.error || '#ff5252' }]} onPress={handleDeleteAccount}>
            <Text style={[typography.styles.body, { color: colors.error || '#ff5252' }, styles.deleteAccountText]}>{t('profile.deleteAccount')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {/* Dil seçici component */}
      <LanguageSelector
        isVisible={isLanguageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
        onLanguageChange={handleLanguageChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(80),
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: '25%',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  avatar: {
    width: scale(80),
    height: scale(80),
    borderRadius: moderateScale(99),
    marginRight: scale(20),
  },
  userInfo: {
    flex: 1,
  },
  name: {
    marginBottom: verticalScale(4),
  },
  email: {},
  menuList: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  menuSection: {
    marginBottom: verticalScale(18),
  },
  sectionTitle: {
    marginBottom: verticalScale(6),
    marginLeft: scale(2),
  },
  menuItem: {
    paddingVertical: verticalScale(14),
    borderBottomWidth: moderateScale(1),
    borderBottomColor: '#eee',
  },
  menuText: {},
  bottomButtonsRow: {
    marginTop: verticalScale(16),
    marginBottom: verticalScale(32),
  },
  logoutButton: {
    backgroundColor: '#ff5252',
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(999),
  },
  logoutText: {
    textAlign: 'center',
  },
  deleteAccountButton: {
    marginTop: verticalScale(12),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(999),
    borderWidth: moderateScale(1),
    alignItems: 'center',
  },
  deleteAccountText: {
    textAlign: 'center',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
}); 