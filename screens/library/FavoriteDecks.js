import React, { useEffect, useMemo, useState } from 'react';
import { View, Image, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { getFavoriteDecks } from '../../services/FavoriteService';
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/tools/FilterIcon';
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
  const [sort, setSort] = useState('original');

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFavoriteDecks([]);
        return;
      }
      const decks = await getFavoriteDecks(user.id);
      setFavoriteDecks(decks || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const filteredDecks = useMemo(() => {
    let list = favoriteDecks.slice();
    if (query && query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(d => (d.name || '').toLowerCase().includes(q) || (d.to_name || '').toLowerCase().includes(q));
    }
    if (sort === 'az') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'fav') {
      // already favorites; keep original order
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return list;
  }, [favoriteDecks, query, sort]);

  const handleAddFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('favorite_decks').insert({ user_id: user.id, deck_id: deckId });
    const decks = await getFavoriteDecks(user.id);
    setFavoriteDecks(decks || []);
  };

  const handleRemoveFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('favorite_decks').delete().eq('user_id', user.id).eq('deck_id', deckId);
    const decks = await getFavoriteDecks(user.id);
    setFavoriteDecks(decks || []);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, marginVertical: 10 }}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 200, height: 200 }} />
          <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100 }} />
        </View>
      ) : filteredDecks.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Image
            source={require('../../assets/logoasil.png')}
            style={{ position: 'absolute', alignSelf: 'center', width: 300, height: 300, opacity: 0.2 }}
            resizeMode="contain"
          />
          <Text style={[typography.styles.body, { color: colors.text, textAlign: 'center', fontSize: 16 }]}>
            {t('library.addFavoriteDeckCta', 'Favorilerine bir deste ekle')}
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
            <View style={{backgroundColor: colors.background, marginVertical: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '95%', alignSelf: 'center' }}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('common.searchPlaceholder', 'Favori destelerde ara...')}
                  style={{ flex: 1 }}
                />
                <FilterIcon
                  value={sort}
                  onChange={setSort}
                />
              </View>
            </View>
          )}
          refreshing={loading}
          onRefresh={fetchFavorites}
        />
      )}
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
