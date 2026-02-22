import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Platform, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import SearchBar from '../../components/tools/SearchBar';
import DeckList from '../../components/lists/DeckList';
import DiscoverDecksSkeleton from '../../components/skeleton/DiscoverDecksSkeleton';
import { supabase } from '../../lib/supabase';
import { getPopularDecks, getNewDecks, getMostFavoritedDecks, getMostStartedDecks, getMostUniqueStartedDecks } from '../../services/DeckService';
import { cacheDiscoverDecks, getCachedDiscoverDecks } from '../../services/CacheService';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import FilterModal, { FilterModalButton } from '../../components/modals/FilterModal';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';

export default function DiscoverScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();

  const HERO_CARD_WIDTH = useMemo(() => {
    return width - scale(32);
  }, [width]);

  const heroDimensions = useMemo(() => ({
    iconSize: scale(64),
    iconBorderRadius: moderateScale(32),
    iconBorderWidth: moderateScale(2),
    iconInnerSize: moderateScale(28),
    titleFontSize: moderateScale(28),
    subtitleFontSize: moderateScale(15),
    subtitleLineHeight: moderateScale(20),
    heroContentMarginRight: scale(16),
    heroGradientPadding: moderateScale(24),
    heroGradientMinHeight: verticalScale(140),
    titleMarginBottom: verticalScale(6),
    heroCarouselPaddingHorizontal: scale(16),
    paginationDotHeight: verticalScale(8),
    paginationDotWidth: scale(8),
    paginationDotActiveWidth: scale(24),
    paginationGap: scale(6),
    paginationMarginTop: verticalScale(12),
    timeFilterWrapperPadding: scale(16),
    timeFilterWrapperMarginBottom: verticalScale(8),
    searchRowGap: scale(12),
    searchRowPadding: scale(16),
    searchRowMarginTop: verticalScale(8),
    fixedHeaderPaddingTop: verticalScale(12),
    fixedHeaderPaddingBottom: verticalScale(12),
  }), []);

  const [activeTab, setActiveTab] = useState('trend');
  const [timeFilter, setTimeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedTabs, setLoadedTabs] = useState(new Set());
  const [trendDecksList, setTrendDecksList] = useState([]);
  const [favoriteDecksList, setFavoriteDecksList] = useState([]);
  const [startedDecksList, setStartedDecksList] = useState([]);
  const [uniqueDecksList, setUniqueDecksList] = useState([]);
  const [newDecks, setNewDecks] = useState([]);
  const heroScrollRef = useRef(null);
  const isUserScrolling = useRef(false);
  const loadDecksTimeoutRef = useRef(null);
  const isRefreshingRef = useRef(false);
  const [selectedLanguages, setSelectedLanguages] = useState([]); // Seçili diller
  const [allLanguages, setAllLanguages] = useState([]);

  useEffect(() => {
    loadFavoriteDecks();
    // loadDecks() ikinci useEffect'te yapılıyor (ilk mount'ta)
  }, []);

  useEffect(() => {
    const fetchLanguages = async () => {
      const { data } = await supabase
        .from('languages')
        .select('*')
        .order('sort_order', { ascending: true });
      if (data) setAllLanguages(data);
    };
    fetchLanguages();
  }, []);

  const previousTimeFilterRef = useRef(timeFilter);
  const previousActiveTabRef = useRef(activeTab);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Tab veya timeFilter değişti mi kontrol et
    const tabChanged = previousActiveTabRef.current !== activeTab;
    const timeFilterChanged = previousTimeFilterRef.current !== timeFilter;

    // İlk mount'ta veya tab değiştiyse veya timeFilter değiştiyse yükle
    if (isInitialMount.current || tabChanged || timeFilterChanged) {
      // timeFilter değiştiğinde o tab'ı loadedTabs'tan kaldır
      if (timeFilterChanged && !isInitialMount.current) {
        setLoadedTabs(prev => {
          const newSet = new Set(prev);
          newSet.delete(activeTab);
          return newSet;
        });
      }

      // Debouncing: Hızlı geçişlerde gereksiz çağrıları önle
      if (loadDecksTimeoutRef.current) {
        clearTimeout(loadDecksTimeoutRef.current);
      }

      loadDecksTimeoutRef.current = setTimeout(() => {
        loadDecks();
        loadDecksTimeoutRef.current = null;
      }, 150); // 150ms debounce

      isInitialMount.current = false;
    }

    previousActiveTabRef.current = activeTab;
    previousTimeFilterRef.current = timeFilter;

    // Cleanup: Component unmount olduğunda timeout'u temizle
    return () => {
      if (loadDecksTimeoutRef.current) {
        clearTimeout(loadDecksTimeoutRef.current);
        loadDecksTimeoutRef.current = null;
      }
    };
  }, [timeFilter, activeTab, loadDecks]);

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
  }, [activeTab, HERO_CARD_WIDTH]);

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

  const loadFreshData = useCallback(async (showLoadingIndicator = true) => {
    try {
      if (showLoadingIndicator) {
        setLoading(true);
      }

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

      // Veriyi cache'le
      await cacheDiscoverDecks(activeTab, timeFilter, decks || []);
    } catch (error) {
      console.error('Error loading decks:', error);
      if (activeTab === 'trend') setTrendDecksList([]);
      else if (activeTab === 'favorites') setFavoriteDecksList([]);
      else if (activeTab === 'starts') setStartedDecksList([]);
      else if (activeTab === 'unique') setUniqueDecksList([]);
      else setNewDecks([]);
    } finally {
      setLoading(false);
      setLoadedTabs(prev => new Set([...prev, activeTab]));
    }
  }, [activeTab, timeFilter]);

  const loadDecks = useCallback(async (forceRefresh = false) => {
    // Debouncing: Eğer zaten bir yükleme varsa iptal et
    if (loadDecksTimeoutRef.current) {
      clearTimeout(loadDecksTimeoutRef.current);
      loadDecksTimeoutRef.current = null;
    }

    // Cache'den hemen veriyi yükle (stale-while-revalidate)
    const cachedData = await getCachedDiscoverDecks(activeTab, timeFilter);

    // Eğer cache varsa ve force refresh değilse, hemen göster
    if (cachedData && !forceRefresh && cachedData.data && cachedData.data.length > 0) {
      // Cache'den veriyi hemen göster
      if (activeTab === 'trend') {
        setTrendDecksList(cachedData.data);
      } else if (activeTab === 'favorites') {
        setFavoriteDecksList(cachedData.data);
      } else if (activeTab === 'starts') {
        setStartedDecksList(cachedData.data);
      } else if (activeTab === 'unique') {
        setUniqueDecksList(cachedData.data);
      } else {
        setNewDecks(cachedData.data);
      }

      // Cache'den veri geldiğinde loading'i false yap
      setLoading(false);
      setLoadedTabs(prev => new Set([...prev, activeTab]));

      // Eğer cache stale ise, arka planda fresh data yükle (loading gösterme)
      if (cachedData.isStale) {
        loadFreshData(false); // showLoadingIndicator = false
      }
    } else {
      // Cache yoksa veya force refresh ise, normal yükleme yap
      await loadFreshData(true); // showLoadingIndicator = true
    }
  }, [activeTab, timeFilter, loadFreshData]);

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
    const filtered = currentDecks.filter(deck => {
      // 1. Arama Kontrolü
      const matchesSearch =
        (deck.name && deck.name.toLowerCase().includes(search.toLowerCase())) ||
        (deck.to_name && deck.to_name.toLowerCase().includes(search.toLowerCase()));

      // 2. Kategori Kontrolü
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

      return matchesSearch && matchesCategory && matchesLanguage;
    });

    return filtered.map((deck) => {
      // ... admin created mantığın (Knowia) aynen kalsın
      if (deck.is_admin_created) {
        return { ...deck, profiles: { ...deck.profiles, username: 'Knowia', image_url: null } };
      }
      return deck;
    });
  }, [currentDecks, search, selectedCategories, selectedLanguages]); // <--- selectedLanguages BURAYA EKLENDİ

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
    isRefreshingRef.current = true;
    try {
      await Promise.all([loadFavoriteDecks(), loadDecks(true)]); // forceRefresh = true
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
      isRefreshingRef.current = false;
    }
  };

  const handleApplyFilters = (newCategories, newLanguages) => {
    setSelectedCategories(newCategories);
    setSelectedLanguages(newLanguages || []); // Yeni dilleri kaydet
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
    const headerPaddingTop = headerHeight + verticalScale(50);

    return (
      <View style={[
        styles.fixedHeaderContainer,
        {
          backgroundColor: colors.cardBackground,
          paddingTop: headerPaddingTop,
          paddingBottom: heroDimensions.fixedHeaderPaddingBottom,
        }
      ]}>
        <View style={styles.heroCarouselContainer}>
          <ScrollView
            ref={heroScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleHeroScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleHeroScroll}
            contentContainerStyle={[
              styles.heroCarouselContent,
              { paddingHorizontal: heroDimensions.heroCarouselPaddingHorizontal }
            ]}
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
                    style={[
                      styles.modernHeroGradient,
                      {
                        padding: heroDimensions.heroGradientPadding,
                        minHeight: heroDimensions.heroGradientMinHeight,
                      }
                    ]}
                  >
                    <View style={styles.modernHeroContent}>
                      <View style={[styles.modernHeroIconContainer, { marginRight: heroDimensions.heroContentMarginRight }]}>
                        <View style={[
                          styles.modernIconCircle,
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
                      <View style={styles.modernHeroTextContainer}>
                        <Text style={[
                          styles.modernHeroTitle,
                          {
                            fontSize: heroDimensions.titleFontSize,
                            marginBottom: heroDimensions.titleMarginBottom,
                          }
                        ]}>
                          {config.title}
                        </Text>
                        <Text style={[
                          styles.modernHeroSubtitle,
                          {
                            fontSize: heroDimensions.subtitleFontSize,
                            lineHeight: heroDimensions.subtitleLineHeight,
                          }
                        ]}>
                          {config.subtitle}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              );
            })}
          </ScrollView>

          <View style={[
            styles.paginationContainer,
            {
              gap: heroDimensions.paginationGap,
              marginTop: heroDimensions.paginationMarginTop,
            }
          ]}>
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
                      width: isActive ? heroDimensions.paginationDotActiveWidth : heroDimensions.paginationDotWidth,
                      height: heroDimensions.paginationDotHeight,
                    }
                  ]}
                />
              );
            })}
          </View>
        </View>

        {activeTab !== 'new' && (
          <View style={[
            styles.timeFilterWrapper,
            {
              paddingHorizontal: heroDimensions.timeFilterWrapperPadding,
              marginBottom: heroDimensions.timeFilterWrapperMarginBottom,
            }
          ]}>
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
                    <Iconify icon={filter.icon} size={moderateScale(16)} color={isActive ? '#fff' : colors.subtext} />
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

        <View style={[
          styles.searchRow,
          {
            gap: heroDimensions.searchRowGap,
            paddingHorizontal: heroDimensions.searchRowPadding,
            marginTop: heroDimensions.searchRowMarginTop,
          }
        ]}>
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
        {loading || !loadedTabs.has(activeTab) ? (
          <DiscoverDecksSkeleton />
        ) : (
          <DeckList
            decks={filteredDecks}
            favoriteDecks={favoriteDecks}
            onToggleFavorite={handleToggleFavorite}
            onPressDeck={handleDeckPress}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showPopularityBadge={activeTab === 'trend'}
            contentPaddingTop={verticalScale(20)}
          />
        )}
      </View>

      <FilterModal
        visible={filterModalVisible}
        languages={allLanguages} // Tüm diller
        currentLanguages={selectedLanguages} // Seçili diller
        currentCategories={selectedCategories}
        onClose={() => setFilterModalVisible(false)}
        onApply={(cats, langs) => handleApplyFilters(cats, langs)} // Dil parametresini ekledik
        showSortOptions={false} // Discover ekranındaki ihtiyacına göre
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeaderContainer: {
    zIndex: 10,
    borderBottomLeftRadius: moderateScale(36),
    borderBottomRightRadius: moderateScale(36),
    // paddingTop, paddingBottom dinamik olarak uygulanacak
  },
  listContainer: {
    flex: 1,
    marginTop: verticalScale(-16),
  },
  timeFilterWrapper: {
    paddingHorizontal: scale(16),
    marginBottom: verticalScale(8),
  },
  timeFilterSegmentedContainer: {
    flexDirection: 'row',
    borderRadius: moderateScale(16),
    padding: moderateScale(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(8),
    elevation: 3,
  },
  timeFilterSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(8),
    borderRadius: moderateScale(12),
    gap: scale(4),
  },
  timeFilterSegmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(4) },
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(8),
    elevation: 4,
  },
  timeFilterSegmentText: {
    fontSize: moderateScale(12),
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingHorizontal: scale(16),
    marginTop: verticalScale(8),
  },
  searchBar: {
    flex: 1,
  },
  heroCarouselContainer: {
    marginBottom: verticalScale(12),
  },
  heroCarouselContent: {
    paddingHorizontal: scale(16),
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: verticalScale(12),
    gap: scale(6),
  },
  paginationDot: {
    height: verticalScale(8),
    borderRadius: moderateScale(4),
  },
  modernHeroCard: {
    marginBottom: verticalScale(8),
    borderRadius: moderateScale(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(8) },
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(16),
    elevation: 8,
  },
  modernHeroGradient: {
    padding: moderateScale(24),
    minHeight: verticalScale(140),
    justifyContent: 'center',
  },
  modernHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernHeroIconContainer: {
    marginRight: scale(16),
  },
  modernIconCircle: {
    width: scale(64),
    height: scale(64),
    borderRadius: moderateScale(32),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: moderateScale(2),
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  modernHeroTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  modernHeroTitle: {
    ...typography.styles.h2,
    color: '#fff',
    fontSize: moderateScale(28),
    fontWeight: '900',
    marginBottom: verticalScale(6),
    letterSpacing: -0.5,
  },
  modernHeroSubtitle: {
    ...typography.styles.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: moderateScale(15),
    fontWeight: '500',
    lineHeight: verticalScale(20),
  },
});
