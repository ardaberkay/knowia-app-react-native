import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Share, Switch } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { getCurrentUserProfile, updateNotificationPreference } from '../../services/ProfileService';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { cacheProfile, getCachedProfile, cacheProfileImage, getCachedProfileImage } from '../../services/CacheService';
import ProfileSkeleton from '../../components/skeleton/ProfileSkeleton';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../../components/modals/LanguageSelector';
import { Iconify } from 'react-native-iconify';

export default function ProfileScreen() {
  const { colors, isDarkMode, toggleTheme, themePreference, loading: themeLoading } = useTheme();
  const navigation = useNavigation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [userId, setUserId] = useState(null);
  const { logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);

  useEffect(() => {
    const checkNotificationStatus = async () => {
      try {
        setLoading(true);
        
        // Önce kullanıcı ID'sini al
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
          setError(t('profile.errorMessageProfile', 'Profil yüklenemedi'));
          return;
        }
        
        // Cache'den profil bilgilerini yükle
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
        
        // Cache yoksa API'den çek
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
        setError(t('profile.errorMessageProfile', 'Profil yüklenemedi'));
      } finally {
        setLoading(false);
      }
    };
    checkNotificationStatus();
  }, []);

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
        // Token kaydetme fonksiyonunu çağırabilirsin (isteğe bağlı)
      } else {
        setNotificationsEnabled(false);
        await updateNotificationPreference(false);
        // Token silmeye gerek yok, çünkü izin yoksa token alınamaz
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

  // Menü kategorileri
  const accountItems = useMemo(() => [
    { label: t('profile.edit'), onPress: () => navigation.navigate('EditProfile') },
    { label: t('profile.invite'), onPress: handleInviteFriends },
  ], [t, navigation, handleInviteFriends]);

  const appSettingsItems = useMemo(() => [
    {
      label: t('profile.night_mode'),
      right: (
        <TouchableOpacity onPress={toggleTheme} style={{ flexDirection: 'row', alignItems: 'center' }}>

          <View style={{ width: 40 }}>
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
          <Iconify icon={i18n.language === 'tr' ? 'twemoji:flag-for-flag-turkey' : i18n.language === 'en' ? 'twemoji:flag-england' : i18n.language === 'es' ? 'twemoji:flag-spain' : i18n.language === 'fr' ? 'twemoji:flag-france' : i18n.language === 'pt' ? 'twemoji:flag-portugal' : i18n.language === 'ar' ? 'twemoji:flag-saudi-arabia' : ''} size={20} />
        <Text style={{ color: colors.text, marginRight: 8, fontSize: 15 }}>
          {i18n.language === 'tr' ? 'Türkçe' : i18n.language === 'en' ? 'English' : i18n.language === 'es' ? 'Spanish' : i18n.language === 'fr' ? 'French' : i18n.language === 'pt' ? 'Portuguese' : i18n.language === 'ar' ? 'Arabic' : ''}
        </Text>
        </View>
      ),
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
      onPress: () => {},
    },
  ], [t, toggleTheme, themePreference, isDarkMode, colors, i18n.language, notificationsEnabled, handleToggleNotifications]);

  const infoItems = useMemo(() => [
    { label: t('profile.about'), onPress: () => alert(t('profile.about')) },
    { label: t('profile.feedback'), onPress: () => alert(t('profile.feedback')) },
    { label: t('profile.terms'), onPress: () => alert(t('profile.terms')) },
  ], [t]);

  const handleLogout = async () => {
    try {
      const { error } = await logout();
      if (error) throw error;
    } catch (error) {
      alert(t('profile.logoutError', 'Çıkış yapılırken bir hata oluştu'));
    }
  };

  const handleDeleteAccount = () => {
    alert('Hesap silindi!');
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
        {/* Alt butonlar yan yana */}
        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Text style={[typography.styles.button, { color: colors.error }, styles.deleteText]}>{t('profile.delete')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={[typography.styles.button, { color: colors.buttonText }, styles.logoutText]}>{t('profile.logout')}</Text>
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
    paddingHorizontal: 24,
    paddingTop: 80,
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
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 20,
  },
  userInfo: {
    flex: 1,
  },
  name: {
    marginBottom: 4,
  },
  email: {},
  menuList: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  menuSection: {
    marginBottom: 18,
  },
  sectionTitle: {
    marginBottom: 6,
    marginLeft: 2,
  },
  menuItem: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuText: {},
  bottomButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 32,
    gap: 12,
  },
  deleteButton: {
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ff5252',
    flex: 1,
  },
  deleteText: {
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: '#ff5252',
    paddingVertical: 12,
    borderRadius: 24,
    flex: 1,
    marginLeft: 12,
  },
  logoutText: {
    textAlign: 'center',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
}); 