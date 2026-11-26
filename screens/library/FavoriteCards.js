import React, { useEffect, useMemo, useState, useRef, useCallback, memo } from 'react';
import { View, FlatList, Image, Alert, Keyboard, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { Text } from '../../components/ui/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getFavoriteCards, addFavoriteCard, removeFavoriteCard } from '../../services/FavoriteService';
import { deleteCard, getCardDetail, getUserCardProgressForCards } from '../../services/CardService';
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/modals/CardFilterIcon';
import CardListItem from '../../components/lists/CardList';
import CardDetailSheet, { CardStackSlider } from '../../components/layout/CardDetailView';
import LottieView from 'lottie-react-native';
import { typography, fontSizes } from '../../theme/typography';
import { StyleSheet } from 'react-native';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { useListBottomInset } from '../../components/ui/CustomTabBar';

const MemoizedFavCardItem = memo(({ item, isFavorite, isOwner, onPress, onToggleFavorite, onDelete }) => (
  <View style={{ paddingHorizontal: 12, paddingVertical: 0 }}>
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
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbarHelpers();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const listBottomInset = useListBottomInset();
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
  // Detail sheet: selectedCard is its content, detailVisible opens / closes it.
  const [detailVisible, setDetailVisible] = useState(false);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const latestDetailFetchRef = useRef(null);
  const flatListRef = useRef(null);
  const serverSearchRef = useRef('');
  const favFetchGenRef = useRef(0);
  const debouncedQueryFetchBootRef = useRef(true);
  const [refreshing, setRefreshing] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

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
    const searchArg = serverSearchRef.current || null;
    const fetchId = ++favFetchGenRef.current;
    if (!silent) setLoading(true);
    setCurrentUserId(userId);
    try {
      const cardsData = await getFavoriteCards(userId, 0, PAGE_SIZE, forceRefresh, sortBy, filter, searchArg);
      if (fetchId !== favFetchGenRef.current) return;
      const cardIds = (cardsData || []).map(c => c.id);
      const statusMap = cardIds.length > 0
        ? await getUserCardProgressForCards(userId, cardIds)
        : {};
      if (fetchId !== favFetchGenRef.current) return;
      const cardsWithProgress = (cardsData || []).map(card => ({
        ...card,
        status: statusMap[card.id] || 'new',
      }));
      setCards(cardsWithProgress);
      setFavoriteCards(cardsWithProgress.map(card => card.id));
      setPage(0);
      setHasMore((cardsData || []).length >= PAGE_SIZE);
    } catch (e) {
      if (fetchId === favFetchGenRef.current) {
        setCards([]);
        setFavoriteCards([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId, sort]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !userId) return;
    setLoadingMore(true);
    const loadGen = favFetchGenRef.current;
    try {
      const nextPage = page + 1;
      const sortBy = ['original', 'az'].includes(sort) ? sort : 'original';
      const filter = ['learned', 'unlearned'].includes(sort) ? sort : null;
      const cardsData = await getFavoriteCards(userId, nextPage, PAGE_SIZE, false, sortBy, filter, serverSearchRef.current || null);
      if (loadGen !== favFetchGenRef.current) return;
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
      if (loadGen !== favFetchGenRef.current) return;
      setCards(prev => {
        const seen = new Set(prev.map(c => c.id));
        const merged = [...prev];
        for (const card of newCards) {
          if (card?.id != null && !seen.has(card.id)) {
            seen.add(card.id);
            merged.push(card);
          }
        }
        return merged;
      });
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
    debouncedQueryFetchBootRef.current = true;
    fetchData(false);
  }, [userId, fetchData]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (debouncedQueryFetchBootRef.current) {
      debouncedQueryFetchBootRef.current = false;
      return;
    }
    if (!userId) return;
    serverSearchRef.current = debouncedQuery;
    fetchData(true, false);
  }, [debouncedQuery, userId, fetchData]);

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

  const openDetail = useCallback((card) => {
    fetchAndSetCardDetail(card);
    setDetailVisible(true);
  }, [fetchAndSetCardDetail]);

  const handleToggleFavoriteCard = useCallback(async (cardId) => {
    if (!userId) return;
    const wasFavorite = favoriteCards.includes(cardId);

    if (wasFavorite) {
      setFavoriteCards(prev => prev.filter(id => id !== cardId));
      setCards(prev => prev.filter(c => c.id !== cardId));
      // No longer a favourite: it leaves this page, close its sheet.
      if (selectedCard && selectedCard.id === cardId) setDetailVisible(false);
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
              if (selectedCard && selectedCard.id === cardId) setDetailVisible(false);
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
        onPress={openDetail}
        onToggleFavorite={handleToggleFavoriteCard}
        onDelete={handleDeleteCard}
      />
    );
  }, [currentUserId, favoriteCardsSet, openDetail, handleToggleFavoriteCard, handleDeleteCard]);

  const favListHeader = useMemo(() => (
    <>
      {/* Browse the cards; back to the first card on a new search / filter. */}
      {cards.length > 0 ? (
        <CardStackSlider
          key={`${debouncedQuery}|${sort}`}
          cards={cards}
          onOpenDetail={openDetail}
          onEndReached={loadMore}
        />
      ) : null}
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
            serverSearchRef.current = query.trim();
            fetchData(false, false, newSort);
          }}
          hideFavorites={true}
          hideAz={true}
        />
      </View>
    </>
  ), [cards, debouncedQuery, openDetail, loadMore, query, sort, t, fetchData]);

  const favListEmpty = useMemo(() => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: 400, marginTop: -250, pointerEvents: 'none' }}>
      <Image
        source={require('../../assets/cardbg.webp')}
        style={{ width: 500, height: 500, opacity: 0.2 }}
        resizeMode="contain"
      />
      <Text style={[typography.styles.body, { color: colors.text, opacity: 0.6, fontSize: fontSizes.body, marginTop: -150 }]}>
        {t('cardDetail.addToDeck', 'Desteye bir kart ekle')}
      </Text>
    </View>
  ), [colors.text, t]);

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <LottieView source={require('../../assets/flexloader.json')} speed={1.1} autoPlay loop style={{ width: 160, height: 160 }} />
          <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100, marginTop: -65 }} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={cards}
          keyExtractor={item => item.id?.toString()}
          showsVerticalScrollIndicator={false}
          // iOS: starts below the see-through header (SCROLL_EDGE_HEADER);
          // the automatic inset also covers the bottom safe area.
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Platform.OS === 'ios' ? Math.max(0, listBottomInset - insets.bottom) : listBottomInset,
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
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
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

      <CardDetailSheet
        card={selectedCard}
        visible={detailVisible}
        onDismiss={() => setDetailVisible(false)}
        isFavorite={Boolean(selectedCard && favoriteCardsSet.has(selectedCard.id))}
        onToggleFavorite={(card) => handleToggleFavoriteCard(card.id)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    flexDirection: 'column',
    marginTop: -120,
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
