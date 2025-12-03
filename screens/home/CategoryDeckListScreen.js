import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import SearchBar from '../../components/tools/SearchBar';
import DeckList from '../../components/lists/DeckList';
import { supabase } from '../../lib/supabase';
import { getPopularDecks, getNewDecks, getMostFavoritedDecks, getMostStartedDecks, getMostUniqueStartedDecks } from '../../services/DeckService';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';
import { Modal, TouchableWithoutFeedback, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassBlurCard from '../../components/ui/GlassBlurCard';

const { width } = Dimensions.get('window');

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

export default function CategoryDeckListScreen({ route }) {
  const { title } = route.params || {};
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('trend'); // 'trend' | 'favorites' | 'starts' | 'unique' | 'new'
  const [timeFilter, setTimeFilter] = useState('all'); // 'today' | 'week' | 'month' | 'year' | 'all'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popularity'); // 'popularity' | 'az' | 'new'
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false); // Start with false - UI shows immediately
  const [trendDecksList, setTrendDecksList] = useState([]);
  const [favoriteDecksList, setFavoriteDecksList] = useState([]);
  const [startedDecksList, setStartedDecksList] = useState([]);
  const [uniqueDecksList, setUniqueDecksList] = useState([]);
  const [newDecks, setNewDecks] = useState([]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
      
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
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

  // Filter and sort decks based on search, category, and sort criteria
  const filteredDecks = useMemo(() => {
    let filtered = currentDecks.filter(deck => {
      // Search filter
      const matchesSearch = 
        (deck.name && deck.name.toLowerCase().includes(search.toLowerCase())) ||
        (deck.to_name && deck.to_name.toLowerCase().includes(search.toLowerCase()));
      
      // Category filter
      const matchesCategory = !selectedCategory || deck.categories?.id === selectedCategory;
      
      return matchesSearch && matchesCategory;
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
  }, [currentDecks, search, sort, selectedCategory, activeTab]);

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
    setActiveTab(tabs[pageIndex] || 'trend');
  }, [activeTab]);

  const timeFilters = [
    { key: 'today', label: t('discover.today', 'Bugün'), icon: 'mdi:fire' },
    { key: 'week', label: t('discover.week', 'Bu Hafta'), icon: 'solar:chart-2-bold-duotone' },
    { key: 'month', label: t('discover.month', 'Bu Ay'), icon: 'solar:chart-2-bold-duotone' },
    { key: 'year', label: t('discover.year', 'Bu Yıl'), icon: 'solar:chart-2-bold-duotone' },
    { key: 'all', label: t('discover.allTime', 'Tümü'), icon: 'streamline:trending-content-remix' },
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
      title: t('discover.mostStarted', 'Başlatmalar'),
      subtitle: t('discover.mostStartedSubtitle', 'En çok başlatılan desteler'),
      icon: 'mdi:fire',
      gradient: ['#fa709a', '#fee140'],
      accentColor: '#ff6b35',
    },
    unique: {
      title: t('discover.mostUnique', 'Farklı Kişi'),
      subtitle: t('discover.mostUniqueSubtitle', 'En geniş kullanıcı kitlesine sahip desteler'),
      icon: 'fluent:people-community-20-filled',
      gradient: ['#4facfe', '#00f2fe'],
      accentColor: '#6f8ead',
    },
    new: {
      title: t('discover.newDecks', 'Yeni'),
      subtitle: t('discover.newSubtitle', 'Yeni eklenen desteler'),
      icon: 'mdi:cards',
      gradient: ['#43e97b', '#38f9d7'],
      accentColor: '#6f8ead',
    },
  };

  const ListHeaderComponent = useCallback(() => {
    const config = tabConfigs[activeTab];
    
    return (
      <View style={styles.headerContainer}>
        {/* Modern Minimal Hero Section */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.modernHeroCard}>
            <LinearGradient
              colors={[...config.gradient, ...config.gradient.slice().reverse()]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modernHeroGradient}
            >
              <View style={styles.modernHeroContent}>
                <View style={styles.modernHeroIconContainer}>
                  <View style={[styles.modernIconCircle, { backgroundColor: config.accentColor + '20' }]}>
                    <Iconify icon={config.icon} size={28} color={config.accentColor} />
                  </View>
                </View>
                <View style={styles.modernHeroTextContainer}>
                  <Text style={styles.modernHeroTitle}>{config.title}</Text>
                  <Text style={styles.modernHeroSubtitle}>{config.subtitle}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Time Filter - Show for all tabs except 'new' */}
        {activeTab !== 'new' && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timeFilterContainer}
            style={styles.timeFilterScroll}
          >
            {timeFilters.map((filter) => (
              <TouchableOpacity
                key={filter.key}
                onPress={() => {
                  setTimeFilter(filter.key);
                  fadeAnim.setValue(0);
                }}
              style={[
                styles.timeFilterButton,
                {
                  backgroundColor: timeFilter === filter.key 
                    ? tabConfigs[activeTab]?.accentColor || colors.buttonColor 
                    : 'rgba(255, 255, 255, 0.1)',
                  borderColor: timeFilter === filter.key 
                    ? tabConfigs[activeTab]?.accentColor || colors.buttonColor 
                    : 'rgba(255, 255, 255, 0.2)',
                }
              ]}
              >
              <Iconify 
                icon={filter.icon} 
                size={14} 
                color={timeFilter === filter.key ? '#fff' : 'rgba(255, 255, 255, 0.7)'} 
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.timeFilterText,
                  {
                    color: timeFilter === filter.key ? '#fff' : 'rgba(255, 255, 255, 0.8)',
                    fontWeight: timeFilter === filter.key ? '700' : '500',
                  }
                ]}
              >
                {filter.label}
              </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
  }, [activeTab, timeFilter, search, sort, colors, t, fadeAnim]);

  const tabs = [
    { key: 'trend', label: t('discover.trend', 'Trend'), icon: 'fluent:arrow-trending-sparkle-24-filled' },
    { key: 'favorites', label: t('discover.favorites', 'Favoriler'), icon: 'solar:heart-bold' },
    { key: 'starts', label: t('discover.starts', 'Başlatmalar'), icon: 'mdi:fire' },
    { key: 'unique', label: t('discover.unique', 'Farklı Kişi'), icon: 'fluent:people-community-20-filled' },
    { key: 'new', label: t('discover.new', 'Yeni'), icon: 'mdi:cards' },
  ];

  const scrollViewRef = useRef(null);
  const tabPositions = useRef({});
  const chipWidth = 120; // Approximate chip width including padding and margin

  useEffect(() => {
    // Scroll to active tab when it changes
    const activeIndex = tabs.findIndex(tab => tab.key === activeTab);
    if (activeIndex >= 0) {
      const scrollPosition = Math.max(0, (activeIndex * chipWidth) - (width / 2) + (chipWidth / 2));
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: scrollPosition,
          animated: true,
        });
      }, 100);
    }
  }, [activeTab]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Modern Chip Tabs */}
      <View style={[styles.chipTabsContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipTabsScrollContainer}
          style={styles.chipTabsScroll}
        >
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.key;
            const config = tabConfigs[tab.key];
            
            return (
              <TouchableOpacity
                key={tab.key}
                onLayout={(e) => {
                  tabPositions.current[tab.key] = e.nativeEvent.layout.x;
                }}
                style={[
                  styles.chipTab,
                  {
                    backgroundColor: isActive 
                      ? config.accentColor 
                      : colors.cardBackground,
                    borderColor: isActive 
                      ? config.accentColor 
                      : colors.border,
                  }
                ]}
                activeOpacity={0.7}
                onPress={() => handleSetPage(index)}
              >
                <Iconify 
                  icon={tab.icon} 
                  size={18} 
                  color={isActive ? '#fff' : colors.subtext}
                  style={{ marginRight: 8 }}
                />
                <Text style={[
                  styles.chipTabLabel,
                  {
                    color: isActive ? '#fff' : colors.text,
                    fontWeight: isActive ? '700' : '600',
                  }
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content - No animation, instant switch */}
      <View style={styles.pagerView}>
        {activeTab === 'trend' && (
          <DeckList
            decks={filteredDecks}
            favoriteDecks={favoriteDecks}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            ListHeaderComponent={ListHeaderComponent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={true}
            loading={loading && activeTab === 'trend'}
          />
        )}

        {activeTab === 'favorites' && (
          <DeckList
            decks={filteredDecks}
            favoriteDecks={favoriteDecks}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            ListHeaderComponent={ListHeaderComponent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={false}
            loading={loading && activeTab === 'favorites'}
          />
        )}

        {activeTab === 'starts' && (
          <DeckList
            decks={filteredDecks}
            favoriteDecks={favoriteDecks}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            ListHeaderComponent={ListHeaderComponent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={false}
            loading={loading && activeTab === 'starts'}
          />
        )}

        {activeTab === 'unique' && (
          <DeckList
            decks={filteredDecks}
            favoriteDecks={favoriteDecks}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            ListHeaderComponent={ListHeaderComponent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={false}
            loading={loading && activeTab === 'unique'}
          />
        )}

        {activeTab === 'new' && (
          <DeckList
            decks={filteredDecks}
            favoriteDecks={favoriteDecks}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            ListHeaderComponent={ListHeaderComponent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={false}
            loading={loading && activeTab === 'new'}
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
  chipTabsContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  chipTabsScroll: {
    flexGrow: 0,
  },
  chipTabsScrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  chipTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chipTabLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  pagerView: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: 20,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  timeFilterContainer: {
    paddingBottom: 16,
    paddingHorizontal: 4,
    gap: 10,
  },
  timeFilterScroll: {
    marginBottom: 12,
  },
  timeFilterText: {
    fontSize: 14,
    fontWeight: '500',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernHeroCard: {
    marginBottom: 20,
    marginHorizontal: 16,
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
  },
  modernHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
  timeFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
});
