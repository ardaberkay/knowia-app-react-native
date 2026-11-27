import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, ScrollView, Image, RefreshControl, Pressable, Animated } from 'react-native';
import { Text } from '../../components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { getDecksByCategory } from '../../services/DeckService';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { qk, STALE } from '../../lib/queryClient';
import { useNavigation, useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { getFavoriteDeckIds, addFavoriteDeck, removeFavoriteDeck } from '../../services/FavoriteService';
import {
  updateLastActiveAt,
  getActivitySummary,
  peekActivitySummary,
  syncActivityTimeZone,
  syncProfileLanguage,
  DEFAULT_DAILY_GOAL,
} from '../../services/ProfileService';
import { registerForPushNotificationsAsync } from '../../services/NotificationService';
import * as Notifications from 'expo-notifications';
import DeckSkeleton from '../../components/skeleton/DeckSkeleton';
import CommunityDeckSkeleton from '../../components/skeleton/CommunityDeckSkeleton';
import { useTranslation } from 'react-i18next';
import DeckCard, { useDeckCardSize } from '../../components/ui/DeckUi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StandardCustomAppBar from '../../components/layout/StandardCustomAppBar';
import HeroPullBackdrop from '../../components/layout/HeroPullBackdrop';
import CommunityDeckCard from '../../components/ui/CommunityDeckCard';
import { useListBottomInset } from '../../components/ui/TabBarInset';
import PhosphorIcon from '../../components/ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';


// Kategoriye göre ikon seçen yardımcı fonksiyon
function getCategoryIcon(category) {
  switch (category) {
    case 'inProgressDecks': return ICONS.inProgressDecks;
    case 'defaultDecks': return ICONS.readyDecks;
    case 'communityDecks': return ICONS.community;
    default: return ICONS.deck;
  }
}

// Scale animasyonlu kart bileşeni
const AnimatedPressable = ({ onPress, children, style }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [scaleAnim]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// Hero gradient (evenly spaced stops) and its direction in unit coordinates.
const HERO_GRADIENT_COLORS = ['#ffa726', '#ff6b35', '#ff6b35', '#ffa726'];
const HERO_GRADIENT_START = { x: 1, y: 0.1 };
const HERO_GRADIENT_END = { x: 0, y: 1 };


// Heart state on Home only needs the favourite deck ids (cached), not the
// favourite decks themselves; rows keep the { id } shape the lists read.
const COMMUNITY_HOME_COUNT = 3;
const favoriteIdsToRows = (ids) => (ids || []).map((id) => ({ id }));

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { profile, loading: profileLoading } = useProfile();
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const listBottomInset = useListBottomInset();
  const emptyDeckCardDimensions = useDeckCardSize();

  // Measured hero size: the pull-to-refresh backdrop continues the hero's top
  // row, whose colours depend on the hero's aspect ratio.
  const [heroSize, setHeroSize] = useState(null);
  const onHeroLayout = useCallback((e) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setHeroSize((prev) => (prev && Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }));
  }, []);
  // Drives HeroPullBackdrop natively from the ScrollView's offset.
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY]
  );
  const [currentUserId, setCurrentUserId] = useState(null);
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const notificationSetupDoneRef = useRef(false);
  const processingDecksRef = useRef(new Set());
  const { t } = useTranslation();
  const scrollViewRef = useRef(null);

  const DECK_CATEGORIES = {
    inProgressDecks: t('home.inProgressDecks', 'Çalıştığım Desteler'),
    defaultDecks: t('home.defaultDecks', 'Hazır Desteler'),
    communityDecks: t('home.communityDecks', 'Topluluk Desteleri'),
  };

  useScrollToTop(scrollViewRef);

  useEffect(() => {
    setCurrentUserId(userId);
    if (userId) {
      getFavoriteDeckIds(userId).then(ids => setFavoriteDecks(favoriteIdsToRows(ids)));
    }
  }, []);

  // Home lists (TanStack Query, kept on disk for a cold start). Official and
  // community decks change by others → STALE.SHARED; "Çalıştığım Desteler"
  // changes only by our own study sessions, which invalidate it → STALE.OWN.
  // Home shows 10 decks per list (+ "more" if an 11th exists); community shows
  // 3 of its 10, the rest is there at once when "Tümü" opens.
  const queryClient = useQueryClient();
  const HOME_LIST_OPTIONS = {
    inProgressDecks: { limit: 10, includeHasMore: true },
    defaultDecks: { limit: 10, includeHasMore: true },
    communityDecks: { limit: 10, includeHasMore: true },
  };
  const homeCategories = Object.keys(DECK_CATEGORIES);
  const homeQueries = useQueries({
    queries: homeCategories.map((category) => ({
      queryKey: qk.homeDecks(userId, category),
      queryFn: async () => (await getDecksByCategory(userId, category, HOME_LIST_OPTIONS[category]))
        || { decks: [], hasMore: false },
      enabled: !!userId,
      staleTime: category === 'inProgressDecks' ? STALE.OWN : STALE.SHARED,
      gcTime: STALE.STATIC,
      meta: { persist: true },
    })),
  });
  const decks = {};
  homeCategories.forEach((category, i) => {
    const q = homeQueries[i];
    // a failed list shows as empty instead of spinning forever
    decks[category] = q.data ?? (q.isError ? { decks: [], hasMore: false } : undefined);
  });
  const loading = !!userId && homeQueries.some((q) => q.isPending && !q.isError);

  // Daily goal + streak shown in the hero. Cached on the device; refetched
  // only when a study session ends (SwipeDeck invalidates it) or a new day starts.
  const [activity, setActivity] = useState(() => peekActivitySummary(userId, 1));
  const loadActivity = useCallback(async () => {
    if (!userId) return;
    const summary = await getActivitySummary(userId, { days: 1 });
    if (summary) setActivity(summary);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      // only stale lists refetch (a finished study session invalidates
      // "Çalıştığım Desteler"), so switching tabs sends no request
      queryClient.refetchQueries({ queryKey: ['homeDecks', userId], stale: true, type: 'active' });

      loadActivity();

      (async () => {
        await syncActivityTimeZone(userId);
        await syncProfileLanguage(userId);
        await updateLastActiveAt(userId);
      })();
    }, [loadActivity, queryClient, userId])
  );


  // Push token setup, once per mount. Never writes the preference: a user who
  // turned notifications off in Settings stays off; only an enabled profile
  // (the default for new users) registers or refreshes its token.
  useEffect(() => {
    if (!userId || profileLoading || !profile) return;
    if (notificationSetupDoneRef.current) return;
    notificationSetupDoneRef.current = true;
    if (profile.notifications_enabled) {
      registerForPushNotificationsAsync(userId).catch(() => { });
    }
  }, [userId, profile, profileLoading]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['homeDecks', userId] }),
        userId ? getFavoriteDeckIds(userId).then(ids => setFavoriteDecks(favoriteIdsToRows(ids))) : Promise.resolve(),
        userId
          ? getActivitySummary(userId, { days: 1, force: true }).then((summary) => { if (summary) setActivity(summary); })
          : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeckPress = (deck) => {
    navigation.navigate('DeckDetail', { deck });
  };

  // Hero content for today, sized for the hero's narrow text column (the
  // illustration and the hero layout itself stay as they are):
  // a big "done/goal" count, a thin bar, one short note and a short button.
  // The streak is shown in the app bar, next to the avatar.
  const hero = useMemo(() => {
    const goal = activity?.daily_goal ?? DEFAULT_DAILY_GOAL;
    const done = activity?.today_swipes ?? 0;
    const streak = activity?.current_streak ?? 0;
    const best = activity?.best_streak ?? 0;
    const left = Math.max(goal - done, 0);

    let note;
    if (activity?.today_goal_met) {
      note = t('home.activity.noteDone', 'Bugünkü hedef tamam!');
    } else if (done > 0 || streak > 0) {
      note = t('home.activity.noteLeft', { count: left, defaultValue: `Hedefe ${left} kart kaldı` });
    } else if (best > 0) {
      note = t('home.activity.noteBest', { count: best, defaultValue: `En uzun serin ${best} gün` });
    } else {
      note = t('home.activity.noteStart', 'Serini bugün başlat');
    }

    return {
      done,
      goal,
      progress: Math.min(1, done / Math.max(1, goal)),
      note,
      button: done > 0 ? t('home.activity.continue', 'Devam et') : t('home.activity.start', 'Başla'),
    };
  }, [activity, t]);

  // Continue with the most recently studied deck; Discover if there is none.
  const handleHeroPress = () => {
    const recent = decks?.inProgressDecks?.decks?.[0];
    if (recent) handleDeckPress(recent);
    else navigation.navigate('DiscoverTab');
  };

  const handleToggleFavorite = async (deckId) => {
    if (!userId) return;

    // 1. Hızlı tıklama kilidi: Bu deste için işlem sürüyorsa ikinci tıklamayı yoksay
    if (processingDecksRef.current.has(deckId)) return;

    // Kilidi koy
    processingDecksRef.current.add(deckId);

    try {
      // 2. Mevcut favori durumunu kontrol et
      const isFavorite = favoriteDecks.some((fav) => {
        if (typeof fav === 'object' && fav !== null) {
          return fav.id === deckId || fav.deck_id === deckId;
        }
        return fav === deckId;
      });

      // 3. Duruma göre ekle veya çıkar
      if (isFavorite) {
        await removeFavoriteDeck(userId, deckId);
      } else {
        await addFavoriteDeck(userId, deckId);
      }

      // 4. Güncel listeyi çekip state'e yaz
      const decks = favoriteIdsToRows(await getFavoriteDeckIds(userId));
      setFavoriteDecks(decks || []);
    } catch (error) {
      console.error('Favori işlemi sırasında hata oluştu:', error);
    } finally {
      // 5. İşlem bittiğinde kilidi kaldır
      processingDecksRef.current.delete(deckId);
    }
  };

  const renderHeroHeader = () => {
    return (
      <View style={styles.heroHeaderContainer}>
        <LinearGradient
          colors={HERO_GRADIENT_COLORS}
          style={styles.heroHeader}
          start={HERO_GRADIENT_START}
          end={HERO_GRADIENT_END}
          onLayout={onHeroLayout}
        >
          <StandardCustomAppBar
            showLogo
            isHeroBackground
            streak={activity?.current_streak ?? 0}
            onStreakPress={() => navigation.navigate('Profile')}
            showAvatar={false}
          />

          <View style={styles.heroContent}>
            <View style={styles.heroTextContent}>
              {/* Today's count against the goal (the streak lives in the app bar). */}
              <View style={styles.heroCountRow}>
                <Text style={styles.heroCount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {hero.done}
                  <Text style={styles.heroCountGoal}>{`/${hero.goal}`}</Text>
                </Text>
                <Text style={styles.heroCountUnit}>
                  {t('home.activity.cards', 'kart')}
                </Text>
              </View>

              <View style={styles.heroProgressTrack}>
                <View style={[styles.heroProgressFill, { width: `${hero.progress * 100}%` }]} />
              </View>

              <Text style={styles.heroNote} numberOfLines={1}>
                {hero.note}
              </Text>

              <TouchableOpacity
                style={styles.heroButton}
                activeOpacity={0.8}
                onPress={handleHeroPress}
              >
                <PhosphorIcon
                  icon={ICONS.play}
                  size={13}
                  color="#ff6b35"
                />
                <Text style={styles.heroButtonText} numberOfLines={1}>
                  {hero.button}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Görsel artık LinearGradient'in dışında */}
        <Image
          source={require('../../assets/images/item.webp')}
          style={styles.heroIllustration}
          fadeDuration={0}
        />
      </View>
    );
  };

  const renderDeckSection = (category) => {
    const categoryData = decks[category];
    const categoryDecks = Array.isArray(categoryData) ? categoryData : categoryData?.decks;
    const hasMoreDecks = Array.isArray(categoryData) ? false : Boolean(categoryData?.hasMore);
    const totalActiveDeckCount = Array.isArray(categoryData) ? undefined : categoryData?.totalCount;
    const limitedDecks = category === 'communityDecks'
      ? (categoryDecks || []).slice(0, COMMUNITY_HOME_COUNT)
      : (categoryDecks || []);
    const isCategoryLoading = loading || categoryDecks === undefined;
    const isInProgressSection = category === 'inProgressDecks';
    const isDefaultDecksSection = category === 'defaultDecks';
    const isCommunityDecksSection = category === 'communityDecks';
    const activeDeckCount = isInProgressSection
      ? (totalActiveDeckCount ?? categoryDecks?.length ?? 0)
      : (categoryDecks?.length || 0);

    const handleSeeAll = () => {
      // Favori deck ID'lerini çıkar
      const favoriteDeckIds = (favoriteDecks || []).map(deck => deck.id);
      navigation.navigate('CategoryDeckList', {
        category,
        title: DECK_CATEGORIES[category],
        decks: categoryDecks || [],
        favoriteDecks: favoriteDeckIds,
      });
    };

    const handleEmptyDeckPress = () => {
      // Placeholder kart tıklandığında her zaman Ready Decks (defaultDecks) kategorisine git
      const favoriteDeckIds = (favoriteDecks || []).map(deck => deck.id);
      const defaultDecksData = decks['defaultDecks'];
      const defaultDecksList = Array.isArray(defaultDecksData) ? defaultDecksData : defaultDecksData?.decks || [];
      navigation.navigate('CategoryDeckList', {
        category: 'defaultDecks',
        title: DECK_CATEGORIES['defaultDecks'],
        decks: defaultDecksList,
        favoriteDecks: favoriteDeckIds,
      });
    };

    const showEndIcon = hasMoreDecks;
    const SectionWrapper = isInProgressSection ? AnimatedPressable : View;
    const HeaderWrapper = isInProgressSection ? View : TouchableOpacity;
    return (
      <SectionWrapper
        {...(isInProgressSection
          ? {
            onPress: handleSeeAll,
            style: [
              styles.glassCard,
              {
                backgroundColor: colors.homeCardBackground,
                borderColor: colors.cardBorder,
                borderWidth: 1,
              },
            ],
          }
          : {
            style: styles.deckSection,
          })}
      >
        <HeaderWrapper onPress={handleSeeAll} activeOpacity={0.9} style={[styles.sectionHeaderGradient, !isInProgressSection && styles.hairlineBorder, {
          marginHorizontal: isInProgressSection ? 0 : 8,
        }]}>
          <View style={styles.sectionHeaderLeft}>
            <PhosphorIcon
              icon={getCategoryIcon(category)}
              size={22}
              color="#F98A21"
              style={{ marginRight: 8 }}
            />
            <View style={styles.sectionTitleBlock}>
              <Text style={[typography.styles.title3, { color: colors.text }]}>{DECK_CATEGORIES[category]}</Text>
              {isInProgressSection ? (
                <Text style={[typography.styles.subhead, styles.inProgressMetaText, { color: colors.muted }]}>
                  {isCategoryLoading
                    ? t('common.loading', 'Yükleniyor...')
                    : activeDeckCount > 0
                      ? t('home.activeDeckCount', { count: activeDeckCount, defaultValue: '{{count}} aktif deste' })
                      : t('home.noActiveDecks', { defaultValue: 'Aktif deste yok' })}
                </Text>
              ) : null}
            </View>
          </View>
          <View>
            <PhosphorIcon icon={ICONS.chevronRight} size={20} color="#007AFF" />
          </View>
        </HeaderWrapper>
        {isCategoryLoading ? (
          isCommunityDecksSection ? (
            // Topluluk Desteleri için Dikey Skeleton Dizilimi
            <View style={styles.verticalCommunitySkeletonContainer}>
              {[...Array(3)].map((_, i) => (
                <CommunityDeckSkeleton key={i} />
              ))}
            </View>
          ) : (
            // Diğer kategoriler için mevcut Yatay Skeleton
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.decksContainer, { paddingLeft: isInProgressSection ? 0 : 10 }]}
              decelerationRate="fast"
              snapToInterval={emptyDeckCardDimensions.width + 10}
              snapToAlignment="start"
            >
              {[...Array(4)].map((_, i) => (
                <DeckSkeleton key={i} progressMode={isInProgressSection} />
              ))}
            </ScrollView>
          )
        ) : !loading && categoryDecks !== undefined && limitedDecks.length === 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.decksContainer}
            decelerationRate="fast"
            snapToInterval={emptyDeckCardDimensions.width + 10}
            snapToAlignment="start"
          >
            <View style={styles.emptyDeckPromptRow}>
              <TouchableOpacity
                onPress={handleEmptyDeckPress}
                activeOpacity={0.6}
                style={[
                  styles.emptyDeckCard,
                  {
                    width: emptyDeckCardDimensions.width,
                    height: emptyDeckCardDimensions.height,
                    backgroundColor: isDarkMode
                      ? 'rgba(255, 255, 255, 0.03)'
                      : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDarkMode
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.15)',
                  },
                ]}
              >
                <View style={styles.emptyDeckCardContent}>
                  <View
                    style={[
                      styles.emptyDeckPlusContainer,
                      {
                        backgroundColor: isDarkMode
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                  >
                    <PhosphorIcon
                      icon={ICONS.add}
                      size={40}
                      color={
                        isDarkMode
                          ? 'rgba(200, 200, 200, 0.8)'
                          : 'rgba(100, 100, 100, 0.8)'
                      }
                    />
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.emptyDeckPromptText}>
                <Text style={styles.emptyDeckPromptTitle}>
                  {t(
                    'home.emptyHeadTitle',
                    'Hemen başla!'
                  )} 🚀
                </Text>

                <Text style={styles.emptyDeckPromptDescription}>
                  {t(
                    'home.emptySubtitle',
                    'Hazır ve topluluk destelerinden sana uygun olanı seç veya kendi desteni oluştur. Öğrenmeye şimdi başla!'
                  )}
                </Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            horizontal={!isCommunityDecksSection}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.decksContainer, { paddingLeft: isInProgressSection ? 0 : 10, paddingRight: isInProgressSection ? 0 : 0 }]}
            decelerationRate="fast"
            snapToInterval={emptyDeckCardDimensions.width + 10}
            snapToAlignment="start"
          >
            {limitedDecks.map((deck) => {
              // is_admin_created kontrolü - tüm kategoriler için geçerli
              const modifiedDeck = deck.is_admin_created
                ? {
                  ...deck,
                  profiles: {
                    ...deck.profiles,
                    username: 'Knowia',
                    image_url: null, // logoasil.png kullanılacak
                  },
                }
                : deck;

              const isFav = favoriteDecks.some(
                (fav) => (fav.id || fav.deck_id || fav) === deck.id
              );

              return isCommunityDecksSection ? (
                <CommunityDeckCard
                  key={`community-deck-${deck.id}`}
                  deck={modifiedDeck}
                  colors={colors}
                  typography={typography}
                  onPress={handleDeckPress}
                  isFavorite={isFav}
                  onToggleFavorite={() => handleToggleFavorite(deck.id)}
                />
              ) : (
                <DeckCard
                  key={`deck-${deck.id}`}
                  deck={modifiedDeck}
                  colors={colors}
                  typography={typography}
                  variant={category === 'inProgressDecks' ? 'inProgress' : 'default'}
                  onPress={handleDeckPress}
                  isFavorite={isFav}
                  onToggleFavorite={() => handleToggleFavorite(deck.id)}
                />
              );
            })}
            {showEndIcon && (
              <View style={[styles.endIconContainer, { height: emptyDeckCardDimensions.height }]}>
                <View
                  style={[
                    styles.endIconPill,
                    {
                      borderColor: isDarkMode ? 'rgba(249, 138, 33, 0.5)' : 'rgba(249, 138, 33, 0.35)',
                      backgroundColor: isDarkMode ? 'rgba(249, 138, 33, 0.08)' : 'rgba(249, 138, 33, 0.05)',
                    },
                  ]}
                >
                  <PhosphorIcon icon={ICONS.chevronRight} size={30} color="#F98A21" style={{ marginLeft: 2, marginTop: 1 }} />
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SectionWrapper>
    );
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <HeroPullBackdrop
        scrollY={scrollY}
        heroSize={heroSize}
        colors={HERO_GRADIENT_COLORS}
        start={HERO_GRADIENT_START}
        end={HERO_GRADIENT_END}
      />

      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={{ paddingBottom: listBottomInset }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={[colors.buttonColor]}
            // The hero starts under the status bar; keep the spinner below it.
            progressViewOffset={insets.top}
          />
        }
      >
        {renderHeroHeader()}
        {Object.keys(DECK_CATEGORIES).map((category, index) => (
          <React.Fragment key={`category-${category}`}>
            {renderDeckSection(category)}
          </React.Fragment>
        ))}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  sectionHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderRadius: 12,
    paddingVertical: 8,
  },
  hairlineBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 99
  },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12
  },
  sectionTitleBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  decksContainer: {
    paddingBottom: 8,
  },
  inProgressMetaText: {
    marginTop: 2,
    fontSize: fontSizes.caption,
    lineHeight: 16,
    opacity: 0.9,
  },
  emptyText: {
    fontSize: fontSizes.subhead,
    textAlign: 'center',
    marginTop: 20,
  },
  endIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    marginLeft: 4,
    marginRight: 8,
  },
  endIconPill: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
  },
  glassCard: {
    borderRadius: 40,
    marginHorizontal: 10,
    marginVertical: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 180,
    overflow: 'hidden',
  },
  emptyDeckCard: {
    borderRadius: 18,
    marginRight: 10,
    marginBottom: 8,
    borderWidth: 2,
  },
  emptyDeckCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDeckPlusContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    // Kenarlık (borderWidth) yok, sadece arka plan rengi ile ayrışacak
  },
  emptyDeckPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 20,
  },

  emptyDeckPromptText: {
    width: 190,
    marginLeft: 16,
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center'
  },

  emptyDeckPromptTitle: {
    fontSize: fontSizes.bodyLarge,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    marginBottom: 6,

  },

  emptyDeckPromptDescription: {
    fontSize: fontSizes.footnote,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color:
      'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center'
  },
  heroHeaderContainer: {
    width: '100%',
    position: 'relative',
    marginBottom: 24,
  },
  heroHeader: {
    width: '100%',
    minHeight: 215,
    borderBottomRightRadius: 36,
    borderBottomLeftRadius: 36,
  },

  heroContent: {
    flex: 1,
    paddingHorizontal: 20,
    // 6px moved from top to bottom: content sits closer to the app bar,
    // hero height unchanged.
    paddingTop: 2,
    paddingBottom: 30,
    justifyContent: 'center',
  },

  heroTextContent: {
    maxWidth: '55%',
    zIndex: 2,
  },

  // Hero content: big count, thin bar, one-line note, short button.
  heroCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroCount: {
    flexShrink: 1,
    fontSize: fontSizes.largeTitle,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  heroCountGoal: {
    fontSize: fontSizes.title3,
    fontFamily: fonts.bold,
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: -0.3,
  },
  heroCountUnit: {
    fontSize: fontSizes.subhead,
    fontFamily: fonts.semibold,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  heroProgressTrack: {
    width: '85%',
    marginTop: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  heroNote: {
    marginTop: 6,
    fontSize: fontSizes.footnote,
    fontFamily: fonts.medium,
    color: 'rgba(255, 255, 255, 0.92)',
  },

  heroButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  heroButtonText: {
    marginLeft: 7,
    fontSize: fontSizes.subhead,
    fontFamily: fonts.bold,
    color: '#ff6b35',
  },

  heroIllustration: {
    position: 'absolute',
    right: 8,
    bottom: -40,
    width: 180,
    height: 180,
    resizeMode: 'contain',
  },
  deckSection: {
    width: '100%',
    marginVertical: 8
  }
}); 