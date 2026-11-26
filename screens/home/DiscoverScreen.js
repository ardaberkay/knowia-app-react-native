import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Animated, Keyboard, Pressable } from 'react-native';
import { MenuView } from '@expo/ui/community/menu';
import { Text } from '../../components/ui/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import DeckList from '../../components/lists/DeckList';
import DiscoverDecksSkeleton from '../../components/skeleton/DiscoverDecksSkeleton';
import { useAuth } from '../../contexts/AuthContext';
import { getDiscoverDecks } from '../../services/DeckService';
import { addFavoriteDeck, removeFavoriteDeck } from '../../services/FavoriteService';
import { Iconify } from 'react-native-iconify';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { triggerHaptic } from '../../lib/hapticManager';
import { useListBottomInset } from '../../components/ui/CustomTabBar';

// Tabs. `key` is the DeckService tab (it maps to get_discover_decks' sort):
//  trend     -> 'popular'       time-decayed score (favourites + people + starts)
//  unique    -> 'unique_starts' how many different people studied it
//  favorites -> 'favorites'     how many people favourited it
//  new       -> 'new'           newest first
// Only "Popüler" and "Beğenilen" take a time window; Trend weighs time itself.
const TABS = [
  { key: 'trend', labelKey: 'discover.tabs.trend', fallback: 'Trend', color: '#8B7CF6', icon: 'fluent:arrow-trending-sparkle-24-filled' },
  { key: 'unique', labelKey: 'discover.tabs.popular', fallback: 'Popüler', color: '#FF6B35', icon: 'mdi:fire' },
  { key: 'favorites', labelKey: 'discover.tabs.liked', fallback: 'Beğenilen', color: '#F5576C', icon: 'solar:heart-bold' },
  { key: 'new', labelKey: 'discover.tabs.new', fallback: 'Yeni', color: '#2EC4A6', icon: 'mdi:cards' },
];
const TABS_WITH_TIME_FILTER = new Set(['unique', 'favorites']);
// Rolling windows on the server: year = 365d, month = 30d, week = 7d.
const TIME_FILTERS = [
  { key: 'all', labelKey: 'discover.time.all', fallback: 'Tümü' },
  { key: 'year', labelKey: 'discover.time.year', fallback: 'Yıllık' },
  { key: 'month', labelKey: 'discover.time.month', fallback: 'Aylık' },
  { key: 'week', labelKey: 'discover.time.week', fallback: 'Haftalık' },
];
// Card badge per tab: what the list is ranked by.
const BADGE_BY_TAB = { trend: 'trend', unique: 'people', favorites: 'likes' };

const TITLE_HEIGHT = 52;
const CHIPS_HEIGHT = 52;
// Softer than Profile's glow (0.26).
const GLOW_STRENGTH = 0.18;

// One radial light per tab colour, stacked; the selected tab's layer is shown.
function GlowLayer({ id, color, opacity, height }) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { height, opacity }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="0%" rx="70%" ry="100%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={color} stopOpacity={GLOW_STRENGTH} />
            <Stop offset="0.5" stopColor={color} stopOpacity={GLOW_STRENGTH * 0.4} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export default function DiscoverScreen() {
  const navigation = useNavigation();
  // Rendered both as a bottom tab ("DiscoverTab", own title) and as a pushed
  // stack screen ("Discover", under a transparent native header).
  const isTab = useRoute().name === 'DiscoverTab';
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const insets = useSafeAreaInsets();
  const listBottomInset = useListBottomInset();
  const nativeHeaderHeight = useHeaderHeight();

  const [activeTab, setActiveTab] = useState('trend');
  const [timeFilter, setTimeFilter] = useState('all');
  // Trend and Yeni always load "all": the window only applies to the others.
  const effectiveTimeFilter = TABS_WITH_TIME_FILTER.has(activeTab) ? timeFilter : 'all';
  const [refreshing, setRefreshing] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState(new Set());
  const [decksMap, setDecksMap] = useState({ trend: [], unique: [], favorites: [], new: [] });
  const loadDecksTimeoutRef = useRef(null);

  const previousTimeFilterRef = useRef(effectiveTimeFilter);
  const previousActiveTabRef = useRef(activeTab);
  const isInitialMount = useRef(true);

  const loadFreshData = useCallback(async (forceRefresh = false) => {
    try {
      const decks = await getDiscoverDecks(userId, activeTab, effectiveTimeFilter, 50, forceRefresh);
      setDecksMap(prev => ({ ...prev, [activeTab]: decks || [] }));
    } catch (error) {
      console.error('Error loading decks:', error);
      setDecksMap(prev => ({ ...prev, [activeTab]: [] }));
    } finally {
      setLoadedTabs(prev => new Set([...prev, activeTab]));
    }
  }, [activeTab, effectiveTimeFilter, userId]);

  const loadDecks = useCallback(async (forceRefresh = false) => {
    if (loadDecksTimeoutRef.current) {
      clearTimeout(loadDecksTimeoutRef.current);
      loadDecksTimeoutRef.current = null;
    }
    await loadFreshData(forceRefresh);
  }, [loadFreshData]);

  useEffect(() => {
    const tabChanged = previousActiveTabRef.current !== activeTab;
    const timeFilterChanged = previousTimeFilterRef.current !== effectiveTimeFilter;

    if (isInitialMount.current || tabChanged || timeFilterChanged) {
      // A new time window invalidates this tab's list (show the skeleton).
      if (timeFilterChanged && !tabChanged && !isInitialMount.current) {
        setLoadedTabs(prev => {
          const next = new Set(prev);
          next.delete(activeTab);
          return next;
        });
      }
      if (loadDecksTimeoutRef.current) clearTimeout(loadDecksTimeoutRef.current);
      if (isInitialMount.current) {
        loadDecks();
      } else {
        // Debounce quick tab/filter changes.
        loadDecksTimeoutRef.current = setTimeout(() => {
          loadDecks();
          loadDecksTimeoutRef.current = null;
        }, 150);
      }
      isInitialMount.current = false;
    }

    previousActiveTabRef.current = activeTab;
    previousTimeFilterRef.current = effectiveTimeFilter;

    return () => {
      if (loadDecksTimeoutRef.current) {
        clearTimeout(loadDecksTimeoutRef.current);
        loadDecksTimeoutRef.current = null;
      }
    };
  }, [effectiveTimeFilter, activeTab, loadDecks]);

  const displayDecks = useMemo(() => {
    let decks = decksMap[activeTab] || [];
    // "Beğenilen" lists only decks someone (other than the owner) favourited.
    if (activeTab === 'favorites') decks = decks.filter((deck) => Number(deck.favorite_count) > 0);
    return decks.map((deck) => {
      if (deck.is_admin_created) {
        return { ...deck, profiles: { ...deck.profiles, username: 'Knowia', image_url: null } };
      }
      return deck;
    });
  }, [activeTab, decksMap]);

  const handleDeckPress = (deck) => {
    navigation.navigate('DeckDetail', { deck });
  };

  const handleToggleFavorite = async (deckId) => {
    try {
      if (!userId) return;
      const deck = (decksMap[activeTab] || []).find(d => d.id === deckId);
      const isFavorite = deck?.is_favorite === true;
      const updateDeckInLists = (nextFav) => {
        setDecksMap(prev => {
          const updated = {};
          for (const key of Object.keys(prev)) {
            updated[key] = prev[key].map(d => (d.id === deckId ? { ...d, is_favorite: nextFav } : d));
          }
          return updated;
        });
      };
      if (isFavorite) {
        await removeFavoriteDeck(userId, deckId);
        updateDeckInLists(false);
      } else {
        await addFavoriteDeck(userId, deckId);
        updateDeckInLists(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDecks(true);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // ─── Header ───
  // Tab: own "Keşfet" title that scrolls away; the chip row stays pinned.
  // Stack: the native header shows the title, so only the chips are drawn.
  const topInset = isTab ? insets.top : nativeHeaderHeight;
  const titleHeight = isTab ? TITLE_HEIGHT : 0;
  const headerHeight = topInset + titleHeight + CHIPS_HEIGHT;

  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY]
  );
  // All native-driven: the header slides up by the title's height, the title
  // and glow fade out, and a solid background fades in under the chips so the
  // list never shows through.
  const collapse = Math.max(1, titleHeight);
  const headerTranslate = scrollY.interpolate({ inputRange: [0, collapse], outputRange: [0, -titleHeight], extrapolate: 'clamp' });
  const titleOpacity = scrollY.interpolate({ inputRange: [0, collapse * 0.7], outputRange: [1, 0], extrapolate: 'clamp' });
  const glowFade = scrollY.interpolate({ inputRange: [0, collapse * 1.5], outputRange: [1, 0], extrapolate: 'clamp' });
  const solidOpacity = scrollY.interpolate({ inputRange: [0, collapse], outputRange: [0, 1], extrapolate: 'clamp' });

  // Glow colour follows the selected tab (cross-fade, native driver).
  const tabIndex = TABS.findIndex((tab) => tab.key === activeTab);
  const tabAnim = useRef(new Animated.Value(Math.max(0, tabIndex))).current;
  useEffect(() => {
    Animated.timing(tabAnim, { toValue: Math.max(0, tabIndex), duration: 280, useNativeDriver: true }).start();
  }, [tabAnim, tabIndex]);

  const handleTabPress = (key) => {
    if (key === activeTab) return;
    triggerHaptic('selection');
    setActiveTab(key);
  };

  // Time window menu: a native menu laid over the pill (the pill's width
  // follows its label, so the trigger takes the measured size).
  const [timePillSize, setTimePillSize] = useState({ width: 0, height: 0 });
  const onTimePillLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setTimePillSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  const selectTimeFilter = (key) => {
    triggerHaptic('selection');
    setTimeFilter(key);
  };
  const activeTime = TIME_FILTERS.find((f) => f.key === timeFilter) || TIME_FILTERS[0];
  const showTimePill = TABS_WITH_TIME_FILTER.has(activeTab);

  const renderTimePill = () => (
    <View>
    <View
      onLayout={onTimePillLayout}
      pointerEvents="none"
      style={[styles.timePill, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
    >
      <Iconify icon="solar:calendar-minimalistic-bold" size={14} color={colors.muted} />
      <Text style={[styles.timePillText, { color: colors.text }]} numberOfLines={1}>
        {t(activeTime.labelKey, activeTime.fallback)}
      </Text>
      <Iconify icon="flowbite:caret-down-solid" size={12} color={colors.muted} />
    </View>
    <MenuView
      actions={TIME_FILTERS.map((f) => ({
        id: f.key,
        title: t(f.labelKey, f.fallback),
        state: f.key === timeFilter ? 'on' : 'off',
      }))}
      onOpenMenu={() => triggerHaptic('selection')}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event !== timeFilter) selectTimeFilter(nativeEvent.event);
      }}
      style={StyleSheet.absoluteFill}
    >
      <View style={timePillSize} />
    </MenuView>
    </View>
  );

  const renderHeader = () => (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.header, { height: headerHeight, transform: [{ translateY: headerTranslate }] }]}
    >
      {/* Solid background, visible once the list scrolls under the header. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: solidOpacity }]}
      />
      {/* Soft light from the top, tinted by the selected tab. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glowFade }]}>
        {TABS.map((tab, i) => (
          <GlowLayer
            key={tab.key}
            id={`discoverGlow_${tab.key}`}
            color={tab.color}
            height={headerHeight + 40}
            opacity={tabAnim.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [0, 1, 0], extrapolate: 'clamp' })}
          />
        ))}
      </Animated.View>

      <View style={{ height: topInset }} />

      {/* Title row: "Keşfet" and, on the right, the time window (Popüler /
          Beğenilen only). It scrolls away with the title. */}
      {isTab ? (
        <Animated.View style={[styles.titleRow, { height: titleHeight, opacity: titleOpacity }]}>
          <Text style={[styles.title, { color: colors.text }]}>{t('tabs.discover', 'Keşfet')}</Text>
          {showTimePill ? renderTimePill() : null}
        </Animated.View>
      ) : null}

      <View style={[styles.chipsRow, { height: CHIPS_HEIGHT }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
          style={{ flex: 1 }}
        >
          {TABS.map((tab) => {
            const selected = tab.key === activeTab;
            // Pressable, not TouchableOpacity: TouchableOpacity can stay at
            // its pressed opacity when its style changes during the press.
            return (
              <Pressable
                key={tab.key}
                onPress={() => handleTabPress(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.chip,
                  selected
                    ? { backgroundColor: tab.color }
                    : { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Iconify icon={tab.icon} size={15} color={selected ? '#FFFFFF' : colors.muted} />
                <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.text }]}>
                  {t(tab.labelKey, tab.fallback)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Pushed-screen variant has no title row: the pill sits here. */}
        {!isTab && showTimePill ? renderTimePill() : null}
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.listContainer}>
        {!loadedTabs.has(activeTab) ? (
          <View style={{ paddingTop: headerHeight + 8, flex: 1 }}>
            <DiscoverDecksSkeleton />
          </View>
        ) : (
          <DeckList
            decks={displayDecks}
            favoriteDecks={[]}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            cardVariant="favorite"
            layoutMode="double"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            onScroll={handleScroll}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={BADGE_BY_TAB[activeTab] || false}
            contentPaddingTop={headerHeight + 8}
            progressViewOffset={headerHeight}
            contentPaddingBottom={listBottomInset}
          />
        )}
      </View>

      {renderHeader()}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: fontSizes.title1,
    fontFamily: fonts.bold,
    letterSpacing: -0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
  },
  chipsContent: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  chipText: {
    fontSize: fontSizes.subhead,
    fontFamily: fonts.bold,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  timePillText: {
    fontSize: fontSizes.footnote,
    fontFamily: fonts.semibold,
  },
});
