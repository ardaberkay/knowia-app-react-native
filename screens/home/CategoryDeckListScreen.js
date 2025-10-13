import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/tools/FilterIcon';
import DeckList from '../../components/lists/DeckList';
import { supabase } from '../../lib/supabase';

export default function CategoryDeckListScreen({ route }) {
  const { title, decks } = route.params;
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('original');
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Load favorite decks on component mount
  useEffect(() => {
    loadFavoriteDecks();
  }, []);

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

  // Filter and sort decks based on search and sort criteria
  const filteredDecks = useMemo(() => {
    let filtered = decks.filter(deck =>
      (deck.name && deck.name.toLowerCase().includes(search.toLowerCase())) ||
      (deck.to_name && deck.to_name.toLowerCase().includes(search.toLowerCase()))
    );

    // Apply sorting
    switch (sort) {
      case 'az':
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'fav':
        // This would need favorite decks data to filter properly
        // For now, just return filtered decks
        break;
      default:
        // Keep original order
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
        // Remove from favorites
        const { error } = await supabase
          .from('favorite_decks')
          .delete()
          .eq('user_id', user.id)
          .eq('deck_id', deckId);
        
        if (error) throw error;
        setFavoriteDecks(prev => prev.filter(id => id !== deckId));
      } else {
        // Add to favorites
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
      await loadFavoriteDecks();
      // You might want to reload the decks data here as well
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const ListHeaderComponent = () => (
    <View style={styles.headerContainer}>
      <View style={styles.searchRow}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={t('common.searchDeckPlaceholder', 'Deste ara...')}
          style={styles.searchBar}
        />
        <FilterIcon
          value={sort}
          onChange={setSort}
          style={styles.filterIcon}
        />
      </View>
    </View>
  );

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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBar: {
    flex: 1,
  },
  filterIcon: {
    marginLeft: 0,
  },
});