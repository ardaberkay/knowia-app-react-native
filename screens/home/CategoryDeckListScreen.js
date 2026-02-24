import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Platform, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import SearchBar from '../../components/tools/SearchBar';
import DeckList from '../../components/lists/DeckList';
import { supabase } from '../../lib/supabase';
import { getDecksByCategory } from '../../services/DeckService';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';
import { getCategoryConfig } from '../../components/ui/CategoryHeroHeader';
import FilterModal, { FilterModalButton } from '../../components/modals/FilterModal';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { getLanguages } from '../../services/LanguageService';

export default function CategoryDeckListScreen({ route }) {
  const { category, title, decks: initialDecks, favoriteDecks: initialFavoriteDecks } = route.params || {};
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();
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
  const [sort, setSort] = useState('default');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [favoriteDecks, setFavoriteDecks] = useState(initialFavoriteDecks || []);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decks, setDecks] = useState(initialDecks || []);
  const [allLanguages, setAllLanguages] = useState([]);

  useEffect(() => {
    getLanguages().then(setAllLanguages);
  }, []);

  useEffect(() => {
    if (!initialFavoriteDecks || initialFavoriteDecks.length === 0) {
      loadFavoriteDecks();
    }
    if (!initialDecks || initialDecks.length === 0) {
      loadDecks();
    }
  }, []);

  useEffect(() => {
    if (category) {
      loadDecks();
    }
  }, [category]);

  useEffect(() => {
    if (initialFavoriteDecks) {
      setFavoriteDecks(initialFavoriteDecks);
    }
  }, [initialFavoriteDecks]);

  const loadFavoriteDecks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('favorite_decks')
        .select('deck_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const favoriteDeckIds = data.map(item => item.deck_id);
      setFavoriteDecks(favoriteDeckIds);
    } catch (error) {
      console.error('Error loading favorite decks:', error);
    }
  };

  const loadDecks = async () => {
    if (!category) return;

    try {
      setLoading(true);
      const loadedDecks = await getDecksByCategory(category);
      setDecks(loadedDecks || []);
    } catch (error) {
      console.error('Error loading decks:', error);
      setDecks([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredDecks = useMemo(() => {
    let filtered = decks.filter(deck => {
      const matchesSearch =
        (deck.name && deck.name.toLowerCase().includes(search.toLowerCase())) ||
        (deck.to_name && deck.to_name.toLowerCase().includes(search.toLowerCase()));

      const deckSortOrder = deck.categories?.sort_order;
      const hasActiveCategoryFilter = selectedCategories.length > 0;
      const matchesCategory = !hasActiveCategoryFilter
        ? true
        : (deckSortOrder != null && selectedCategories.includes(deckSortOrder));

      // 3. Dil Kontrolü
      const hasActiveLanguageFilter = selectedLanguages.length > 0;

      // NOT: Supabase sorgunda decks_languages'i (language_id) olarak çekmelisin
      const deckLanguageIds = deck.decks_languages?.map(dl => dl.language_id) || [];

      const matchesLanguage = !hasActiveLanguageFilter
        ? true
        : deckLanguageIds.some(id => selectedLanguages.includes(id));

      if (sort === 'favorites') {
        return matchesSearch && matchesCategory && matchesLanguage && favoriteDecks.includes(deck.id);
      }

      return matchesSearch && matchesCategory && matchesLanguage;
    });

    // default: API sırası korunur (communityDecks: shared_at, inProgressDecks: en son çalışılan, vb.)
    const sortDate = (d) => new Date(d.updated_at != null ? d.updated_at : d.created_at || 0).getTime();
    switch (sort) {
      case 'default':
        break;
      case 'az':
        filtered.sort((a, b) => {
          const cmp = (a.name || '').localeCompare(b.name || '');
          return cmp !== 0 ? cmp : sortDate(b) - sortDate(a);
        });
        break;
      case 'favorites':
        filtered.sort((a, b) => {
          const aIsFavorite = favoriteDecks.includes(a.id);
          const bIsFavorite = favoriteDecks.includes(b.id);
          if (aIsFavorite && !bIsFavorite) return -1;
          if (!aIsFavorite && bIsFavorite) return 1;
          return sortDate(b) - sortDate(a);
        });
        break;
      case 'popularity':
        filtered.sort((a, b) => {
          const scoreA = a.popularity_score || 0;
          const scoreB = b.popularity_score || 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return sortDate(b) - sortDate(a);
        });
        break;
      default:
        break;
    }

    // is_admin_created kontrolü - tüm kategoriler için geçerli
    return filtered.map((deck) => {
      if (deck.is_admin_created) {
        return {
          ...deck,
          profiles: {
            ...deck.profiles,
            username: 'Knowia',
            image_url: null, // app-icon.png kullanılacak
          },
        };
      }
      return deck;
    });
  }, [decks, search, sort, favoriteDecks, selectedCategories, selectedLanguages]);

  const handleDeckPress = (deck) => {
    navigation.navigate('DeckDetail', { deck });
  };

  const handleToggleFavorite = async (deckId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isFavorite = favoriteDecks.includes(deckId);

      if (isFavorite) {
        const { error } = await supabase
          .from('favorite_decks')
          .delete()
          .eq('user_id', user.id)
          .eq('deck_id', deckId);

        if (error) throw error;
        setFavoriteDecks(prev => prev.filter(id => id !== deckId));
      } else {
        const { error } = await supabase
          .from('favorite_decks')
          .insert({ user_id: user.id, deck_id: deckId });

        if (error) throw error;
        setFavoriteDecks(prev => [...prev, deckId]);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadFavoriteDecks(), loadDecks()]);
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

  const renderFixedHeader = useCallback(() => {
    const config = getCategoryConfig(category, t);
    const headerHeight = Platform.OS === 'ios' ? insets.top + 44 : 56;
    const gradientPaddingTop = headerHeight + verticalScale(32);

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderFixedHeader()}

      <View style={[styles.listContainer, { backgroundColor: colors.background }]}>
        <DeckList
          decks={filteredDecks}
          favoriteDecks={favoriteDecks}
          onToggleFavorite={handleToggleFavorite}
          onPressDeck={handleDeckPress}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showPopularityBadge={false}
          loading={loading}
          contentPaddingTop={verticalScale(20)}
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
    </View>
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
    paddingBottom: verticalScale(12),
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
    marginTop: verticalScale(-20),
    zIndex: 2,
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    overflow: 'hidden',
  },
});
