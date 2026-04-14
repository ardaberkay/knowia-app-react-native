import React, { useEffect, useMemo, useState, useRef,  } from 'react';
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
  const [sort, setSort] = useState('default');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [allLanguages, setAllLanguages] = useState([]);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;

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

  const fetchFavorites = async (forceRefresh = false) => {
    setLoading(true);
    try {
      if (!userId) {
        setFavoriteDecks([]);
        setPage(0);
        setHasMore(false);
        return;
      }
      const decks = await getFavoriteDecks(userId, {
        page: 0,
        limit: PAGE_SIZE,
        forceRefresh,
      });
      const modifiedDecks = mapAdminDecks(decks);
      setFavoriteDecks(modifiedDecks);
      setPage(0);
      setHasMore(modifiedDecks.length >= PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreFavorites = async () => {
    if (!userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const decks = await getFavoriteDecks(userId, {
        page: nextPage,
        limit: PAGE_SIZE,
      });
      const modifiedDecks = mapAdminDecks(decks);
      if (modifiedDecks.length === 0) {
        setHasMore(false);
        return;
      }
      setFavoriteDecks(prev => [...prev, ...modifiedDecks]);
      setPage(nextPage);
      if (modifiedDecks.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    getLanguages().then(setAllLanguages);
  }, []);

  useEffect(() => {
    fetchFavorites(false);
  }, [userId]);

  const filteredDecks = useMemo(() => {
    let list = favoriteDecks.slice();
    
    // Search filter
    if (query && query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(d => 
        (d.name || '').toLowerCase().includes(q) || 
        (d.to_name || '').toLowerCase().includes(q)
      );
    }
    
    // Category filter
    if (selectedCategories.length > 0) {
      list = list.filter(d => {
        const deckSortOrder = d.categories?.sort_order;
        return deckSortOrder != null && selectedCategories.includes(deckSortOrder);
      });
    }

    if (selectedLanguages.length > 0) {
      list = list.filter(d => {
        const deckLanguageIds = d.decks_languages?.map(dl => dl.language_id) || [];
        return deckLanguageIds.some(id => selectedLanguages.includes(id));
      });
    }
    
    // Sorting (en son favorilenen en üstte: favorited_at)
    const favAt = (d) => new Date(d.favorited_at || d.created_at || 0).getTime();
    switch (sort) {
      case 'az':
        list.sort((a, b) => {
          const cmp = (a.name || '').localeCompare(b.name || '');
          return cmp !== 0 ? cmp : favAt(b) - favAt(a);
        });
        break;
      case 'favorites':
        // Already favorites; keep API order (en son favorilenen en üstte)
        break;
      case 'popularity':
        list.sort((a, b) => {
          const scoreA = a.popularity_score || 0;
          const scoreB = b.popularity_score || 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return favAt(b) - favAt(a);
        });
        break;
      case 'default':
      default:
        list.sort((a, b) => favAt(b) - favAt(a));
        break;
    }
    
    return list;
  }, [favoriteDecks, query, sort, selectedCategories, selectedLanguages]);

  const handleAddFavoriteDeck = async (deckId) => {
    if (!userId) return;
    await addFavoriteDeck(userId, deckId);
    const decks = await getFavoriteDecks(userId, { page: 0, limit: PAGE_SIZE, forceRefresh: true });
    const modifiedDecks = mapAdminDecks(decks);
    setFavoriteDecks(modifiedDecks);
    setPage(0);
    setHasMore(modifiedDecks.length >= PAGE_SIZE);
  };

  const handleRemoveFavoriteDeck = async (deckId) => {
    if (!userId) return;
    await removeFavoriteDeck(userId, deckId);
    const decks = await getFavoriteDecks(userId, { page: 0, limit: PAGE_SIZE, forceRefresh: true });
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
      ) : filteredDecks.length < 0 ? (
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
          decks={filteredDecks}
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
          onRefresh={() => fetchFavorites(true)}
          onEndReached={hasMore ? loadMoreFavorites : undefined}
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
