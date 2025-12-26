import React, { useEffect, useMemo, useState } from 'react';
import { View, Image, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { getFavoriteDecks } from '../../services/FavoriteService';
import SearchBar from '../../components/tools/SearchBar';
import FilterModal, { FilterModalButton } from '../../components/modals/FilterModal';
import DeckList from '../../components/lists/DeckList';
import LottieView from 'lottie-react-native';
import { typography } from '../../theme/typography';
import { StyleSheet } from 'react-native';

export default function FavoriteDecks() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFavoriteDecks([]);
        return;
      }
      const decks = await getFavoriteDecks(user.id);
      // is_admin_created kontrolü - tüm kategoriler için geçerli
      const modifiedDecks = (decks || []).map((deck) => {
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
      setFavoriteDecks(modifiedDecks);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

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
    
    // Sorting
    switch (sort) {
      case 'az':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'favorites':
        // Already favorites; keep original order
        break;
      case 'popularity':
        list.sort((a, b) => {
          const scoreA = a.popularity_score || 0;
          const scoreB = b.popularity_score || 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        break;
      case 'default':
      default:
        list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
    }
    
    return list;
  }, [favoriteDecks, query, sort, selectedCategories]);

  const handleAddFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('favorite_decks').insert({ user_id: user.id, deck_id: deckId });
    const decks = await getFavoriteDecks(user.id);
    // is_admin_created kontrolü - tüm kategoriler için geçerli
    const modifiedDecks = (decks || []).map((deck) => {
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
    setFavoriteDecks(modifiedDecks);
  };

  const handleRemoveFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('favorite_decks').delete().eq('user_id', user.id).eq('deck_id', deckId);
    const decks = await getFavoriteDecks(user.id);
    // is_admin_created kontrolü - tüm kategoriler için geçerli
    const modifiedDecks = (decks || []).map((deck) => {
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
    setFavoriteDecks(modifiedDecks);
  };

  const handleApplyFilters = (newSort, newCategories) => {
    setSort(newSort);
    setSelectedCategories(newCategories);
    setFilterModalVisible(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, marginVertical: 10 }}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 200, height: 200 }} />
          <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100 }} />
        </View>
      ) : filteredDecks.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -150}}>
          <Image
            source={require('../../assets/deckbg.png')}
            style={{ width: 300, height: 300, opacity: 0.2 }}
            resizeMode="contain"
          />
          <Text style={[typography.styles.body, { color: colors.text, opacity: 0.6, textAlign: 'center', fontSize: 16, marginTop: -20 }]}>
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
            <View style={{ backgroundColor: colors.background, marginVertical: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '95%', alignSelf: 'center' }}>
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
          onRefresh={fetchFavorites}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    flexDirection: 'column',
    gap: -65,
  },
});
