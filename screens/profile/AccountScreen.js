import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { Text } from '../../components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { ProfileMenuCard } from './ProfileScreen';

/** Profile › Account: edit profile, invite, blocked list, log out, delete account. */
export default function AccountScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { showSuccess, showError } = useSnackbarHelpers();

  const handleInviteFriends = useCallback(async () => {
    try {
      await Share.share({
        message: t('profile.inviteMessage', 'Bilgi evreninde öğrenme yolunu Knowia ile bul! Ücretsiz kaydol:') + 'https://knowia.online/download',
      });
    } catch {
      // Paylaşım iptal edildiyse veya hata olursa sessiz geç
    }
  }, [t]);

  const handleLogout = async () => {
    try {
      const { error } = await logout();
      if (error) throw error;
    } catch {
      showError(t('profile.logoutError', 'Çıkış yapılırken bir hata oluştu'));
    }
  };

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
  }, [showError, supabaseUrl, t]);

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
            } catch {
              showError(t('profile.deleteDeactivateError'));
            }
          },
        },
      ]
    );
  }, [t, callEdgeFunction, showSuccess, showError, logout]);

  const items = [
    { key: 'edit', icon: 'lucide:edit', label: t('profile.edit'), chevron: true, onPress: () => navigation.navigate('EditProfile') },
    { key: 'invite', icon: 'fluent:people-community-20-filled', label: t('profile.invite'), chevron: true, onPress: handleInviteFriends },
    { key: 'blocked', icon: 'gridicons:block', label: t('profile.blockedSection', 'Engellenenler'), chevron: true, onPress: () => navigation.navigate('Blocked') },
  ];

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileMenuCard items={items} colors={colors} />

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={[typography.styles.headline, { color: colors.buttonText }, styles.centerText]}>{t('profile.logout')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: colors.error || '#ff5252' }]}
          onPress={handleDeleteAccount}
          activeOpacity={0.8}
        >
          <Text style={[typography.styles.body, { color: colors.error || '#ff5252' }, styles.centerText]}>{t('profile.deleteAccount')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 40,
  },
  logoutButton: {
    marginTop: 28,
    backgroundColor: '#ff5252',
    paddingVertical: 12,
    borderRadius: 999,
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  centerText: {
    textAlign: 'center',
  },
});
