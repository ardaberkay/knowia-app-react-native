import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Text } from '../../components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { triggerHaptic } from '../../lib/hapticManager';
import * as BlockService from '../../services/BlockService';
import LottieView from 'lottie-react-native';
import { useListBottomInset } from '../../components/ui/TabBarInset';
import { getCategoryIcon, ICONS } from '../../theme/icons';
import PhosphorIcon from '../../components/ui/PhosphorIcon';

export default function BlockedScreen() {
  const { colors } = useTheme();
  // iOS: the header is see-through (SCROLL_EDGE_HEADER) and the tab switcher sits
  // outside the lists, so it needs the header's height itself.
  const headerHeight = useHeaderHeight();
  const topInset = Platform.OS === 'ios' ? headerHeight : 0;
  const listBottomInset = useListBottomInset(0, { automaticInsets: true });
  const { session } = useAuth();
  const authUserId = session?.user?.id;
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbarHelpers();

  const [blockedTab, setBlockedTab] = useState('users');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [hiddenDecks, setHiddenDecks] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(true);

  useEffect(() => {
    if (!authUserId) {
      setLoadingBlocked(false);
      setBlockedUsers([]);
      setHiddenDecks([]);
      return;
    }
    let cancelled = false;
    setLoadingBlocked(true);
    Promise.all([
      BlockService.getBlockedUsers(authUserId),
      BlockService.getHiddenDecks(authUserId),
    ])
      .then(([users, decks]) => {
        if (!cancelled) {
          setBlockedUsers(users || []);
          setHiddenDecks(decks || []);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error('Error loading blocked/hidden:', e);
          showError(t('profile.blockedLoadError', 'Liste yüklenemedi'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBlocked(false);
      });
    return () => { cancelled = true; };
  }, [authUserId]);

  const handleUnblockUser = useCallback((blockedId, username) => {
    const displayName = username || t('profile.unknownUser', 'Bu kullanıcı');
    Alert.alert(
      t('profile.unblockTitle', 'Engeli kaldır'),
      t('profile.unblockConfirm', { name: displayName }),
      [
        { text: t('library.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('profile.unblockConfirmButton', 'Engeli kaldır'),
          onPress: async () => {
            try {
              await BlockService.unblockUser(authUserId, blockedId);
              setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedId));
              showSuccess(t('profile.unblockSuccess', 'Engel kaldırıldı'));
              triggerHaptic('light');
            } catch (e) {
              showError(t('profile.unblockError', 'İşlem başarısız'));
            }
          },
        },
      ]
    );
  }, [authUserId, t, showSuccess, showError]);

  const handleUnhideDeck = useCallback((deckId, deckName) => {
    const displayName = deckName || t('profile.unknownDeck', 'Bu deste');
    Alert.alert(
      t('profile.unhideTitle', 'Gizlemeyi kaldır'),
      t('profile.unhideConfirm', { name: displayName }),
      [
        { text: t('library.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('profile.unhideConfirmButton', 'Göster'),
          onPress: async () => {
            try {
              await BlockService.unhideDeck(authUserId, deckId);
              setHiddenDecks((prev) => prev.filter((d) => d.id !== deckId));
              showSuccess(t('profile.unhideSuccess', 'Deste tekrar gösterilecek'));
              triggerHaptic('light');
            } catch (e) {
              showError(t('profile.unhideError', 'İşlem başarısız'));
            }
          },
        },
      ]
    );
  }, [authUserId, t, showSuccess, showError]);

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background, paddingTop: topInset + 16 }]}>
      <View style={[styles.tabs, { backgroundColor: colors.border + '40' }]}>
        <TouchableOpacity
          style={[styles.tab, blockedTab === 'users' && { backgroundColor: colors.buttonColor }]}
          onPress={() => { setBlockedTab('users'); triggerHaptic('selection'); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: blockedTab === 'users' ? '#fff' : colors.text }]}>
            {t('profile.blockedUsersTab', 'Kullanıcılar')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, blockedTab === 'decks' && { backgroundColor: colors.buttonColor }]}
          onPress={() => { setBlockedTab('decks'); triggerHaptic('selection'); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: blockedTab === 'decks' ? '#fff' : colors.text }]}>
            {t('profile.hiddenDecksTab', 'Desteler')}
          </Text>
        </TouchableOpacity>
      </View>

      {loadingBlocked ? (
        <View style={styles.loadingContainer}>
          <LottieView source={require('../../assets/animations/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 160, height: 160 }} />
          <LottieView source={require('../../assets/animations/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100, marginTop: -65 }} />
        </View>
      ) : blockedTab === 'users' ? (
        blockedUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <PhosphorIcon icon={ICONS.block} size={72} color={colors.subtext || '#999'} style={styles.emptyStateIcon} />
            <Text style={[typography.styles.body, { color: colors.subtext }, styles.emptyStateText]}>
              {t('profile.noBlockedUsers', 'Engellenen kullanıcı yok')}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: listBottomInset }} showsVerticalScrollIndicator={false}>
            {blockedUsers.map((user) => (
              <View key={user.id} style={[styles.row, { borderBottomColor: colors.border + '99' }]}>
                <Image
                  source={user.image_url ? { uri: user.image_url } : require('../../assets/images/avatar_default.webp')}
                  style={styles.avatar}
                />
                <Text style={[typography.styles.body, { color: colors.text }, styles.label]} numberOfLines={1}>
                  {user.username || user.id}
                </Text>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleUnblockUser(user.id, user.username)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <PhosphorIcon icon={ICONS.block} size={32} color={colors.error || '#ff5252'} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )
      ) : hiddenDecks.length === 0 ? (
        <View style={styles.emptyState}>
          <PhosphorIcon icon={ICONS.stack} size={72} color={colors.subtext || '#999'} style={styles.emptyStateIcon} />
          <Text style={[typography.styles.body, { color: colors.subtext }, styles.emptyStateText]}>
            {t('profile.noHiddenDecks', 'Gizlenen deste yok')}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: listBottomInset }} showsVerticalScrollIndicator={false}>
          {hiddenDecks.map((deck) => (
            <View key={deck.id} style={[styles.deckCard, { backgroundColor: colors.border + '18', borderColor: colors.border + '40' }]}>
              <View style={[styles.deckCardThumb, { backgroundColor: colors.buttonColor + '20' }]}>
                <PhosphorIcon icon={getCategoryIcon(deck.categories?.sort_order)} size={28} color={colors.buttonColor} />
              </View>
              <View style={styles.deckCardBody}>
                <Text style={[styles.deckCardTitle, { color: colors.text }]} numberOfLines={1}>{deck.name}</Text>
                {deck.to_name ? (
                  <Text style={[styles.deckCardTitle, { color: colors.subtext }]} numberOfLines={1}>{deck.to_name}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.deckCardAction, { backgroundColor: colors.buttonColor + '18' }]}
                onPress={() => handleUnhideDeck(deck.id, deck.name)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <PhosphorIcon icon={ICONS.visible} size={20} color={colors.buttonColor} />
                <Text style={[styles.deckCardActionLabel, { color: colors.buttonColor }]}>{t('profile.unhideConfirmButton', 'Göster')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: fontSizes.footnote,
    fontFamily: fonts.semibold,
  },
  loading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    flexDirection: 'column',
    marginTop: -120,
  },
  empty: {
    paddingVertical: 24,
    paddingHorizontal: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateIcon: {
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyStateText: {
    textAlign: 'center',
    paddingHorizontal: 24,
    opacity: 0.6,
  },
  scroll: {
    flex: 1,
  },
  deckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  deckCardThumb: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  deckCardBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  deckCardTitle: {
    fontSize: fontSizes.subhead,
    fontFamily: fonts.medium,
    marginBottom: 2,
  },
  deckCardAction: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    minWidth: 64,
  },
  deckCardActionLabel: {
    fontSize: fontSizes.micro,
    fontFamily: fonts.semibold,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  deckImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  deckImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    marginRight: 8,
  },
  actionBtn: {
    padding: 6,
  },
});
