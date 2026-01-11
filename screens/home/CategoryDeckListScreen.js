import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
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
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function CategoryDeckListScreen({ route }) {
  const { category, title, decks: initialDecks, favoriteDecks: initialFavoriteDecks } = route.params || {};
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [favoriteDecks, setFavoriteDecks] = useState(initialFavoriteDecks || []);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decks, setDecks] = useState(initialDecks || []);

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

      if (sort === 'favorites') {
        return matchesSearch && matchesCategory && favoriteDecks.includes(deck.id);
      }
      
      return matchesSearch && matchesCategory;
    });

    switch (sort) {
      case 'default':
        filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
      case 'az':
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'favorites':
        filtered.sort((a, b) => {
          const aIsFavorite = favoriteDecks.includes(a.id);
          const bIsFavorite = favoriteDecks.includes(b.id);
          if (aIsFavorite && !bIsFavorite) return -1;
          if (!aIsFavorite && bIsFavorite) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
        break;
      case 'popularity':
        filtered.sort((a, b) => {
          const scoreA = a.popularity_score || 0;
          const scoreB = b.popularity_score || 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        break;
      default:
        filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
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
  }, [decks, search, sort, favoriteDecks, selectedCategories]);

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

  const handleApplyFilters = (newSort, newCategories) => {
    setSort(newSort);
    setSelectedCategories(newCategories);
    setFilterModalVisible(false);
  };

  const renderFixedHeader = useCallback(() => {
    const config = getCategoryConfig(category, t);
    const headerHeight = Platform.OS === 'ios' ? insets.top + 44 : 56;
    
    return (
      <View style={styles.fixedHeaderContainer}>
        <LinearGradient
          colors={[...config.gradient, ...config.gradient.slice().reverse()]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fixedHeaderGradient, { paddingTop: headerHeight + 32 }]}
        >
          <View style={styles.headerContent}>
            <View style={styles.heroContent}>
              <View style={styles.heroIconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: config.accentColor + '20' }]}>
                  <Iconify icon={config.icon} size={moderateScale(28)} color="#fff" />
                </View>
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>{title || t('home.allDecks', 'Tüm Desteler')}</Text>
                <Text style={styles.heroSubtitle}>{config.description}</Text>
              </View>
            </View>

            <View style={styles.searchRow}>
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
  }, [category, title, search, colors, t, insets]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderFixedHeader()}

      <View style={[styles.listContainer, { backgroundColor: colors.background }]}>
        <DeckList
          decks={filteredDecks}
          favoriteDecks={favoriteDecks}
          onToggleFavorite={handleToggleFavorite}
          onPressDeck={handleDeckPress}
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
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(12),
    paddingHorizontal: 0,
  },
  headerContent: {
    paddingHorizontal: scale(12),
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(20),
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(20),
  },
  heroIconContainer: {
    marginRight: scale(16),
  },
  iconCircle: {
    width: scale(64),
    height: scale(64),
    borderRadius: moderateScale(32),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: moderateScale(2),
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  heroTitle: {
    ...typography.styles.h2,
    color: '#fff',
    fontSize: moderateScale(28),
    fontWeight: '900',
    marginBottom: verticalScale(6),
    letterSpacing: moderateScale(-0.5),
  },
  heroSubtitle: {
    ...typography.styles.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: moderateScale(15),
    fontWeight: '500',
    lineHeight: moderateScale(20),
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginTop: verticalScale(8),
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
