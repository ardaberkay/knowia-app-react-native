import React, { useEffect, useMemo, useState, useLayoutEffect, useRef, useCallback, memo } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, BackHandler, Alert, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { getFavoriteCards, addFavoriteCard, removeFavoriteCard } from '../../services/FavoriteService';
import { deleteCard, getCardDetail } from '../../services/CardService';
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/modals/CardFilterIcon';
import CardListItem from '../../components/lists/CardList';
import CardDetailView from '../../components/layout/CardDetailView';
import LottieView from 'lottie-react-native';
import { typography } from '../../theme/typography';
import { StyleSheet } from 'react-native';
import { Iconify } from 'react-native-iconify';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

const MemoizedFavCardItem = memo(({ item, isFavorite, isOwner, onPress, onToggleFavorite, onDelete }) => (
  <View style={{ paddingHorizontal: scale(12), paddingVertical: 0 }}>
    <CardListItem
      question={item.question}
      answer={item.answer}
      isFavorite={isFavorite}
      onPress={() => onPress(item)}
      onToggleFavorite={() => onToggleFavorite(item.id)}
      canDelete={true}
      onDelete={() => onDelete(item.id)}
      isOwner={isOwner}
    />
  </View>
), (prevProps, nextProps) => (
  prevProps.item.id === nextProps.item.id &&
  prevProps.item.question === nextProps.item.question &&
  prevProps.item.answer === nextProps.item.answer &&
  prevProps.isFavorite === nextProps.isFavorite &&
  prevProps.isOwner === nextProps.isOwner
));

export default function FavoriteCards() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbarHelpers();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('original');
  const [selectedCard, setSelectedCard] = useState(null);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const latestDetailFetchRef = useRef(null);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      if (!userId) {
        setCards([]);
        setFavoriteCards([]);
        setCurrentUserId(null);
        return;
      }
      setCurrentUserId(userId);
      
      // Fetch favorite cards and user progress in parallel
      const [res, progressResult] = await Promise.all([
        getFavoriteCards(userId),
        supabase
          .from('user_card_progress')
          .select('card_id, status')
          .eq('user_id', userId)
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
  }, [userId]);

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

  const favoritedAt = (c) => new Date(c.favorited_at || c.created_at || 0).getTime();
  const filteredCards = useMemo(() => {
    let list = cards.slice();
    
    if (query && query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
    }
    
    if (sort === 'az') {
      list.sort((a, b) => {
        const cmp = (a.question || '').localeCompare(b.question || '');
        return cmp !== 0 ? cmp : favoritedAt(b) - favoritedAt(a);
      });
    } else if (sort === 'fav') {
      // already favorites; keep API order (en son favorilenen en üstte)
    } else if (sort === 'unlearned') {
      list = list.filter(c => c.status !== 'learned');
      list.sort((a, b) => favoritedAt(b) - favoritedAt(a));
    } else if (sort === 'learned') {
      list = list.filter(c => c.status === 'learned');
      list.sort((a, b) => favoritedAt(b) - favoritedAt(a));
    } else {
      list.sort((a, b) => favoritedAt(b) - favoritedAt(a));
    }
    
    return list;
  }, [cards, query, sort]);

  const fetchAndSetCardDetail = useCallback(async (card) => {
    if (!card) {
      setSelectedCard(null);
      return;
    }
    const cardId = card.id;
    latestDetailFetchRef.current = cardId;
    setSelectedCard(card);
    try {
      const detail = await getCardDetail(cardId);
      if (latestDetailFetchRef.current === cardId && detail) {
        setSelectedCard(prev => prev?.id === cardId ? { ...prev, ...detail } : prev);
      }
    } catch (e) {
      // keep lightweight data
    }
  }, []);

  const handleToggleFavoriteCard = useCallback(async (cardId) => {
    if (!userId) return;
    const wasFavorite = favoriteCards.includes(cardId);

    if (wasFavorite) {
      setFavoriteCards(prev => prev.filter(id => id !== cardId));
      setCards(prev => prev.filter(c => c.id !== cardId));
      if (selectedCard && selectedCard.id === cardId) {
        setSelectedCard(null);
      }
    } else {
      setFavoriteCards(prev => [...prev, cardId]);
    }

    try {
      wasFavorite ? await removeFavoriteCard(userId, cardId) : await addFavoriteCard(userId, cardId);
    } catch (e) {
      if (wasFavorite) {
        fetchFavorites();
      } else {
        setFavoriteCards(prev => prev.filter(id => id !== cardId));
      }
    }
  }, [userId, favoriteCards, selectedCard]);

  const handleDeleteCard = async (cardId) => {
    Alert.alert(
      t('cardDetail.deleteConfirmation', 'Kart Silinsin mi?'),
      t('cardDetail.deleteConfirm', 'Kartı silmek istediğinize emin misiniz?'),
      [
        { text: t('cardDetail.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('cardDetail.delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCard(cardId);
              
              // Kartı listeden çıkar
              setCards(cards.filter(c => c.id !== cardId));
              setFavoriteCards(favoriteCards.filter(id => id !== cardId));
              // Eğer seçili kart silindiyse, seçimi temizle
              if (selectedCard && selectedCard.id === cardId) {
                setSelectedCard(null);
              }
              
              showSuccess(t('cardDetail.deleteSuccess', 'Kart başarıyla silindi'));
            } catch (e) {
              showError(t('cardDetail.deleteError', 'Kart silinemedi'));
            }
          }
        }
      ]
    );
  };


  const renderFavCardItem = useCallback(({ item }) => {
    const isOwner = currentUserId && item.deck?.user_id && item.deck.user_id === currentUserId;
    return (
      <MemoizedFavCardItem
        item={item}
        isFavorite={favoriteCards.includes(item.id)}
        isOwner={isOwner}
        onPress={fetchAndSetCardDetail}
        onToggleFavorite={handleToggleFavoriteCard}
        onDelete={handleDeleteCard}
      />
    );
  }, [currentUserId, favoriteCards, fetchAndSetCardDetail, handleToggleFavoriteCard, handleDeleteCard]);

  const favListHeader = useMemo(() => (
    !selectedCard && cards.length > 0 ? (
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
    ) : null
  ), [selectedCard, cards.length, query, sort, t]);

  const favListEmpty = useMemo(() => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: verticalScale(400), marginTop: verticalScale(-250), pointerEvents: 'none' }}>
      <Image
        source={require('../../assets/cardbg.png')}
        style={{ width: scale(500), height: scale(500), opacity: 0.2 }}
        resizeMode="contain"
      />
      <Text style={[typography.styles.body, { color: colors.text, opacity: 0.6, fontSize: moderateScale(16), marginTop: verticalScale(-150) }]}>
        {t('cardDetail.addToDeck', 'Desteye bir kart ekle')}
      </Text>
    </View>
  ), [colors.text, t]);

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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: scale(8) }}>
            <TouchableOpacity
              onPress={() => handleToggleFavoriteCard(selectedCard.id)}
              activeOpacity={0.7}
              style={{ paddingHorizontal: scale(6) }}
            >
              <Iconify
                icon={favoriteCards.includes(selectedCard.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={moderateScale(24)}
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
          <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: scale(200), height: verticalScale(200) }} />
          <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: scale(100), height: verticalScale(100) }} />
        </View>
      ) : selectedCard ? (
        <CardDetailView card={selectedCard} cards={filteredCards} onSelectCard={fetchAndSetCardDetail} />
      ) : cards.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: verticalScale(-250)}}>
          <Image
            source={require('../../assets/cardbg.png')}
            style={{ width: scale(500), height: verticalScale(500), opacity: 0.2 }}
            resizeMode="contain"
            fadeDuration={0}
          />
          <Text style={[typography.styles.body, { color: colors.text, opacity: 0.6, fontSize: moderateScale(16), marginTop: verticalScale(-150) }]}>
            {t('library.addFavoriteCardEmpty', 'Bir kart favorilere ekle')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCards}
          keyExtractor={item => item.id?.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: verticalScale(24) }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={9}
          ListHeaderComponent={favListHeader}
          ListEmptyComponent={favListEmpty}
          renderItem={renderFavCardItem}
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
    minHeight: verticalScale(200),
    flexDirection: 'column',
    gap: verticalScale(-65),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginTop: verticalScale(12),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(8),
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(8),
  },
  cardListItem: {
    paddingHorizontal: scale(12),
    paddingVertical: 0,
  },
});
