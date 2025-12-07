import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Modal, TouchableWithoutFeedback, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import SearchBar from '../../components/tools/SearchBar';
import DeckList from '../../components/lists/DeckList';
import { supabase } from '../../lib/supabase';
import { getDecksByCategory } from '../../services/DeckService';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';
import CategoryHeroHeader, { getCategoryConfig } from '../../components/ui/CategoryHeroHeader';

export default function CategoryDeckListScreen({ route }) {
  const { category, title, decks: initialDecks } = route.params || {};
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popularity'); // 'popularity' | 'az' | 'new'
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decks, setDecks] = useState(initialDecks || []);

  // Load favorite decks on component mount
  useEffect(() => {
    loadFavoriteDecks();
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
    }

    return filtered;
  }, [decks, search, sort]);

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

  const handleSortChange = (newSort) => {
    setSort(newSort);
  };

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        {/* Category Hero Header with Search and Filter */}
        <CategoryHeroHeader
          category={category}
          title={title || t('home.allDecks', 'Tüm Desteler')}
          colors={colors}
          t={t}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('common.searchDeckPlaceholder', 'Deste ara...')}
          sortMenuComponent={<SortMenu value={sort} onChange={handleSortChange} colors={colors} t={t} />}
        />
      </View>
    );
  }, [category, title, search, sort, colors, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <DeckList
        decks={filteredDecks}
        favoriteDecks={favoriteDecks}
        onToggleFavorite={handleToggleFavorite}
        onPressDeck={handleDeckPress}
        ListHeaderComponent={ListHeaderComponent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showPopularityBadge={false}
        loading={loading}
      />
    </View>
  );
}

// Sort Menu Component
const SortMenu = ({ value, onChange, colors, t }) => {
  const [visible, setVisible] = useState(false);
  const buttonRef = React.useRef(null);
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

  const sortOptions = [
    { key: 'popularity', label: t('discover.sortPopularity', 'Popülerlik') },
    { key: 'az', label: 'A-Z' },
    { key: 'new', label: t('discover.sortNew', 'Yeni') },
  ];

  return (
    <>
      <TouchableOpacity
        ref={buttonRef}
        style={[styles.filterIconButton, { borderColor: 'rgba(255, 255, 255, 0.3)' }]}
        onPress={openMenu}
        activeOpacity={0.8}
      >
        <Iconify icon="mage:filter" size={24} color="#fff" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: 20,
    paddingHorizontal: 0,
    paddingBottom: 20,
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
});

