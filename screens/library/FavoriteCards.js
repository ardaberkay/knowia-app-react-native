import React, { useEffect, useMemo, useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { getFavoriteCards } from '../../services/FavoriteService';
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/tools/FilterIcon';
import CardListItem from '../../components/lists/CardList';
import CardDetailView from '../../components/layout/CardDetailView';
import LottieView from 'lottie-react-native';
import { typography } from '../../theme/typography';
import { StyleSheet } from 'react-native';
import { Iconify } from 'react-native-iconify';

export default function FavoriteCards() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('original');
  const [selectedCard, setSelectedCard] = useState(null);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCards([]);
        setFavoriteCards([]);
        setCurrentUserId(null);
        return;
      }
      setCurrentUserId(user.id);
      
      // Fetch favorite cards and user progress in parallel
      const [res, progressResult] = await Promise.all([
        getFavoriteCards(user.id),
        supabase
          .from('user_card_progress')
          .select('card_id, status')
          .eq('user_id', user.id)
      ]);
      
      // Create a map of card statuses
      const statusMap = {};
      if (progressResult.data) {
        progressResult.data.forEach(p => {
          statusMap[p.card_id] = p.status;
        });
      }
      
      // Merge status into cards (default: 'new' if no progress record)
      const cardsWithProgress = (res || []).map(card => ({
        ...card,
        status: statusMap[card.id] || 'new'
      }));
      
      setCards(cardsWithProgress);
      // Favori kartların ID'lerini tut
      setFavoriteCards(cardsWithProgress.map(card => card.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      if (selectedCard) {
        setSelectedCard(null);
        return true; // Geri tuşunu burada tüket
      }
      return false; // Normal navigation geri çalışsın
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    };
  }, [selectedCard]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (selectedCard) {
        e.preventDefault();
        setSelectedCard(null);
      }
    });
    return unsubscribe;
  }, [navigation, selectedCard]);

  const filteredCards = useMemo(() => {
    let list = cards.slice();
    
    // Search filter
    if (query && query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
    }
    
    // Sort/Filter options
    if (sort === 'az') {
      list.sort((a, b) => (a.question || '').localeCompare(b.question || ''));
    } else if (sort === 'fav') {
      // already favorites; keep original order
    } else if (sort === 'unlearned') {
      list = list.filter(c => c.status !== 'learned');
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    return list;
  }, [cards, query, sort]);

  const handleToggleFavoriteCard = async (cardId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      if (favoriteCards.includes(cardId)) {
        await supabase
          .from('favorite_cards')
          .delete()
          .eq('user_id', user.id)
          .eq('card_id', cardId);
        setFavoriteCards(favoriteCards.filter(id => id !== cardId));
        setCards(cards.filter(c => c.id !== cardId));
        // Eğer seçili kart favorilerden çıkarıldıysa, seçimi temizle
        if (selectedCard && selectedCard.id === cardId) {
          setSelectedCard(null);
        }
      } else {
        await supabase
          .from('favorite_cards')
          .insert({ user_id: user.id, card_id: cardId });
        setFavoriteCards([...favoriteCards, cardId]);
      }
    } catch (e) {}
  };

  // Header'ı ayarla - selectedCard durumuna göre
  useLayoutEffect(() => {
    if (loading) {
      navigation.setOptions({
        headerRight: () => null,
      });
      return;
    }

    if (selectedCard) {
      navigation.setOptions({
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
            <TouchableOpacity
              onPress={() => handleToggleFavoriteCard(selectedCard.id)}
              activeOpacity={0.7}
              style={{ paddingHorizontal: 6 }}
            >
              <Iconify
                icon={favoriteCards.includes(selectedCard.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={24}
                color={favoriteCards.includes(selectedCard.id) ? '#F98A21' : colors.text}
              />
            </TouchableOpacity>
          </View>
        ),
      });
    } else {
      navigation.setOptions({
        headerRight: () => null,
      });
    }
  }, [loading, selectedCard, colors.text, navigation, favoriteCards, handleToggleFavoriteCard]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 200, height: 200 }} />
          <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100 }} />
        </View>
      ) : selectedCard ? (
        <CardDetailView card={selectedCard} cards={filteredCards} onSelectCard={setSelectedCard} />
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
        <FlatList
          data={filteredCards}
          keyExtractor={item => item.id?.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          ListHeaderComponent={
            !selectedCard && (
              <View style={styles.searchContainer}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('common.searchPlaceholder', 'Favori kartlarda ara...')}
                  style={{ flex: 1 }}
                />
                <FilterIcon
                  value={sort}
                  onChange={setSort}
                  hideFavorites={true}
                />
              </View>
            )
          }
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: 400 }}>
              <Text style={[typography.styles.caption, { color: colors.text, textAlign: 'center', fontSize: 16 }]}>
                {t('library.addFavoriteCardCta', 'Favorilere bir kart ekle')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isOwner = currentUserId && item.deck?.user_id && item.deck.user_id === currentUserId;
            return (
              <View style={styles.cardListItem}>
                <CardListItem
                  question={item.question}
                  answer={item.answer}
                  isFavorite={favoriteCards.includes(item.id)}
                  onPress={() => {
                    setSelectedCard(item);
                  }}
                  onToggleFavorite={() => handleToggleFavoriteCard(item.id)}
                  canDelete={true}
                  onDelete={() => handleDeleteCard(item.id)}
                  isOwner={isOwner}
                />
              </View>
            );
          }}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  cardListItem: {
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
});
