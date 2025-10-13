import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { getFavoriteCards } from '../../services/FavoriteService';
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/tools/FilterIcon';
import CardListItem from '../../components/lists/CardList';
import LottieView from 'lottie-react-native';
import { typography } from '../../theme/typography';
import { StyleSheet } from 'react-native';

export default function FavoriteCards() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('original');

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCards([]);
        return;
      }
      const res = await getFavoriteCards(user.id);
      setCards(res || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const filteredCards = useMemo(() => {
    let list = cards.slice();
    if (query && query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
    }
    if (sort === 'az') {
      list.sort((a, b) => (a.question || '').localeCompare(b.question || ''));
    } else if (sort === 'fav') {
      // already favorites; keep original order
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return list;
  }, [cards, query, sort]);

  const handleRemoveFavoriteCard = async (cardId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('favorite_cards').delete().eq('user_id', user.id).eq('card_id', cardId);
    const res = await getFavoriteCards(user.id);
    setCards(res || []);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, marginVertical: 10 }}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 200, height: 200 }} />
          <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100 }} />
        </View>
      ) : filteredCards.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Image
            source={require('../../assets/logoasil.png')}
            style={{ position: 'absolute', alignSelf: 'center', width: 300, height: 300, opacity: 0.2 }}
            resizeMode="contain"
          />
          <Text style={[typography.styles.body, { color: colors.text, textAlign: 'center', fontSize: 16 }]}>
            {t('library.addFavoriteCardCta', 'Favorilere bir kart ekle')}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, backgroundColor: colors.background, marginHorizontal: 10 }}>
          <View style={{ margin: 5, backgroundColor: colors.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '98%', alignSelf: 'center' }}>
              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder={t('common.searchPlaceholder', 'Favori kartlarda ara...')}
                style={{ flex: 1 }}
              />
              <FilterIcon
                value={sort}
                onChange={setSort}
              />
            </View>
          </View>
          <View style={{ marginTop: 14, paddingHorizontal: 8 }}>
            {filteredCards.map((card) => (
              <CardListItem
                key={String(card.id)}
                question={card.question}
                answer={card.answer}
                isFavorite={true}
                onPress={() => navigation.navigate('CardDetail', { card })}
                onToggleFavorite={() => handleRemoveFavoriteCard(card.id)}
                canDelete={false}
              />
            ))}
          </View>
        </ScrollView>
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
