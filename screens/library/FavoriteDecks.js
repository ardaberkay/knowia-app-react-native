import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Image, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getFavoriteDecks, addFavoriteDeck, removeFavoriteDeck } from '../../services/FavoriteService';
import SearchBar from '../../components/tools/SearchBar';
import FilterModal, { FilterModalButton } from '../../components/modals/FilterModal';
import DeckList from '../../components/lists/DeckList';
import LottieView from 'lottie-react-native';
import { typography } from '../../theme/typography';
import { StyleSheet } from 'react-native';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { getLanguages } from '../../services/LanguageService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FavoriteDecks() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const insets = useSafeAreaInsets();

  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [allLanguages, setAllLanguages] = useState([]);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;
  const fetchGenRef = useRef(0);

  const mapAdminDecks = (decks) =>
    (decks || []).map((deck) => {
      if (deck.is_admin_created) {
        return {
          ...deck,
          profiles: {
            ...deck.profiles,
            username: 'Knowia',
            image_url: null, // app_icon.png kullanılacak
          },
        };
      }
      return deck;
    });

  const fetchFavorites = async (opts = {}) => {
    const {
      forceRefresh = false,
      pageOverride = 0,
      append = false,
      sortOverride = sort,
      categorySortOrdersOverride = selectedCategories,
      languageIdsOverride = selectedLanguages,
      searchOverride = debouncedQuery,
    } = opts;
    const requestGen = ++fetchGenRef.current;
    if (!append) setLoading(true);
    try {
      if (!userId) {
        setFavoriteDecks([]);
        setPage(0);
        setHasMore(false);
        return;
      }
      const decks = await getFavoriteDecks(userId, {
        page: pageOverride,
        limit: PAGE_SIZE,
        forceRefresh,
        searchQuery: searchOverride,
        sortBy: sortOverride,
        categorySortOrders: categorySortOrdersOverride,
        languageIds: languageIdsOverride,
      });
      if (requestGen !== fetchGenRef.current) return;
      const modifiedDecks = mapAdminDecks(decks);
      setFavoriteDecks((prev) => {
        if (!append) return modifiedDecks;
        const seen = new Set(prev.map((d) => d.id));
        const merged = [...prev];
        for (const deck of modifiedDecks) {
          if (deck?.id && !seen.has(deck.id)) {
            seen.add(deck.id);
            merged.push(deck);
          }
        }
        return merged;
      });
      setPage(pageOverride);
      setHasMore(modifiedDecks.length >= PAGE_SIZE);
    } finally {
      if (!append) setLoading(false);
    }
  };

  const loadMoreFavorites = async () => {
    if (!userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      await fetchFavorites({ pageOverride: nextPage, append: true });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    getLanguages().then(setAllLanguages);
  }, []);

  useEffect(() => {
    fetchFavorites({ forceRefresh: false, pageOverride: 0, append: false });
  }, [userId]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!userId) return;
    fetchFavorites({
      forceRefresh: false,
      pageOverride: 0,
      append: false,
      sortOverride: sort,
      categorySortOrdersOverride: selectedCategories,
      languageIdsOverride: selectedLanguages,
      searchOverride: debouncedQuery,
    });
  }, [userId, debouncedQuery, sort, selectedCategories, selectedLanguages]);

  const handleAddFavoriteDeck = async (deckId) => {
    if (!userId) return;
    await addFavoriteDeck(userId, deckId);
    const decks = await getFavoriteDecks(userId, {
      page: 0,
      limit: PAGE_SIZE,
      forceRefresh: true,
      searchQuery: debouncedQuery,
      sortBy: sort,
      categorySortOrders: selectedCategories,
      languageIds: selectedLanguages,
    });
    const modifiedDecks = mapAdminDecks(decks);
    setFavoriteDecks(modifiedDecks);
    setPage(0);
    setHasMore(modifiedDecks.length >= PAGE_SIZE);
  };

  const handleRemoveFavoriteDeck = async (deckId) => {
    if (!userId) return;
    await removeFavoriteDeck(userId, deckId);
    const decks = await getFavoriteDecks(userId, {
      page: 0,
      limit: PAGE_SIZE,
      forceRefresh: true,
      searchQuery: debouncedQuery,
      sortBy: sort,
      categorySortOrders: selectedCategories,
      languageIds: selectedLanguages,
    });
    const modifiedDecks = mapAdminDecks(decks);
    setFavoriteDecks(modifiedDecks);
    setPage(0);
    setHasMore(modifiedDecks.length >= PAGE_SIZE);
  };

  const handleApplyFilters = (newSort, newCategories, newLanguages) => {
    setSort(newSort);
    setSelectedCategories(newCategories);
    setFilterModalVisible(false);
    setSelectedLanguages(newLanguages || []);
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background, marginVertical: verticalScale(10) }}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <LottieView source={require('../../assets/flexloader.json')} speed={1.1} autoPlay loop style={{ width: scale(160, 0.3), height: verticalScale(160, 0.3) }} />
          <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: scale(100, 0.3), height: verticalScale(100, 0.3), marginTop: verticalScale(-65) }} />
        </View>
      ) : favoriteDecks.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: verticalScale(-150)}}>
          <Image
            source={require('../../assets/deckbg.webp')}
            style={{ width: scale(300), height: verticalScale(300), opacity: 0.2 }}
            resizeMode="contain"
            fadeDuration={0}
          />
          <Text style={[typography.styles.body, { color: colors.text, opacity: 0.6, textAlign: 'center', fontSize: moderateScale(16), marginTop: verticalScale(-20) }]}>
            {t('library.addFavoriteDeckEmpty', 'Bir deste favorilere ekle')}
          </Text>
        </View>
      ) : (
        <DeckList
          decks={favoriteDecks}
          favoriteDecks={favoriteDecks.map(d => d.id)}
          onToggleFavorite={async (deckId) => {
            if (favoriteDecks.some(d => d.id === deckId)) {
              await handleRemoveFavoriteDeck(deckId);
            } else {
              await handleAddFavoriteDeck(deckId);
            }
          }}
          onPressDeck={(deck) => navigation.navigate('DeckDetail', { deck })}
          ListHeaderComponent={(
            <View style={{ backgroundColor: colors.background, marginVertical: verticalScale(8) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10), width: '95%', alignSelf: 'center' }}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('common.searchPlaceholder', 'Favori destelerde ara...')}
                  style={{ flex: 1 }}
                />
                <FilterModalButton onPress={() => setFilterModalVisible(true)} />
              </View>
            </View>
          )}
          refreshing={loading}
          onRefresh={() => fetchFavorites({ forceRefresh: true, pageOverride: 0, append: false })}
          onEndReached={hasMore ? loadMoreFavorites : undefined}
          loadingMore={loadingMore}
          contentPaddingBottom={Platform.OS === 'android' ? insets.bottom + verticalScale(72) : '10%'}
        />
      )}

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        currentSort={sort}
        currentCategories={selectedCategories}
        onApply={handleApplyFilters}
        showSortOptions={true}
        hideFavorites={true}
        hideAz={true}
        languages={allLanguages}
        currentLanguages={selectedLanguages}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: verticalScale(200),
    flexDirection: 'column',
    marginTop: verticalScale(-120),
  },
});
