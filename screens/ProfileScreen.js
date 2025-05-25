import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Share } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { getCurrentUserProfile } from '../services/ProfileService';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getCurrentUserProfile();
        setProfile(data);
      } catch (err) {
        setError(err.message || 'Profil yüklenemedi');
      } finally {
        setLoading(false);
      }
    })();
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

  // Menü kategorileri
  const accountItems = [
    { label: 'Profili Düzenle', onPress: () => navigation.navigate('EditProfile') },
    { label: 'Arkadaşlarını Davet Et', onPress: handleInviteFriends },
  ];
  const appSettingsItems = [
    { label: 'Gece Modu', onPress: () => alert('Gece Modu') },
    { label: 'Dil Ayarları', onPress: () => alert('Dil Ayarları') },
    { label: 'Bildirimler', onPress: () => alert('Bildirimler') },
  ];
  const infoItems = [
    { label: 'Hakkımızda', onPress: () => alert('Hakkımızda') },
    { label: 'Geri Bildirim Gönder', onPress: () => alert('Geri Bildirim Gönder') },
    { label: 'Hükümler ve Politikalar', onPress: () => alert('Hükümler ve Politikalar') },
  ];

  const handleLogout = () => {
    alert('Çıkış yapıldı!');
  };

  const handleDeleteAccount = () => {
    alert('Hesap silindi!');
  };

  // Kategori render fonksiyonu
  const renderMenuSection = (title, items) => (
    <View style={styles.menuSection}>
      <Text style={[typography.styles.subtitle, { color: colors.buttonColor }, styles.sectionTitle]}>{title}</Text>
      {items.map((item, idx) => (
        <TouchableOpacity key={idx} style={styles.menuItem} onPress={item.onPress}>
          <Text style={[typography.styles.body, { color: colors.text }, styles.menuText]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      {/* Sabit profil alanı */}
      <View style={styles.profileRow}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.buttonColor} />
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
    backgroundColor: '#fff0f0',
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