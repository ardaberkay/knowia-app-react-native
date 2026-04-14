import React, { useEffect, useMemo, useState, useLayoutEffect, useRef, useCallback, memo } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, BackHandler, Alert, Keyboard, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getFavoriteCards, addFavoriteCard, removeFavoriteCard } from '../../services/FavoriteService';
import { deleteCard, getCardDetail, getUserCardProgressForCards } from '../../services/CardService';
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
  const insets = useSafeAreaInsets();

  const PAGE_SIZE = 50;
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('original');
  const [selectedCard, setSelectedCard] = useState(null);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const latestDetailFetchRef = useRef(null);
  const flatListRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  const favoriteCardsSet = useMemo(() => new Set(favoriteCards), [favoriteCards]);

  const fetchData = useCallback(async (silent = false, forceRefresh = false, sortOverride = null) => {
    if (!userId) {
      setCards([]);
      setFavoriteCards([]);
      setCurrentUserId(null);
      return;
    }
    const currentSort = sortOverride ?? sort;
    const sortBy = ['original', 'az'].includes(currentSort) ? currentSort : 'original';
    const filter = ['learned', 'unlearned'].includes(currentSort) ? currentSort : null;
    if (!silent) setLoading(true);
    setCurrentUserId(userId);
    try {
      const cardsData = await getFavoriteCards(userId, 0, PAGE_SIZE, forceRefresh, sortBy, filter);
      const cardIds = (cardsData || []).map(c => c.id);
      const statusMap = cardIds.length > 0
        ? await getUserCardProgressForCards(userId, cardIds)
        : {};
      const cardsWithProgress = (cardsData || []).map(card => ({
        ...card,
        status: statusMap[card.id] || 'new',
      }));
      setCards(cardsWithProgress);
      setFavoriteCards(cardsWithProgress.map(card => card.id));
      setPage(0);
      setHasMore((cardsData || []).length >= PAGE_SIZE);
    } catch (e) {
      setCards([]);
      setFavoriteCards([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId, sort]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !userId) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const sortBy = ['original', 'az'].includes(sort) ? sort : 'original';
      const filter = ['learned', 'unlearned'].includes(sort) ? sort : null;
      const cardsData = await getFavoriteCards(userId, nextPage, PAGE_SIZE, false, sortBy, filter);
      if (!cardsData || cardsData.length === 0) {
        setHasMore(false);
        return;
      }
      const cardIds = cardsData.map(c => c.id);
      const statusMap = cardIds.length > 0
        ? await getUserCardProgressForCards(userId, cardIds)
        : {};
      const newCards = cardsData.map(card => ({
        ...card,
        status: statusMap[card.id] || 'new',
      }));
      setCards(prev => [...prev, ...newCards]);
      setFavoriteCards(prev => [...new Set([...prev, ...newCards.map(c => c.id)])]);
      setPage(nextPage);
      setHasMore(cardsData.length >= PAGE_SIZE);
    } catch (e) {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading, page, userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(true, true);
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    fetchData(false);
  }, [userId, fetchData]);

  useEffect(() => {
    const onBackPress = () => {
      if (selectedCard) {
        setSelectedCard(null);
        return true; // Geri tuşunu burada tüket
      }
      return false; // Normal navigation geri çalışsın
    };

    // 1. Event listener'ı ekle ve dönen referansı bir değişkene ata
    const backHandlerSubscription = BackHandler.addEventListener(
      'hardwareBackPress', 
      onBackPress
    );

    return () => {
      backHandlerSubscription.remove();
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
    if (query && query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
    }
    return list;
  }, [cards, query]);

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
        fetchData(false, true);
      } else {
        setFavoriteCards(prev => prev.filter(id => id !== cardId));
      }
    }
  }, [userId, favoriteCards, selectedCard, fetchData]);

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
              setCards(prev => prev.filter(c => c.id !== cardId));
              setFavoriteCards(prev => prev.filter(id => id !== cardId));
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
        isFavorite={favoriteCardsSet.has(item.id)} // Artık doğrudan Set'e bakıyor
        isOwner={isOwner}
        onPress={fetchAndSetCardDetail}
        onToggleFavorite={handleToggleFavoriteCard}
        onDelete={handleDeleteCard}
      />
    );
  }, [currentUserId, favoriteCardsSet, fetchAndSetCardDetail, handleToggleFavoriteCard, handleDeleteCard]);

  const favListHeader = useMemo(() => (
    !selectedCard ? (
      <View style={styles.searchContainer}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t('common.searchPlaceholder', 'Favori kartlarda ara...')}
          style={{ flex: 1 }}
        />
        <FilterIcon
          value={sort}
          onChange={(newSort) => {
            setSort(newSort);
            if (flatListRef.current) {
              flatListRef.current.scrollToOffset({ offset: 0, animated: false });
            }
            fetchData(false, false, newSort);
          }}
          hideFavorites={true}
          hideAz={true}
        />
      </View>
    ) : null
  ), [selectedCard, query, sort, t, fetchData]);

  const favListEmpty = useMemo(() => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: verticalScale(400), marginTop: verticalScale(-250), pointerEvents: 'none' }}>
      <Image
        source={require('../../assets/cardbg.webp')}
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
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <LottieView source={require('../../assets/flexloader.json')} speed={1.1} autoPlay loop style={{ width: scale(160, 0.3), height: verticalScale(160, 0.3) }} />
          <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: scale(100, 0.3), height: verticalScale(100, 0.3), marginTop: verticalScale(-65) }} />
        </View>
      ) : selectedCard ? (
        <CardDetailView card={selectedCard} cards={filteredCards} onSelectCard={fetchAndSetCardDetail} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredCards}
          keyExtractor={item => item.id?.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Platform.OS === 'android' ? insets.bottom + verticalScale(48) : verticalScale(24),
          }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={favListHeader}
          ListEmptyComponent={favListEmpty}
          renderItem={renderFavCardItem}
          extraData={favoriteCards}
          ListFooterComponent={loadingMore ? (
            <View style={{ paddingVertical: verticalScale(16), alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.text} />
            </View>
          ) : null}
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={11}
          updateCellsBatchingPeriod={50}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: verticalScale(200),
    flexDirection: 'column',
    marginTop: verticalScale(-120),
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
