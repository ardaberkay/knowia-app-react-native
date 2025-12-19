import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Dimensions, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import SearchBar from '../../components/tools/SearchBar';
import DeckList from '../../components/lists/DeckList';
import { supabase } from '../../lib/supabase';
import { getPopularDecks, getNewDecks, getMostFavoritedDecks, getMostStartedDecks, getMostUniqueStartedDecks } from '../../services/DeckService';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import FilterModal, { FilterModalButton } from '../../components/modals/FilterModal';

const { width } = Dimensions.get('window');
const HERO_CARD_WIDTH = width - 32;

export default function DiscoverScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState('trend');
  const [timeFilter, setTimeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trendDecksList, setTrendDecksList] = useState([]);
  const [favoriteDecksList, setFavoriteDecksList] = useState([]);
  const [startedDecksList, setStartedDecksList] = useState([]);
  const [uniqueDecksList, setUniqueDecksList] = useState([]);
  const [newDecks, setNewDecks] = useState([]);

  const heroScrollRef = useRef(null);
  const isUserScrolling = useRef(false);

  useEffect(() => {
    loadFavoriteDecks();
    loadDecks();
  }, []);

  useEffect(() => {
    if (trendDecksList.length > 0 || favoriteDecksList.length > 0 || startedDecksList.length > 0 || uniqueDecksList.length > 0 || newDecks.length > 0) {
      loadDecks();
    }
  }, [timeFilter, activeTab]);

  useEffect(() => {
    if (!isUserScrolling.current && heroScrollRef.current) {
      const tabKeys = ['trend', 'favorites', 'starts', 'unique', 'new'];
      const newIndex = tabKeys.indexOf(activeTab);
      if (newIndex >= 0) {
        heroScrollRef.current.scrollTo({
          x: newIndex * HERO_CARD_WIDTH,
          animated: true,
        });
      }
    }
  }, [activeTab]);

  const loadFavoriteDecks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('favorite_decks')
        .select('deck_id')
        .eq('user_id', user.id);

      if (error) throw error;
      setFavoriteDecks(data.map(item => item.deck_id));
    } catch (error) {
      console.error('Error loading favorite decks:', error);
    }
  };

  const loadDecks = async () => {
    try {
      setLoading(true);
      let decks = [];
      
      if (activeTab === 'trend') {
        decks = await getPopularDecks(100, timeFilter);
        setTrendDecksList(decks || []);
      } else if (activeTab === 'favorites') {
        decks = await getMostFavoritedDecks(100, timeFilter);
        setFavoriteDecksList(decks || []);
      } else if (activeTab === 'starts') {
        decks = await getMostStartedDecks(100, timeFilter);
        setStartedDecksList(decks || []);
      } else if (activeTab === 'unique') {
        decks = await getMostUniqueStartedDecks(100, timeFilter);
        setUniqueDecksList(decks || []);
      } else {
        decks = await getNewDecks(100);
        setNewDecks(decks || []);
      }
    } catch (error) {
      console.error('Error loading decks:', error);
      if (activeTab === 'trend') setTrendDecksList([]);
      else if (activeTab === 'favorites') setFavoriteDecksList([]);
      else if (activeTab === 'starts') setStartedDecksList([]);
      else if (activeTab === 'unique') setUniqueDecksList([]);
      else setNewDecks([]);
    } finally {
      setLoading(false);
    }
  };

  const currentDecks = useMemo(() => {
    switch (activeTab) {
      case 'trend': return trendDecksList;
      case 'favorites': return favoriteDecksList;
      case 'starts': return startedDecksList;
      case 'unique': return uniqueDecksList;
      case 'new': return newDecks;
      default: return [];
    }
  }, [activeTab, trendDecksList, favoriteDecksList, startedDecksList, uniqueDecksList, newDecks]);

  const filteredDecks = useMemo(() => {
    return currentDecks.filter(deck => {
      const matchesSearch = 
        (deck.name && deck.name.toLowerCase().includes(search.toLowerCase())) ||
        (deck.to_name && deck.to_name.toLowerCase().includes(search.toLowerCase()));

      const deckSortOrder = deck.categories?.sort_order;
      const hasActiveCategoryFilter = selectedCategories.length > 0;
      const matchesCategory = !hasActiveCategoryFilter
        ? true
        : (deckSortOrder != null && selectedCategories.includes(deckSortOrder));
      
      return matchesSearch && matchesCategory;
    });
  }, [currentDecks, search, selectedCategories]);

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

  const handleApplyFilters = (newCategories) => {
    setSelectedCategories(newCategories);
    setFilterModalVisible(false);
  };

  const handleSetPage = useCallback((pageIndex) => {
    const tabs = ['trend', 'favorites', 'starts', 'unique', 'new'];
    const currentIndex = tabs.findIndex(tab => tab === activeTab);
    if (currentIndex === pageIndex) return;
    setActiveTab(tabs[pageIndex] || 'trend');
  }, [activeTab]);

  const handleHeroScroll = useCallback((event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / HERO_CARD_WIDTH);
    const tabKeys = ['trend', 'favorites', 'starts', 'unique', 'new'];
    
    if (pageIndex >= 0 && pageIndex < tabKeys.length) {
      const newTab = tabKeys[pageIndex];
      if (newTab !== activeTab) {
        isUserScrolling.current = true;
        setActiveTab(newTab);
        setTimeout(() => { isUserScrolling.current = false; }, 300);
      }
    }
  }, [activeTab]);

  const timeFilters = [
    { key: 'all', label: t('discover.all', 'Tümü'), icon: 'solar:infinity-bold' },
    { key: 'today', label: t('discover.daily', 'Bugün'), icon: 'solar:sun-bold' },
    { key: 'week', label: t('discover.weekly', 'Hafta'), icon: 'solar:calendar-minimalistic-bold' },
    { key: 'month', label: t('discover.monthly', 'Ay'), icon: 'solar:calendar-bold' },
    { key: 'year', label: t('discover.yearly', 'Yıl'), icon: 'solar:calendar-bold' },
  ];

  const tabConfigs = {
    trend: {
      title: t('discover.trending', 'Trend'),
      subtitle: t('discover.trendingSubtitle', 'Şu an en popüler desteler'),
      icon: 'fluent:arrow-trending-sparkle-24-filled',
      gradient: ['#667eea', '#764ba2'],
      accentColor: '#f093fb',
    },
    favorites: {
      title: t('discover.mostFavorited', 'Favoriler'),
      subtitle: t('discover.mostFavoritedSubtitle', 'En çok favorilenen desteler'),
      icon: 'solar:heart-bold',
      gradient: ['#f093fb', '#f5576c'],
      accentColor: '#ff6b9d',
    },
    starts: {
      title: t('discover.mostStarted', 'Popüler'),
      subtitle: t('discover.mostStartedSubtitle', 'En çok başlatılan desteler'),
      icon: 'mdi:fire',
      gradient: ['#fee140', '#fa709a'],
      accentColor: '#ff6b35',
    },
    unique: {
      title: t('discover.mostUnique', 'Yaygın'),
      subtitle: t('discover.mostUniqueSubtitle', 'En geniş kullanıcı kitlesine sahip desteler'),
      icon: 'fluent:people-community-20-filled',
      gradient: ['#00f2fe', '#4facfe'],
      accentColor: '#6f8ead',
    },
    new: {
      title: t('discover.newDecks', 'Yeni'),
      subtitle: t('discover.newSubtitle', 'Yeni eklenen desteler'),
      icon: 'mdi:cards',
      gradient: ['#38f9d7', '#43e97b'],
      accentColor: '#6f8ead',
    },
  };

  const tabKeys = ['trend', 'favorites', 'starts', 'unique', 'new'];
  const activeIndex = tabKeys.indexOf(activeTab);

  const renderFixedHeader = () => {
    const headerHeight = Platform.OS === 'ios' ? insets.top + 44 : 56;
    
    return (
      <View style={[styles.fixedHeaderContainer, { backgroundColor: colors.cardBackground, paddingTop: headerHeight + 50 }]}>
        <View style={styles.heroCarouselContainer}>
          <ScrollView
            ref={heroScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleHeroScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleHeroScroll}
            contentContainerStyle={styles.heroCarouselContent}
            decelerationRate="fast"
            snapToInterval={HERO_CARD_WIDTH}
            snapToAlignment="start"
            contentOffset={{ x: activeIndex * HERO_CARD_WIDTH, y: 0 }}
          >
            {tabKeys.map((tabKey) => {
              const config = tabConfigs[tabKey];
              return (
                <View key={tabKey} style={[styles.modernHeroCard, { width: HERO_CARD_WIDTH }]}>
                  <LinearGradient
                    colors={[...config.gradient, ...config.gradient.slice().reverse()]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modernHeroGradient}
                  >
                    <View style={styles.modernHeroContent}>
                      <View style={styles.modernHeroIconContainer}>
                        <View style={[styles.modernIconCircle, { backgroundColor: config.accentColor + '20' }]}>
                          <Iconify icon={config.icon} size={28} color="#fff" />
                        </View>
                      </View>
                      <View style={styles.modernHeroTextContainer}>
                        <Text style={styles.modernHeroTitle}>{config.title}</Text>
                        <Text style={styles.modernHeroSubtitle}>{config.subtitle}</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              );
            })}
          </ScrollView>
          
          <View style={styles.paginationContainer}>
            {tabKeys.map((tabKey, idx) => {
              const config = tabConfigs[tabKey];
              const isActive = activeTab === tabKey;
              return (
                <TouchableOpacity
                  key={tabKey}
                  onPress={() => handleSetPage(idx)}
                  style={[
                    styles.paginationDot,
                    {
                      backgroundColor: isActive ? config.accentColor : colors.border,
                      width: isActive ? 24 : 8,
                    }
                  ]}
                />
              );
            })}
          </View>
        </View>

        {activeTab !== 'new' && (
          <View style={styles.timeFilterWrapper}>
            <View style={[styles.timeFilterSegmentedContainer, { backgroundColor: colors.background }]}>
              {timeFilters.map((filter) => {
                const isActive = timeFilter === filter.key;
                const accentColor = tabConfigs[activeTab]?.accentColor || colors.buttonColor;
                
                return (
                  <TouchableOpacity
                    key={filter.key}
                    onPress={() => setTimeFilter(filter.key)}
                    style={[
                      styles.timeFilterSegment,
                      isActive && [styles.timeFilterSegmentActive, { backgroundColor: accentColor }],
                    ]}
                    activeOpacity={0.7}
                  >
                    <Iconify icon={filter.icon} size={16} color={isActive ? '#fff' : colors.subtext} />
                    <Text style={[
                      styles.timeFilterSegmentText,
                      { color: isActive ? '#fff' : colors.text, fontWeight: isActive ? '700' : '500' }
                    ]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.searchRow}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={t('common.searchDeckPlaceholder', 'Deste ara...')}
            style={styles.searchBar}
          />
          <FilterModalButton onPress={() => setFilterModalVisible(true)} />
        </View>
      </View>
    );
  };

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
          showPopularityBadge={activeTab === 'trend'}
          loading={loading}
          contentPaddingTop={20}
        />
      </View>

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        currentCategories={selectedCategories}
        onApply={handleApplyFilters}
        showSortOptions={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeaderContainer: {
    paddingTop: 12,
    paddingBottom: 12,
    zIndex: 10,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  listContainer: {
    flex: 1,
    marginTop: -16,
  },
  timeFilterWrapper: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  timeFilterSegmentedContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  timeFilterSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  timeFilterSegmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  timeFilterSegmentText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  searchBar: {
    flex: 1,
  },
  heroCarouselContainer: {
    marginBottom: 12,
  },
  heroCarouselContent: {
    paddingHorizontal: 16,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
  },
  modernHeroCard: {
    marginBottom: 8,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modernHeroGradient: {
    padding: 24,
    minHeight: 140,
    justifyContent: 'center',
  },
  modernHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernHeroIconContainer: {
    marginRight: 16,
  },
  modernIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  modernHeroTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  modernHeroTitle: {
    ...typography.styles.h2,
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  modernHeroSubtitle: {
    ...typography.styles.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
});
