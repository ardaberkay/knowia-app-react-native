import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Share, Switch } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { getCurrentUserProfile, updateNotificationPreference } from '../services/ProfileService';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ProfileSkeleton } from '../components/DeckSkeleton';

export default function ProfileScreen() {
  const { colors, isDarkMode, toggleTheme, themePreference, loading: themeLoading } = useTheme();
  const navigation = useNavigation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [userId, setUserId] = useState(null);
  const { logout } = useAuth();

  useEffect(() => {
    const checkNotificationStatus = async () => {
      try {
        setLoading(true);
        const profile = await getCurrentUserProfile();
        setProfile(profile);
        setUserId(profile.id);
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'granted' && profile.notifications_enabled) {
          setNotificationsEnabled(true);
        } else {
          setNotificationsEnabled(false);
        }
      } catch (e) {
        setNotificationsEnabled(false);
        setError('Profil yüklenemedi');
      } finally {
        setLoading(false);
      }
    };
    checkNotificationStatus();
  }, []);

  const handleInviteFriends = async () => {
    try {
      await Share.share({
        message: 'Bilgi evreninde öğrenme yolunu Knowia ile bul! Ücretsiz kaydol: https://seninuygulaman.com/davet',
      });
    } catch (error) {
      // Paylaşım iptal edildiyse veya hata olursa sessiz geç
    }
  };

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

  // Menü kategorileri
  const accountItems = [
    { label: 'Profili Düzenle', onPress: () => navigation.navigate('EditProfile') },
    { label: 'Arkadaşlarını Davet Et', onPress: handleInviteFriends },
  ];
  const appSettingsItems = [
    {
      label: 'Gece Modu',
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
    { label: 'Dil Ayarları', onPress: () => alert('Dil Ayarları') },
    {
      label: 'Bildirimlere İzin Ver',
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
  ];
  const infoItems = [
    { label: 'Hakkımızda', onPress: () => alert('Hakkımızda') },
    { label: 'Geri Bildirim Gönder', onPress: () => alert('Geri Bildirim Gönder') },
    { label: 'Hükümler ve Politikalar', onPress: () => alert('Hükümler ve Politikalar') },
  ];

  const handleLogout = async () => {
    try {
      const { error } = await logout();
      if (error) throw error;
    } catch (error) {
      alert('Çıkış yapılırken bir hata oluştu');
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
          <Text style={[typography.styles.body, { color: colors.error }]}>Hata: {error}</Text>
        ) : profile ? (
          <>
            <Image source={
              profile.image_url
                ? { uri: profile.image_url }
                : require('../assets/avatar-default.png')
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
          {renderMenuSection('Hesap', accountItems)}
          {renderMenuSection('Uygulama Ayarları', appSettingsItems)}
          {renderMenuSection('Bilgi & Destek', infoItems)}
        </View>
        {/* Alt butonlar yan yana */}
        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Text style={[typography.styles.button, { color: colors.error }, styles.deleteText]}>Hesabı Sil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={[typography.styles.button, { color: colors.buttonText }, styles.logoutText]}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
}); 