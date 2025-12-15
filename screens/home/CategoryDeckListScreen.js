import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Platform, Modal as RNModal, TouchableWithoutFeedback } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Modal from 'react-native-modal';
import SearchBar from '../../components/tools/SearchBar';
import DeckList from '../../components/lists/DeckList';
import { supabase } from '../../lib/supabase';
import { getDecksByCategory } from '../../services/DeckService';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';
import { getCategoryConfig } from '../../components/ui/CategoryHeroHeader';

export default function CategoryDeckListScreen({ route }) {
  const { category, title, decks: initialDecks, favoriteDecks: initialFavoriteDecks } = route.params || {};
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  // 'default' | 'az' | 'favorites' | 'popularity'
  // default: created_at'a göre (en yeni en üstte)
  const [sort, setSort] = useState('default');
  // İçerik kategorileri (sort_order değerleri 1-8 arası)
  // 1: Dil, 2: Bilim, 3: Matematik, 4: Tarih, 5: Coğrafya, 6: Sanat ve Kültür, 7: Kişisel Gelişim, 8: Genel Kültür
  // Varsayılan: hiçbir checkbox seçili değil -> tüm kategoriler gösterilir
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [favoriteDecks, setFavoriteDecks] = useState(initialFavoriteDecks || []);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decks, setDecks] = useState(initialDecks || []);

  // Load favorite decks on component mount (only if not provided via params)
  useEffect(() => {
    if (!initialFavoriteDecks || initialFavoriteDecks.length === 0) {
      loadFavoriteDecks();
    }
    // If no initial decks provided, load them
    if (!initialDecks || initialDecks.length === 0) {
      loadDecks();
    }
  }, []);

  // Reload decks when category changes
  useEffect(() => {
    if (category) {
      loadDecks();
    }
  }, [category]);

  // Update favorite decks when route params change
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

  // Filter and sort decks based on search and sort criteria
  const filteredDecks = useMemo(() => {
    let filtered = decks.filter(deck => {
      // Search filter
      const matchesSearch = 
        (deck.name && deck.name.toLowerCase().includes(search.toLowerCase())) ||
        (deck.to_name && deck.to_name.toLowerCase().includes(search.toLowerCase()));

      // İçerik kategori filtresi (categories.sort_order)
      const deckSortOrder = deck.categories?.sort_order;
      const hasActiveCategoryFilter = selectedCategories.length > 0;
      // Eğer hiç kategori seçili değilse -> tüm kategoriler gösterilir
      const matchesCategory = !hasActiveCategoryFilter
        ? true
        : (deckSortOrder != null && selectedCategories.includes(deckSortOrder));

      // Favorites filter
      if (sort === 'favorites') {
        return matchesSearch && matchesCategory && favoriteDecks.includes(deck.id);
      }
      
      return matchesSearch && matchesCategory;
    });

    // Apply sorting
    switch (sort) {
      case 'default':
        // Sadece oluşturulma tarihine göre: en yeni en üstte
        filtered.sort((a, b) => {
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        });
        break;
      case 'az':
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'favorites':
        // Favoriler önce, sonra A-Z
        filtered.sort((a, b) => {
          const aIsFavorite = favoriteDecks.includes(a.id);
          const bIsFavorite = favoriteDecks.includes(b.id);
          if (aIsFavorite && !bIsFavorite) return -1;
          if (!aIsFavorite && bIsFavorite) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
        break;
      case 'popularity':
        // Sort by popularity score if available, otherwise by created_at
        filtered.sort((a, b) => {
          const scoreA = a.popularity_score || 0;
          const scoreB = b.popularity_score || 0;
          if (scoreA !== scoreB) {
            return scoreB - scoreA;
          }
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        });
        break;
      default:
        // Güvenlik için: default davranış created_at'a göre
        filtered.sort((a, b) => {
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        });
        break;
    }

    return filtered;
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

  const handleApplyFilters = (newSort, newCategories) => {
    setSort(newSort);
    setSelectedCategories(newCategories);
    setFilterModalVisible(false);
  };

  const renderFixedHeader = useCallback(() => {
    const config = getCategoryConfig(category, t);
    // Header yüksekliği: status bar + header (yaklaşık 44-56px) + safe area top + ekstra boşluk
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
            {/* Icon and Title Section */}
            <View style={styles.heroContent}>
              <View style={styles.heroIconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: config.accentColor + '20' }]}>
                  <Iconify icon={config.icon} size={28} color="#fff" />
                </View>
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>{title || t('home.allDecks', 'Tüm Desteler')}</Text>
                <Text style={styles.heroSubtitle}>{config.description}</Text>
              </View>
            </View>

            {/* Search and Filter Row */}
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
                colors={colors}
              />
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }, [category, title, search, sort, colors, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header Section */}
      {renderFixedHeader()}

      {/* List Content */}
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
          contentPaddingTop={20}
        />
      </View>

      {/* Filter Modal */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        currentSort={sort}
        currentCategories={selectedCategories}
        onApply={handleApplyFilters}
        colors={colors}
        t={t}
      />
    </View>
  );
}

// Filter Modal Button Component
const FilterModalButton = ({ onPress, colors }) => {
  return (
    <TouchableOpacity
      style={[styles.filterIconButton, { borderColor: 'rgba(255, 255, 255, 0.3)' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Iconify icon="mage:filter" size={24} color="#fff" />
    </TouchableOpacity>
  );
};

// Filter Modal Component
const FilterModal = ({ visible, onClose, currentSort, currentCategories, onApply, colors, t }) => {
  const [tempSort, setTempSort] = useState(currentSort);
  const [tempCategories, setTempCategories] = useState(currentCategories);
  const [sortDropdownVisible, setSortDropdownVisible] = useState(false);
  const sortDropdownRef = React.useRef(null);
  const [sortDropdownPos, setSortDropdownPos] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    setTempSort(currentSort);
    setTempCategories(currentCategories);
  }, [visible, currentSort, currentCategories]);

  const handleCategoryToggle = (categoryKey) => {
    setTempCategories(prev => {
      // Eğer seçiliyse kaldır, değilse ekle
      if (prev.includes(categoryKey)) {
        return prev.filter(cat => cat !== categoryKey);
      }
      return [...prev, categoryKey];
    });
  };

  const handleApply = () => {
    onApply(tempSort, tempCategories);
  };

  const sortOptions = [
    { key: 'default', label: t('common.defaultSort', 'Varsayılan (En Yeniler)') },
    { key: 'az', label: 'A-Z' },
    { key: 'favorites', label: t('common.favorites', 'Favoriler') },
    { key: 'popularity', label: t('discover.sortPopularity', 'Popülerlik') },
  ];

  const selectedSortLabel = sortOptions.find(opt => opt.key === tempSort)?.label || sortOptions[0].label;

  const openSortDropdown = () => {
    if (sortDropdownRef.current && sortDropdownRef.current.measureInWindow) {
      sortDropdownRef.current.measureInWindow((x, y, width, height) => {
        setSortDropdownPos({ x, y, width, height });
        setSortDropdownVisible(true);
      });
    } else {
      setSortDropdownVisible(true);
    }
  };

  const handleSortSelect = (sortKey) => {
    setTempSort(sortKey);
    setSortDropdownVisible(false);
  };

  const categoryOptions = [
    {
      sortOrder: 1,
      label: t('categories.1', 'Dil'),
      icon: 'hugeicons:language-skill',
    },
    {
      sortOrder: 2,
      label: t('categories.2', 'Bilim'),
      icon: 'clarity:atom-solid',
    },
    {
      sortOrder: 3,
      label: t('categories.3', 'Matematik'),
      icon: 'mdi:math-compass',
    },
    {
      sortOrder: 4,
      label: t('categories.4', 'Tarih'),
      icon: 'game-icons:tied-scroll',
    },
    {
      sortOrder: 5,
      label: t('categories.5', 'Coğrafya'),
      icon: 'arcticons:world-geography-alt',
    },
    {
      sortOrder: 6,
      label: t('categories.6', 'Sanat ve Kültür'),
      icon: 'map:museum',
    },
    {
      sortOrder: 7,
      label: t('categories.7', 'Kişisel Gelişim'),
      icon: 'ic:outline-self-improvement',
    },
    {
      sortOrder: 8,
      label: t('categories.8', 'Genel Kültür'),
      icon: 'garden:puzzle-piece-fill-16',
    },
  ];

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      useNativeDriver
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      backdropTransitionOutTiming={0}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>
            {t('common.filters')}
          </Text>
          <TouchableOpacity 
            onPress={onClose} 
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Sıralama Bölümü */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('common.sortBy')}
            </Text>
            <TouchableOpacity
              ref={sortDropdownRef}
              onPress={openSortDropdown}
              style={[styles.sortDropdown, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortDropdownText, { color: colors.text }]}>
                {selectedSortLabel}
              </Text>
              <Iconify icon="flowbite:caret-down-solid" size={20} color={colors.text} />
            </TouchableOpacity>

            {/* Dropdown Menu */}
            <RNModal
              visible={sortDropdownVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setSortDropdownVisible(false)}
            >
              <TouchableWithoutFeedback onPress={() => setSortDropdownVisible(false)}>
                <View style={{ flex: 1 }}>
                  <View style={[
                    styles.sortDropdownMenu,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      left: sortDropdownPos.x,
                      top: Platform.OS === 'android' ? sortDropdownPos.y + sortDropdownPos.height : sortDropdownPos.y + sortDropdownPos.height + 4,
                      minWidth: sortDropdownPos.width,
                    }
                  ]}>
                    {sortOptions.map((option) => (
                      <TouchableOpacity
                        key={option.key}
                        onPress={() => handleSortSelect(option.key)}
                        style={[
                          styles.sortDropdownItem,
                          tempSort === option.key && { backgroundColor: colors.buttonColor + '20' }
                        ]}
                      >
                        <Text style={[
                          styles.sortDropdownItemText,
                          { 
                            color: tempSort === option.key ? colors.buttonColor : colors.text,
                            fontWeight: tempSort === option.key ? '600' : 'normal'
                          }
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </RNModal>
          </View>

          {/* Kategori Bölümü */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('common.categories')}
            </Text>
            {categoryOptions.map((option) => {
              const isSelected = tempCategories.includes(option.sortOrder);
              return (
                <TouchableOpacity
                  key={option.sortOrder}
                  onPress={() => handleCategoryToggle(option.sortOrder)}
                  style={[
                    styles.categoryOption,
                    isSelected && { backgroundColor: colors.buttonColor + '20' }
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryOptionContent}>
                    <View style={[
                      styles.checkbox,
                      { 
                        borderColor: isSelected ? colors.buttonColor : colors.border,
                        backgroundColor: isSelected ? colors.buttonColor : 'transparent'
                      }
                    ]}>
                      {isSelected && (
                        <Iconify icon="hugeicons:tick-01" size={18} color="#fff" />
                      )}
                    </View>
                    <Iconify 
                      icon={option.icon} 
                      size={22} 
                      color={isSelected ? colors.buttonColor : colors.text}
                      style={styles.categoryIcon}
                    />
                    <Text style={[
                      styles.categoryOptionText,
                      { 
                        color: isSelected ? colors.buttonColor : colors.text,
                        fontWeight: isSelected ? '600' : 'normal'
                      }
                    ]}>
                      {option.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Footer Buttons */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.resetButton, { borderColor: colors.border }]}
            onPress={() => onApply('default', [])}
            activeOpacity={0.8}
          >
            <Text style={[styles.resetButtonText, { color: colors.text }]}>
              {t('common.reset')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApply}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#F98A21', '#FF6B35']}
              locations={[0, 0.99]}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.applyButtonText}>
                {t('common.apply')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeaderContainer: {
    zIndex: 1,
    overflow: 'hidden',
  },
  fixedHeaderGradient: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 0,
  },
  headerContent: {
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 20,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroIconContainer: {
    marginRight: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  heroTitle: {
    ...typography.styles.h2,
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    ...typography.styles.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  searchBar: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    marginTop: -20,
    zIndex: 2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
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
  modalContainer: {
    borderRadius: 24,
    padding: 0,
    height: '80%',
    width: '98%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...typography.styles.h3,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  sortDropdownText: {
    fontSize: 16,
    flex: 1,
  },
  sortDropdownMenu: {
    position: 'absolute',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    maxHeight: 200,
  },
  sortDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sortDropdownItemText: {
    fontSize: 16,
  },
  categoryOption: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIcon: {
    marginRight: 12,
  },
  categoryOptionText: {
    fontSize: 16,
    flex: 1,
  },
  modalFooter: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  resetButton: {
    flex: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  applyButton: {
    flex: 2,
    borderRadius: 99,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  gradientButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 99,
  },
  applyButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

