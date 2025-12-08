import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Dimensions, Modal, TouchableWithoutFeedback, Platform } from 'react-native';
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

const { width } = Dimensions.get('window');
const HERO_CARD_WIDTH = width - 32; // Full width minus horizontal padding

// Sort Menu Component
const SortMenu = ({ value, onChange, activeTab, colors, t }) => {
  const [visible, setVisible] = useState(false);
  const buttonRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const openMenu = () => {
    if (buttonRef.current && buttonRef.current.measureInWindow) {
      buttonRef.current.measureInWindow((x, y, width, height) => {
        setDropdownPos({ x, y, width, height });
        setVisible(true);
      });
    } else {
      setVisible(true);
    }
  };

  const handleSelect = (newValue) => {
    setVisible(false);
    if (onChange) onChange(newValue);
  };

  const sortOptions = activeTab === 'new'
    ? [
        { key: 'new', label: t('discover.sortNew', 'Yeni') },
        { key: 'popularity', label: t('discover.sortPopularity', 'Popülerlik') },
        { key: 'az', label: 'A-Z' },
      ]
    : [
        { key: 'popularity', label: t('discover.sortPopularity', 'Popülerlik') },
        { key: 'az', label: 'A-Z' },
        { key: 'new', label: t('discover.sortNew', 'Yeni') },
      ];

  return (
    <>
      <TouchableOpacity
        ref={buttonRef}
        style={[styles.filterIconButton, { borderColor: colors.border }]}
        onPress={openMenu}
        activeOpacity={0.8}
      >
        <Iconify icon="mage:filter" size={24} color={colors.subtext} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={{ flex: 1 }}>
            <View style={{
              position: 'absolute',
              left: Math.max(8, dropdownPos.x + dropdownPos.width - 140),
              top: Platform.OS === 'android' ? dropdownPos.y + dropdownPos.height : dropdownPos.y + dropdownPos.height + 4,
              minWidth: 140,
              maxWidth: 160,
              backgroundColor: colors.background,
              borderRadius: 14,
              paddingVertical: 6,
              paddingHorizontal: 0,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.10,
              shadowRadius: 8,
              elevation: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              {sortOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => handleSelect(option.key)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    backgroundColor: value === option.key ? colors.buttonColor : 'transparent',
                    borderRadius: 8,
                  }}
                >
                  <Text style={{
                    color: value === option.key ? '#fff' : colors.text,
                    fontWeight: value === option.key ? 'bold' : 'normal',
                    fontSize: 15
                  }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

export default function DiscoverScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('trend'); // 'trend' | 'favorites' | 'starts' | 'unique' | 'new'
  const [timeFilter, setTimeFilter] = useState('all'); // 'today' | 'week' | 'month' | 'year' | 'all'
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popularity'); // 'popularity' | 'az' | 'new'
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trendDecksList, setTrendDecksList] = useState([]);
  const [favoriteDecksList, setFavoriteDecksList] = useState([]);
  const [startedDecksList, setStartedDecksList] = useState([]);
  const [uniqueDecksList, setUniqueDecksList] = useState([]);
  const [newDecks, setNewDecks] = useState([]);

  // Load favorite decks on component mount
  useEffect(() => {
    loadFavoriteDecks();
    // Load decks asynchronously - don't block UI
    loadDecks();
  }, []);

  // Reload decks when time filter or tab changes
  useEffect(() => {
    // Only set loading if we're switching tabs (not initial load)
    if (trendDecksList.length > 0 || favoriteDecksList.length > 0 || startedDecksList.length > 0 || uniqueDecksList.length > 0 || newDecks.length > 0) {
      loadDecks();
    }
  }, [timeFilter, activeTab]);

  // Update scroll position when activeTab changes (only if not user scrolling)
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
      
      const favoriteDeckIds = data.map(item => item.deck_id);
      setFavoriteDecks(favoriteDeckIds);
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
      if (activeTab === 'trend') {
        setTrendDecksList([]);
      } else if (activeTab === 'favorites') {
        setFavoriteDecksList([]);
      } else if (activeTab === 'starts') {
        setStartedDecksList([]);
      } else if (activeTab === 'unique') {
        setUniqueDecksList([]);
      } else {
        setNewDecks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentDecks = useMemo(() => {
    switch (activeTab) {
      case 'trend':
        return trendDecksList;
      case 'favorites':
        return favoriteDecksList;
      case 'starts':
        return startedDecksList;
      case 'unique':
        return uniqueDecksList;
      case 'new':
        return newDecks;
      default:
        return [];
    }
  }, [activeTab, trendDecksList, favoriteDecksList, startedDecksList, uniqueDecksList, newDecks]);

  // Filter and sort decks based on search and sort criteria
  const filteredDecks = useMemo(() => {
    let filtered = currentDecks.filter(deck => {
      // Search filter
      const matchesSearch = 
        (deck.name && deck.name.toLowerCase().includes(search.toLowerCase())) ||
        (deck.to_name && deck.to_name.toLowerCase().includes(search.toLowerCase()));
      
      return matchesSearch;
    });

    // Apply sorting
    switch (sort) {
      case 'az':
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'new':
        filtered.sort((a, b) => {
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        });
        break;
      case 'popularity':
      default:
        if (activeTab === 'trend') {
          filtered.sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0));
        } else if (activeTab === 'favorites') {
          filtered.sort((a, b) => (b.favorite_count || 0) - (a.favorite_count || 0));
        } else if (activeTab === 'starts') {
          filtered.sort((a, b) => (b.total_starts_count || 0) - (a.total_starts_count || 0));
        } else if (activeTab === 'unique') {
          filtered.sort((a, b) => (b.unique_started_count || 0) - (a.unique_started_count || 0));
        } else {
          // For new decks, keep created_at order
          filtered.sort((a, b) => {
            const dateA = new Date(a.created_at || 0);
            const dateB = new Date(b.created_at || 0);
            return dateB - dateA;
          });
        }
        break;
    }

    return filtered;
  }, [currentDecks, search, sort, activeTab]);

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
          .insert({
            user_id: user.id,
            deck_id: deckId
          });
        
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
      await Promise.all([
        loadFavoriteDecks(),
        loadDecks()
      ]);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSetPage = useCallback((pageIndex) => {
    const tabs = ['trend', 'favorites', 'starts', 'unique', 'new'];
    const currentIndex = tabs.findIndex(tab => tab === activeTab);
    
    // If clicking the same tab, do nothing
    if (currentIndex === pageIndex) return;
    
    // Update state immediately (no animation)
    // useEffect will handle the scroll
    setActiveTab(tabs[pageIndex] || 'trend');
  }, [activeTab]);

  // Hero carousel refs and scroll handler
  const heroScrollRef = useRef(null);
  const isUserScrolling = useRef(false);

  const handleHeroScroll = useCallback((event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / HERO_CARD_WIDTH);
    const tabKeys = ['trend', 'favorites', 'starts', 'unique', 'new'];
    
    if (pageIndex >= 0 && pageIndex < tabKeys.length) {
      const newTab = tabKeys[pageIndex];
      if (newTab !== activeTab) {
        isUserScrolling.current = true;
        setActiveTab(newTab);
        setTimeout(() => {
          isUserScrolling.current = false;
        }, 300);
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

  // Tab configurations - Modern, creative design
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
    // Header yüksekliği: status bar + header (yaklaşık 44-56px) + safe area top + ekstra boşluk
    const headerHeight = Platform.OS === 'ios' ? insets.top + 44 : 56;
    
    return (
      <View style={[styles.fixedHeaderContainer, { backgroundColor: colors.cardBackground, paddingTop: headerHeight + 50 }]}>
        {/* Hero Cards Carousel */}
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
          
          {/* Pagination Dots */}
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

        {/* Time Filter - Modern Segmented Control */}
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
                    <Iconify 
                      icon={filter.icon} 
                      size={16} 
                      color={isActive ? '#fff' : colors.subtext} 
                    />
                    <Text
                      style={[
                        styles.timeFilterSegmentText,
                        {
                          color: isActive ? '#fff' : colors.text,
                          fontWeight: isActive ? '700' : '500',
                        }
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Search and Filter Row */}
        <View style={styles.searchRow}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={t('common.searchDeckPlaceholder', 'Deste ara...')}
            style={styles.searchBar}
          />
          <SortMenu value={sort} onChange={setSort} activeTab={activeTab} colors={colors} t={t} />
        </View>
      </View>
    );
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header Section */}
      {renderFixedHeader()}

      {/* List Content */}
      <View style={[styles.listContainer, { backgroundColor: colors.background }]}>
        {activeTab === 'trend' && (
          <DeckList
            decks={filteredDecks}
            favoriteDecks={favoriteDecks}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={true}
            loading={loading && activeTab === 'trend'}
            contentPaddingTop={20}
          />
        )}

        {activeTab === 'favorites' && (
          <DeckList
            decks={filteredDecks}
            favoriteDecks={favoriteDecks}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={false}
            loading={loading && activeTab === 'favorites'}
            contentPaddingTop={20}
          />
        )}

        {activeTab === 'starts' && (
          <DeckList
            decks={filteredDecks}
            favoriteDecks={favoriteDecks}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={false}
            loading={loading && activeTab === 'starts'}
            contentPaddingTop={20}
          />
        )}

        {activeTab === 'unique' && (
          <DeckList
            decks={filteredDecks}
            favoriteDecks={favoriteDecks}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={false}
            loading={loading && activeTab === 'unique'}
            contentPaddingTop={20}
          />
        )}

        {activeTab === 'new' && (
          <DeckList
            decks={filteredDecks}
            favoriteDecks={favoriteDecks}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={false}
            loading={loading && activeTab === 'new'}
            contentPaddingTop={20}
          />
        )}
      </View>
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
  filterIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    height: 48,
    width: 48,
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
    transition: 'width 0.3s ease',
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

