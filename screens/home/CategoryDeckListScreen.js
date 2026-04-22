import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, Keyboard, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import SearchBar from '../../components/tools/SearchBar';
import DeckList from '../../components/lists/DeckList';
import { useAuth } from '../../contexts/AuthContext';
import { getDecksByCategory } from '../../services/DeckService';
import { addFavoriteDeck, removeFavoriteDeck, getFavoriteDeckIds } from '../../services/FavoriteService';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';
import { getCategoryConfig } from '../../components/ui/CategoryHeroHeader';
import FilterModal, { FilterModalButton } from '../../components/modals/FilterModal';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { getLanguages } from '../../services/LanguageService';

const LIST_TOP_RADIUS = moderateScale(28);
const HEADER_BOTTOM_BLEED = verticalScale(24);
const LIST_HEADER_OVERLAP = verticalScale(24);

export default function CategoryDeckListScreen({ route }) {
  const { category, title, decks: initialDecks, favoriteDecks: initialFavoriteDecks } = route.params || {};
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const insets = useSafeAreaInsets();
  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();

  const heroDimensions = useMemo(() => ({
    iconSize: scale(64),
    iconBorderRadius: moderateScale(32),
    iconBorderWidth: moderateScale(2),
    iconInnerSize: moderateScale(28),
    titleFontSize: moderateScale(28),
    subtitleFontSize: moderateScale(15),
    subtitleLineHeight: moderateScale(20),
    heroContentMarginBottom: verticalScale(20),
    heroIconMarginRight: scale(16),
    headerContentPaddingTop: verticalScale(20),
    headerContentPaddingBottom: verticalScale(20),
    headerContentPaddingHorizontal: scale(12),
    titleMarginBottom: verticalScale(6),
    searchRowGap: scale(12),
    searchRowMarginTop: verticalScale(8),
  }), []);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('default');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [favoriteDecks, setFavoriteDecks] = useState(initialFavoriteDecks || []);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decks, setDecks] = useState(initialDecks || []);
  const [allLanguages, setAllLanguages] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;
  const fetchGenRef = useRef(0);

  useEffect(() => {
    getLanguages().then(setAllLanguages);
  }, []);

  useEffect(() => {
    if (!initialFavoriteDecks || initialFavoriteDecks.length === 0) {
      loadFavoriteDecks();
    }
  }, []);

  useEffect(() => {
    if (initialFavoriteDecks) {
      setFavoriteDecks(initialFavoriteDecks);
    }
  }, [initialFavoriteDecks]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const loadFavoriteDecks = async () => {
    try {
      if (!userId) return;

      const ids = await getFavoriteDeckIds(userId);
      setFavoriteDecks(ids);
    } catch (error) {
      console.error('Error loading favorite decks:', error);
    }
  };

  const loadDecks = async (opts = {}) => {
    if (!category) return;

    const {
      forceRefresh = false,
      pageOverride = 0,
      append = false,
      sortOverride = sort,
      categorySortOrdersOverride = selectedCategories,
      languageIdsOverride = selectedLanguages,
      searchOverride = debouncedSearch,
    } = opts;

    const sortBy = ['az', 'default', 'popularity'].includes(sortOverride) ? sortOverride : 'default';
    const favoritesOnly = sortOverride === 'favorites';
    const requestGen = ++fetchGenRef.current;

    try {
      if (!append) setLoading(true);
      const loadedDecks = await getDecksByCategory(userId, category, {
        page: pageOverride,
        limit: PAGE_SIZE,
        forceRefresh,
        searchQuery: searchOverride,
        sortBy,
        favoritesOnly,
        categorySortOrders: categorySortOrdersOverride,
        languageIds: languageIdsOverride,
      });
      if (requestGen !== fetchGenRef.current) return;
      const safeDecks = loadedDecks || [];
      setDecks((prev) => {
        if (!append) return safeDecks;
        const seen = new Set(prev.map((d) => d.id));
        const merged = [...prev];
        for (const deck of safeDecks) {
          if (deck?.id && !seen.has(deck.id)) {
            seen.add(deck.id);
            merged.push(deck);
          }
        }
        return merged;
      });
      setPage(pageOverride);
      setHasMore(safeDecks.length >= PAGE_SIZE);
    } catch (error) {
      console.error('Error loading decks:', error);
      if (requestGen === fetchGenRef.current && !append) {
        setDecks([]);
      }
      setHasMore(false);
    } finally {
      if (!append) setLoading(false);
    }
  };

  const loadMoreDecks = async () => {
    if (!category || loadingMore || loading || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      await loadDecks({ pageOverride: nextPage, append: true, sortOverride: sort, searchOverride: debouncedSearch });
    } catch (error) {
      console.error('Error loading more decks:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const visibleDecks = useMemo(() => (
    decks.map((deck) => {
      if (deck.is_admin_created) {
        return {
          ...deck,
          profiles: {
            ...deck.profiles,
            username: 'Knowia',
            image_url: null,
          },
        };
      }
      return deck;
    })
  ), [decks]);

  const handleDeckPress = (deck) => {
    navigation.navigate('DeckDetail', { deck });
  };

  const handleToggleFavorite = async (deckId) => {
    try {
      if (!userId) return;

      const isFavorite = favoriteDecks.includes(deckId);

      if (isFavorite) {
        await removeFavoriteDeck(userId, deckId);
        setFavoriteDecks(prev => prev.filter(id => id !== deckId));
      } else {
        await addFavoriteDeck(userId, deckId);
        setFavoriteDecks(prev => [...prev, deckId]);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadFavoriteDecks(),
        loadDecks({ forceRefresh: true, pageOverride: 0, append: false }),
      ]);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleApplyFilters = (newSort, newCategories, newLanguages) => {
    setSort(newSort);
    setSelectedCategories(newCategories);
    setFilterModalVisible(false);
    setSelectedLanguages(newLanguages || []);
  };

  useEffect(() => {
    if (!category) return;
    loadDecks({
      pageOverride: 0,
      append: false,
      sortOverride: sort,
      categorySortOrdersOverride: selectedCategories,
      languageIdsOverride: selectedLanguages,
      searchOverride: debouncedSearch,
    });
  }, [category, debouncedSearch, sort, selectedCategories, selectedLanguages, userId]);

  const renderFixedHeader = useCallback(() => {
    const config = getCategoryConfig(category, t);
    const targetTopSpace = Platform.OS === 'ios' ? 108 : 108;
    const gradientPaddingTop = targetTopSpace - heroDimensions.headerContentPaddingTop;

    return (
      <View style={styles.fixedHeaderContainer}>
        <LinearGradient
          colors={[...config.gradient, ...config.gradient.slice().reverse()]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fixedHeaderGradient, { paddingTop: gradientPaddingTop }]}
        >
          <View style={[
            styles.headerContent,
            {
              paddingHorizontal: heroDimensions.headerContentPaddingHorizontal,
              paddingTop: heroDimensions.headerContentPaddingTop,
              paddingBottom: heroDimensions.headerContentPaddingBottom,
            }
          ]}>
            <View style={[
              styles.heroContent,
              { marginBottom: heroDimensions.heroContentMarginBottom }
            ]}>
              <View style={[styles.heroIconContainer, { marginRight: heroDimensions.heroIconMarginRight }]}>
                <View style={[
                  styles.iconCircle,
                  {
                    width: heroDimensions.iconSize,
                    height: heroDimensions.iconSize,
                    borderRadius: heroDimensions.iconBorderRadius,
                    borderWidth: heroDimensions.iconBorderWidth,
                    backgroundColor: config.accentColor + '20',
                  }
                ]}>
                  <Iconify icon={config.icon} size={heroDimensions.iconInnerSize} color="#fff" />
                </View>
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={[
                  styles.heroTitle,
                  {
                    fontSize: heroDimensions.titleFontSize,
                    marginBottom: heroDimensions.titleMarginBottom,
                  }
                ]}>
                  {title || t('home.allDecks', 'Tüm Desteler')}
                </Text>
                <Text style={[
                  styles.heroSubtitle,
                  {
                    fontSize: heroDimensions.subtitleFontSize,
                    lineHeight: heroDimensions.subtitleLineHeight,
                  }
                ]}>
                  {config.description}
                </Text>
              </View>
            </View>

            <View style={[
              styles.searchRow,
              {
                gap: heroDimensions.searchRowGap,
                marginTop: heroDimensions.searchRowMarginTop,
              }
            ]}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={t('common.searchDeckPlaceholder', 'Deste ara...')}
                style={styles.searchBar}
                variant="light"
              />
              <FilterModalButton
                onPress={() => setFilterModalVisible(true)}
                variant="light"
              />
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }, [category, title, search, colors, t, insets, heroDimensions, width]);

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      {renderFixedHeader()}

      <View style={[styles.listContainer, { backgroundColor: colors.background }]}>
        <DeckList
          decks={visibleDecks}
          favoriteDecks={favoriteDecks}
          onToggleFavorite={handleToggleFavorite}
          onPressDeck={handleDeckPress}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          onEndReached={loadMoreDecks}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showPopularityBadge={false}
          loading={loading}
          loadingMore={loadingMore}
          contentPaddingTop={verticalScale(20)}
          contentPaddingBottom={Platform.OS === 'android' ? insets.bottom + verticalScale(72) : '10%'}
        />
      </View>

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        currentSort={sort}
        currentCategories={selectedCategories}
        onApply={handleApplyFilters}
        showSortOptions={true}
        languages={allLanguages}
        currentLanguages={selectedLanguages}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeaderContainer: {
    zIndex: 1,
    overflow: 'hidden',
  },
  fixedHeaderGradient: {
    // Keep gradient visible under rounded list corners.
    paddingBottom: HEADER_BOTTOM_BLEED,
    paddingHorizontal: 0,
    // paddingTop dinamik olarak uygulanacak
  },
  headerContent: {
    // paddingHorizontal, paddingTop, paddingBottom dinamik olarak uygulanacak
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: scale(12),
    // marginBottom dinamik olarak uygulanacak
  },
  heroIconContainer: {
    // marginRight dinamik olarak uygulanacak
  },
  iconCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    // width, height, borderRadius, borderWidth dinamik olarak uygulanacak
  },
  heroTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  heroTitle: {
    ...typography.styles.h2,
    color: '#fff',
    fontWeight: '900',
    letterSpacing: moderateScale(-0.5),
    // fontSize, marginBottom dinamik olarak uygulanacak
  },
  heroSubtitle: {
    ...typography.styles.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    // fontSize, lineHeight dinamik olarak uygulanacak
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap, marginTop dinamik olarak uygulanacak
  },
  searchBar: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    marginTop: -LIST_HEADER_OVERLAP,
    zIndex: 2,
    borderTopLeftRadius: LIST_TOP_RADIUS,
    borderTopRightRadius: LIST_TOP_RADIUS,
    overflow: 'hidden',
  },
});
