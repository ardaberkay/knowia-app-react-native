import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Platform, Animated, Keyboard, Modal, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import DeckList from '../../components/lists/DeckList';
import DiscoverDecksSkeleton from '../../components/skeleton/DiscoverDecksSkeleton';
import { useAuth } from '../../contexts/AuthContext';
import { getDiscoverDecks } from '../../services/DeckService';
import { addFavoriteDeck, removeFavoriteDeck } from '../../services/FavoriteService';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { triggerHaptic } from '../../lib/hapticManager';

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

const TITLE_HEIGHT = verticalScale(52);
const CHIPS_HEIGHT = verticalScale(52);
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
  const nativeHeaderHeight = Platform.OS === 'ios' ? insets.top + 44 : 56;
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

  // Time window menu (a small dropdown under the pill).
  const pillRef = useRef(null);
  const [timeMenu, setTimeMenu] = useState(null); // { right, top } in window coords, or null
  const openTimeMenu = () => {
    triggerHaptic('selection');
    pillRef.current?.measureInWindow((x, y, width, height) => {
      setTimeMenu({ right: x + width, top: y + height + verticalScale(6) });
    });
  };
  const selectTimeFilter = (key) => {
    triggerHaptic('selection');
    setTimeMenu(null);
    setTimeFilter(key);
  };
  const activeTime = TIME_FILTERS.find((f) => f.key === timeFilter) || TIME_FILTERS[0];
  const showTimePill = TABS_WITH_TIME_FILTER.has(activeTab);

  const renderTimePill = () => (
    <Pressable
      ref={pillRef}
      onPress={openTimeMenu}
      hitSlop={8}
      style={({ pressed }) => [
        styles.timePill,
        { backgroundColor: 'rgba(255, 255, 255, 0.08)', opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Iconify icon="solar:calendar-minimalistic-bold" size={moderateScale(14)} color={colors.muted} />
      <Text style={[styles.timePillText, { color: colors.text }]} numberOfLines={1}>
        {t(activeTime.labelKey, activeTime.fallback)}
      </Text>
      <Iconify icon="flowbite:caret-down-solid" size={moderateScale(12)} color={colors.muted} />
    </Pressable>
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
            height={headerHeight + verticalScale(40)}
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
                <Iconify icon={tab.icon} size={moderateScale(15)} color={selected ? '#FFFFFF' : colors.muted} />
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
          <View style={{ paddingTop: headerHeight + verticalScale(8), flex: 1 }}>
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
            contentPaddingTop={headerHeight + verticalScale(8)}
            progressViewOffset={headerHeight}
            contentPaddingBottom={
              Platform.OS === 'android'
                ? insets.bottom + verticalScale(isTab ? 120 : 72)
                : (isTab ? '30%' : '10%')
            }
          />
        )}
      </View>

      {renderHeader()}

      <Modal visible={Boolean(timeMenu)} transparent animationType="fade" onRequestClose={() => setTimeMenu(null)}>
        <Pressable style={{ flex: 1 }} onPress={() => setTimeMenu(null)}>
          {timeMenu ? (
            <View
              style={[
                styles.timeMenu,
                {
                  // Right-aligned under the pill.
                  top: timeMenu.top,
                  left: Math.max(scale(14), timeMenu.right - scale(170)),
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.cardBorder || colors.border,
                },
              ]}
            >
              {TIME_FILTERS.map((filter, index) => {
                const selected = filter.key === timeFilter;
                return (
                  <TouchableOpacity
                    key={filter.key}
                    activeOpacity={0.6}
                    onPress={() => selectTimeFilter(filter.key)}
                    style={[
                      styles.timeMenuItem,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    ]}
                  >
                    <Text style={[typography.styles.body, { color: selected ? colors.buttonColor : colors.text, flex: 1 }]}>
                      {t(filter.labelKey, filter.fallback)}
                    </Text>
                    {selected ? <Iconify icon="hugeicons:tick-01" size={moderateScale(18)} color={colors.buttonColor} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
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
    paddingHorizontal: scale(16),
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: scale(14),
  },
  chipsContent: {
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(14),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    height: moderateScale(36),
    paddingHorizontal: scale(14),
    borderRadius: 999,
  },
  chipText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    height: moderateScale(34),
    paddingHorizontal: scale(12),
    borderRadius: 999,
  },
  timePillText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  timeMenu: {
    position: 'absolute',
    width: scale(170),
    borderRadius: moderateScale(14),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  timeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
  },
});
