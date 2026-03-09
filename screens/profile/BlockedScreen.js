import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { scale, moderateScale, verticalScale } from 'react-native-size-matters';
import { triggerHaptic } from '../../lib/hapticManager';
import * as BlockService from '../../services/BlockService';

export default function BlockedScreen() {
  const { colors } = useTheme();
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

  const getCategoryIcon = (sortOrder) => {
    const icons = {
      1: 'hugeicons:language-skill',
      2: 'clarity:atom-solid',
      3: 'mdi:math-compass',
      4: 'game-icons:tied-scroll',
      5: 'arcticons:world-geography-alt',
      6: 'map:museum',
      7: 'ic:outline-self-improvement',
      8: 'streamline-ultimate:module-puzzle-2-bold',
    };
    return icons[sortOrder] || 'material-symbols:category';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.buttonColor} />
        </View>
      ) : blockedTab === 'users' ? (
        blockedUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Iconify icon="gridicons:block" size={scale(72)} color={colors.subtext || '#999'} style={styles.emptyStateIcon} />
            <Text style={[typography.styles.body, { color: colors.subtext }, styles.emptyStateText]}>
              {t('profile.noBlockedUsers', 'Engellenen kullanıcı yok')}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {blockedUsers.map((user) => (
              <View key={user.id} style={[styles.row, { borderBottomColor: colors.border + '99' }]}>
                <Image
                  source={user.image_url ? { uri: user.image_url } : require('../../assets/avatar-default.png')}
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
                  <Iconify icon="gridicons:block" size={moderateScale(32)} color={colors.error || '#ff5252'} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )
      ) : hiddenDecks.length === 0 ? (
        <View style={styles.emptyState}>
          <Iconify icon="mdi:cards" size={scale(72)} color={colors.subtext || '#999'} style={styles.emptyStateIcon} />
          <Text style={[typography.styles.body, { color: colors.subtext }, styles.emptyStateText]}>
            {t('profile.noHiddenDecks', 'Gizlenen deste yok')}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.hiddenDecksScrollContent} showsVerticalScrollIndicator={false}>
          {hiddenDecks.map((deck) => (
            <View key={deck.id} style={[styles.deckCard, { backgroundColor: colors.border + '18', borderColor: colors.border + '40' }]}>
              <View style={[styles.deckCardThumb, { backgroundColor: colors.buttonColor + '20' }]}>
                <Iconify icon={getCategoryIcon(deck.categories?.sort_order)} size={moderateScale(28)} color={colors.buttonColor} />
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
                <Iconify icon="oi:eye" size={moderateScale(20)} color={colors.buttonColor} />
                <Text style={[styles.deckCardActionLabel, { color: colors.buttonColor }]}>{t('profile.unhideConfirmButton', 'Göster')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(16),
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: moderateScale(24),
    padding: moderateScale(4),
    marginBottom: verticalScale(16),
  },
  tab: {
    flex: 1,
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  loading: {
    paddingVertical: verticalScale(24),
    alignItems: 'center',
  },
  empty: {
    paddingVertical: verticalScale(24),
    paddingHorizontal: scale(4),
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(48),
  },
  emptyStateIcon: {
    marginBottom: verticalScale(16),
    opacity: 0.6,
  },
  emptyStateText: {
    textAlign: 'center',
    paddingHorizontal: scale(24),
    opacity: 0.6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: verticalScale(32),
  },
  hiddenDecksScrollContent: {
    paddingBottom: verticalScale(32),
  },
  deckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: moderateScale(20),
    borderWidth: moderateScale(1),
    padding: moderateScale(12),
    overflow: 'hidden',
    marginBottom: verticalScale(12),
  },
  deckCardThumb: {
    width: scale(52),
    height: scale(52),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(14),
  },
  deckCardBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  deckCardTitle: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    marginBottom: verticalScale(2),
  },
  deckCardAction: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(16),
    minWidth: scale(64),
  },
  deckCardActionLabel: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginTop: verticalScale(4),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    borderBottomWidth: moderateScale(1),
  },
  avatar: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(20),
    marginRight: scale(12),
  },
  deckImage: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(8),
    marginRight: scale(12),
  },
  deckImagePlaceholder: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(8),
    marginRight: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    marginRight: scale(8),
  },
  actionBtn: {
    padding: moderateScale(6),
  },
});
