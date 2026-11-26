import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Platform, BackHandler, Alert, Animated, Easing, Image, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import LottieView from 'lottie-react-native';
import AddEditCardInlineForm from '../../components/layout/EditCardForm';
import { useTranslation } from 'react-i18next';
import CardListItem from '../../components/lists/CardList';
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/modals/CardFilterIcon';
import CardDetailView from '../../components/layout/CardDetailView';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import * as BlockService from '../../services/BlockService';
import { deleteCard, getCardsByDeck, getUserCardProgressForCards, getCardDetail } from '../../services/CardService';
import { addFavoriteCard, removeFavoriteCard, getFavoriteCardIdsForCards } from '../../services/FavoriteService';
import { invalidateCache } from '../../services/CacheService';
import ReportModal from '../../components/modals/ReportModal';
import { triggerHaptic } from '../../lib/hapticManager';
import { LinearGradient } from 'expo-linear-gradient';
import { MenuView } from '@expo/ui/community/menu';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useListBottomInset } from '../../components/ui/CustomTabBar';

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

// DeckCardsScreen.js (Ana fonksiyonun DIŞINA yazılacak)

const MemoizedDeckCard = React.memo(({
  item,
  isFavorite,
  isOwner,
  onPress,
  onToggleFavorite,
  onDelete
}) => {
  return (
    <View style={styles.cardListItem}>
      <CardListItem
        question={item.question}
        answer={item.answer}
        isFavorite={isFavorite}
        isOwner={isOwner}
        canDelete={true}
        onPress={() => onPress(item)}
        onToggleFavorite={() => onToggleFavorite(item.id)}
        onDelete={() => onDelete(item)}
      />
    </View>
  );
}, (prevProps, nextProps) => {
  // Sadece bu 5 değer değişirse kart kendini yenilesin:
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.question === nextProps.item.question &&
    prevProps.item.answer === nextProps.item.answer &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.isOwner === nextProps.isOwner
  );
});


export default function DeckCardsScreen({ route, navigation }) {
  const { deck } = route.params;
  const { colors } = useTheme();
  const { showSuccess, showError } = useSnackbarHelpers();
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [cardSort, setCardSort] = useState('original');
  const [selectedCard, setSelectedCard] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const PAGE_SIZE = 50;
  const spinValue = useRef(new Animated.Value(0)).current;
  const moreMenuActionsRef = useRef({});
  const flatListRef = useRef(null);
  const dataFetchedRef = useRef(false);
  const latestDetailFetchRef = useRef(null);
  const serverSortRef = useRef('original');
  const serverFilterRef = useRef(null);
  const serverSearchRef = useRef('');
  const cardsFetchGenRef = useRef(0);
  const debouncedSearchFetchBootRef = useRef(true);
  const favoriteCardsRef = useRef(new Set());
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportModalAlreadyCodes, setReportModalAlreadyCodes] = useState([]);
  const [reportCardId, setReportCardId] = useState(null);
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const showFullScreenLoading = loading && cards.length === 0 && !selectedCard;
  const insets = useSafeAreaInsets();
  const listBottomInset = useListBottomInset();
  const selectedCardRef = useRef(null);
  const editModeRef = useRef(false);
  const addCardFabPressed = useSharedValue(0);

  const addCardFabAnimatedStyle = useAnimatedStyle(() => {
    const springConfig = { mass: 0.5, damping: 30, stiffness: 400 };
    return {
      transform: [{ scale: withSpring(addCardFabPressed.value ? 0.92 : 1, springConfig) }],
      opacity: withSpring(addCardFabPressed.value ? 0.85 : 1, springConfig),
    };
  });

  useEffect(() => {
    setCurrentUserId(userId || null);
  }, [userId]);

  useEffect(() => {
    favoriteCardsRef.current = new Set(favoriteCards);
  }, [favoriteCards]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const fetchData = useCallback(async (silent = false, options = {}) => {
    const {
      sort: sortOverride,
      filter: filterOverride,
      forceRefresh = false,
      search: searchOverride,
    } = options || {};

    const nextSearch = searchOverride !== undefined
      ? String(searchOverride ?? '').trim()
      : serverSearchRef.current;
    serverSearchRef.current = nextSearch;

    const requestedSort = ['original', 'az'].includes(sortOverride) ? sortOverride : serverSortRef.current;
    const nextFilter = (filterOverride === null)
      ? null
      : (['fav', 'unlearned', 'learned'].includes(filterOverride) ? filterOverride : serverFilterRef.current);
    const nextSort = nextFilter ? 'original' : requestedSort;

    const fetchId = ++cardsFetchGenRef.current;

    if (!silent) setLoading(true);
    try {
      const cardsData = await getCardsByDeck(deck.id, 0, PAGE_SIZE, nextSort, forceRefresh, userId, nextFilter || undefined, nextSearch || null);
      if (fetchId !== cardsFetchGenRef.current) return;

      let statusMap = {};
      let favoriteCardIds = new Set();

      if (userId && cardsData.length > 0) {
        const cardIds = cardsData.map(c => c.id);
        const [progressMap, favSet] = await Promise.all([
          getUserCardProgressForCards(userId, cardIds),
          getFavoriteCardIdsForCards(userId, cardIds),
        ]);
        statusMap = progressMap;
        favoriteCardIds = favSet;
      }

      if (fetchId !== cardsFetchGenRef.current) return;

      const cardsWithProgress = cardsData.map(card => ({
        ...card,
        status: statusMap[card.id] || (nextFilter === 'learned' ? 'learned' : 'new')
      }));

      if (fetchId !== cardsFetchGenRef.current) return;
      serverSortRef.current = nextSort;
      serverFilterRef.current = nextFilter;
      setCards(cardsWithProgress);
      setFavoriteCards(Array.from(favoriteCardIds));
      setPage(0);
      setHasMore(cardsData.length >= PAGE_SIZE);
      dataFetchedRef.current = true;
    } catch (e) {
      console.error("Error fetching deck cards:", e);
      if (fetchId === cardsFetchGenRef.current) {
        setCards([]);
        setFavoriteCards([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [deck.id, userId]);

  useEffect(() => {
    if (debouncedSearchFetchBootRef.current) {
      debouncedSearchFetchBootRef.current = false;
      return;
    }
    if (!deck?.id) return;
    fetchData(true, {
      sort: serverSortRef.current,
      filter: serverFilterRef.current,
      search: debouncedSearch,
    });
  }, [debouncedSearch, fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(false, { forceRefresh: true });
    setRefreshing(false);
  }, [fetchData]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    const loadGen = cardsFetchGenRef.current;
    try {
      const nextPage = page + 1;
      const cardsData = await getCardsByDeck(deck.id, nextPage, PAGE_SIZE, serverSortRef.current, false, userId, serverFilterRef.current || undefined, serverSearchRef.current || null);
      if (loadGen !== cardsFetchGenRef.current) return;
      if (cardsData.length === 0) {
        setHasMore(false);
        return;
      }

      let statusMap = {};
      let newFavIds = new Set();

      if (userId && cardsData.length > 0) {
        const cardIds = cardsData.map(c => c.id);
        const [progressMap, favSet] = await Promise.all([
          getUserCardProgressForCards(userId, cardIds),
          getFavoriteCardIdsForCards(userId, cardIds),
        ]);
        statusMap = progressMap;
        newFavIds = favSet;
      }

      const newCards = cardsData.map(card => ({
        ...card,
        status: statusMap[card.id] || 'new'
      }));

      if (loadGen !== cardsFetchGenRef.current) return;
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
      setFavoriteCards(prev => [...new Set([...prev, ...Array.from(newFavIds)])]);
      setPage(nextPage);
      setHasMore(cardsData.length >= PAGE_SIZE);
    } catch (e) {
      console.error("Error loading more cards:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading, page, deck.id, userId]);

  useEffect(() => {
    dataFetchedRef.current = false;
    serverSortRef.current = 'original';
    serverFilterRef.current = null;
    serverSearchRef.current = '';
    debouncedSearchFetchBootRef.current = true;
    setCardSort('original');
    setSearch('');
    setDebouncedSearch('');
    fetchData(false, { sort: 'original', filter: null, search: '' });
  }, [deck.id, fetchData]);

  useFocusEffect(
    useCallback(() => {
      if (dataFetchedRef.current) {
        fetchData(true);
      }
    }, [fetchData])
  );

  // Ref (favoriteCardsRef) effect'ten sonra güncellenir; liste ilk render'da ref'e bakarsa
  // favori ikonları bir kare gecikmeli/boş kalır. isFavorite için state ile aynı commit'te güncellenen Set kullan.
  const favoriteIdSet = useMemo(() => new Set(favoriteCards), [favoriteCards]);

  const handleSortChange = useCallback((newSort) => {
    setCardSort(newSort);
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
    const isFilter = ['fav', 'unlearned', 'learned'].includes(newSort);
    const isSort = ['original', 'az'].includes(newSort);

    const nextFilter = isFilter ? newSort : null;
    const nextSort = isFilter ? 'original' : (isSort ? newSort : serverSortRef.current);

    const filterChanged = serverFilterRef.current !== nextFilter;
    const sortChanged = serverSortRef.current !== nextSort;

    if (filterChanged || sortChanged) {
      // Filtre/sıralama geçişleri sessiz olsun (ikon kaybolmasın, loader çıkmasın)
      fetchData(true, { sort: nextSort, filter: nextFilter, search: search.trim() });
    }
  }, [fetchData, search]);

  useEffect(() => {
    selectedCardRef.current = selectedCard;
  }, [selectedCard]);

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);
  
  // Android back
  useEffect(() => {
    const onBackPress = () => {
      if (editModeRef.current) {
        setEditMode(false);
        return true;
      }
      if (selectedCardRef.current) {
        setSelectedCard(null);
        return true;
      }
      return false;
    };
  
    const sub = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );
  
    return () => sub.remove();
  }, []);
  
  // iOS back safety net
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!selectedCardRef.current) return;
      e.preventDefault();
    });
    return unsubscribe;
  }, [navigation]);

  // iOS swipe-back gesture kontrolü
  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !selectedCard,
    });
  }, [navigation, selectedCard]);

  // Header'ı ayarla - selectedCard durumuna göre
  useLayoutEffect(() => {
    // Loading bitene kadar header ikonlarını gösterme
    if (showFullScreenLoading) {
      navigation.setOptions({
        headerLeft: undefined,
        headerRight: () => null,
      });
      return;
    }

    const isOwner = currentUserId && deck.user_id === currentUserId;
    if (selectedCard && editMode) {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => setEditMode(false)}
            activeOpacity={0.6}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Iconify
              icon={Platform.OS === 'ios' ? 'ci:chevron-left' : 'mdi:arrow-back'}
              size={29}
              color={colors.text}
            />
          </TouchableOpacity>
        ),
        headerRight: () => null,
      });
      return;
    }
    if (selectedCard && !editMode) {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => setSelectedCard(null)}
            activeOpacity={0.6}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Iconify
              icon={Platform.OS === 'ios' ? 'ci:chevron-left' : 'mdi:arrow-back'}
              size={Platform.OS === 'ios' ? 29 : 24}
              color={colors.text}
            />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4, gap: 16, paddingHorizontal: 8 }}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('medium');
                handleToggleFavoriteCard(selectedCard.id);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 15, bottom: 15, left: 8, right: 8 }}
            >
              <Iconify
                icon={favoriteCards.includes(selectedCard.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={24}
                color={favoriteCards.includes(selectedCard.id) ? '#F98A21' : colors.text}
              />
            </TouchableOpacity>
            {!isOwner && (
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  requestAnimationFrame(() => {
                    openReportCardModal();
                  });
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 15, bottom: 15, left: 8, right: 8 }}
              >
                <Iconify icon="ic:round-report-problem" size={24} color='#FED7AA' />
              </TouchableOpacity>
            )}
            {isOwner && (
              <MenuView
                actions={[
                  { id: 'edit', title: t('cardDetail.edit', 'Kartı Düzenle'), image: 'pencil' },
                  { id: 'delete', title: t('cardDetail.delete', 'Kartı Sil'), image: 'trash', attributes: { destructive: true } },
                ]}
                onOpenMenu={() => triggerHaptic('light')}
                onPressAction={({ nativeEvent }) => moreMenuActionsRef.current[nativeEvent.event]?.()}
                style={styles.headerMenuHost}
              >
                <View style={styles.headerMenuTrigger}>
                  <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={26} color={colors.text} />
                </View>
              </MenuView>
            )}
          </View>
        ),
      });
    } else {
      navigation.setOptions({
        headerLeft: undefined,
        headerRight: () => null,
      });
    }
  }, [showFullScreenLoading, selectedCard, editMode, colors.text, navigation, deck, favoriteCards, currentUserId, handleToggleFavoriteCard, openReportCardModal, t]);

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.stopAnimation();
      spinValue.setValue(0);
    }
  }, [loading]);

  const openReportCardModal = useCallback(async () => {
    if (!currentUserId || !selectedCard) return;
    try {
      const codes = await BlockService.getMyReportReasonCodesForTarget(currentUserId, 'card', selectedCard.id);
      setReportModalAlreadyCodes(codes || []);
      setReportCardId(selectedCard.id);
      setReportModalVisible(true);
    } catch (e) {
      showError(t('moderation.alreadyReported', 'Zaten şikayet ettiniz') || e?.message);
    }
  }, [currentUserId, selectedCard, t, showError]);

  const handleReportModalSubmit = useCallback(async (reasonCode, reasonText) => {
    if (!currentUserId || !reportCardId) return;
    try {
      await BlockService.reportCard(currentUserId, reportCardId, reasonCode, reasonText);
      setReportModalVisible(false);
      setReportCardId(null);
      showSuccess(t('moderation.reportReceived', 'Şikayetiniz alındı'));
    } catch (e) {
      if (e?.code === '23505' || e?.message?.includes('unique') || e?.message?.includes('duplicate')) {
        showError(t('moderation.alreadyReportedWithThis', 'Zaten bu sebeple şikayet ettiniz'));
      } else {
        showError(e?.message || t('moderation.alreadyReported', 'Zaten şikayet ettiniz'));
      }
    }
  }, [currentUserId, reportCardId, t, showSuccess, showError]);

  const handleToggleFavoriteCard = useCallback(async (cardId) => {
    if (!userId) return;
    const wasFavorite = favoriteCardsRef.current.has(cardId);
    setFavoriteCards(prev => wasFavorite ? prev.filter(id => id !== cardId) : [...prev, cardId]);
    try {
      wasFavorite ? await removeFavoriteCard(userId, cardId) : await addFavoriteCard(userId, cardId);
      // Bu ekranda favoriler/unfavorite sonrası "fav" filtresi ve cache tutarlılığı için deck card cache'ini temizle.
      await invalidateCache(`cards_deck_${deck.id}`);

      // Favoriler filtresindeyken unfavorite olduysa kartı listeden düşür.
      if (serverFilterRef.current === 'fav' && wasFavorite) {
        setCards(prev => prev.filter(c => c.id !== cardId));
      }

      // Favoriler filtresindeyken favorite eklediyse, sıralama en yeni favori üstte olacak şekilde server'dan tazele.
      if (serverFilterRef.current === 'fav' && !wasFavorite) {
        fetchData(true, { sort: 'original', filter: 'fav', forceRefresh: true, search: search.trim() });
      }
    } catch (e) {
      setFavoriteCards(prev => wasFavorite ? [...prev, cardId] : prev.filter(id => id !== cardId));
    }
  }, [userId, deck.id, fetchData, search]);

  const handleEditSelectedCard = () => {
    if (!selectedCard) return;
    setEditMode(true);
  };

  const handleDeleteSelectedCard = () => {
    if (!selectedCard) return;

    Alert.alert(
      t('cardDetail.warningTitle', 'Uyarı'),
      t('cardDetail.deleteConfirm', 'Kartı silmek istediğinize emin misiniz?'),
      [
        {
          text: t('common.cancel', 'İptal'),
          style: 'cancel',
        },
        {
          text: t('common.delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCard(selectedCard.id);

              // --- EKRANDAN ATMAYI ENGELLEYEN YENİ MANTIK ---

              // 1. Silinen kartın index'ini bul
              const currentIndex = cards.findIndex(c => c.id === selectedCard.id);
              let nextCardToSelect = null;

              // 2. Eğer listede 1'den fazla kart varsa sıradaki kartı belirle
              if (cards.length > 1) {
                // Eğer en son kartı siliyorsak bir öncekini göster
                if (currentIndex === cards.length - 1) {
                  nextCardToSelect = cards[currentIndex - 1];
                }
                // Aksi halde bir sonrakini göster
                else {
                  nextCardToSelect = cards[currentIndex + 1];
                }
              }

              // 3. Listeleri güncelle
              setCards(cards.filter(c => c.id !== selectedCard.id));

              // 4. Null yerine sıradaki kartı seç (Böylece bileşen kapanmaz, slider diğer karta geçer)
              fetchAndSetCardDetail(nextCardToSelect);

              showSuccess(t('cardDetail.deleteSuccess', 'Kart başarıyla silindi'));
            } catch (e) {
              showError(t('cardDetail.deleteError', 'Kart silinemedi'));
            }
          }
        }
      ]
    );
  };

  // The header menu lives in a setOptions closure; read the handlers through a
  // ref so it always sees the current cards/selection.
  moreMenuActionsRef.current = { edit: handleEditSelectedCard, delete: handleDeleteSelectedCard };

  // Full card details (image, example, note) fetched for the detail view, by
  // id. Kept out of `cards` on purpose: writing them into the list re-rendered
  // the whole screen on every card change while swiping the detail carousel.
  const cardDetailsRef = useRef(new Map());

  const fetchAndSetCardDetail = useCallback(async (card) => {
    if (!card) {
      setSelectedCard(null);
      return;
    }
    const cardId = card.id;
    latestDetailFetchRef.current = cardId;
    const cached = cardDetailsRef.current.get(cardId);
    if (cached) {
      setSelectedCard({ ...card, ...cached, isFullDataLoaded: true });
      return;
    }
    // Show the light data (question / answer) right away, details when loaded.
    setSelectedCard(card);
    if (card.isFullDataLoaded) return;
    try {
      const detail = await getCardDetail(cardId);
      if (!detail) return;
      cardDetailsRef.current.set(cardId, detail);
      if (latestDetailFetchRef.current === cardId) {
        setSelectedCard((prev) => (prev?.id === cardId ? { ...prev, ...detail, isFullDataLoaded: true } : prev));
      }
    } catch (e) {
      console.error("Kart detayları çekilemedi:", e);
    }
  }, []);

  const handleListItemPress = useCallback((item) => {
    setEditMode(false);
    fetchAndSetCardDetail(item);
  }, [fetchAndSetCardDetail]);

  const handleListItemDelete = useCallback((item) => {
    Alert.alert(
      t('cardDetail.deleteConfirmation', 'Kart Silinsin mi?'),
      t('cardDetail.deleteConfirm', 'Kartı silmek istediğinize emin misiniz?'),
      [
        { text: t('cardDetail.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('cardDetail.delete', 'Sil'), style: 'destructive', onPress: async () => {
            try {
              await deleteCard(item.id);

              setCards(prevCards => prevCards.filter(c => c.id !== item.id));
              showSuccess(t('cardDetail.deleteSuccess', 'Kart başarıyla silindi'));
            } catch (e) {
              showError(t('cardDetail.deleteError', 'Kart silinemedi'));
            }
          }
        }
      ]
    );
  }, [t, showSuccess, showError]);

  const renderCardItem = useCallback(({ item }) => {
    const isOwner = currentUserId && deck.user_id === currentUserId;
    return (
      <MemoizedDeckCard
        item={item}
        isFavorite={favoriteIdSet.has(item.id)}
        isOwner={isOwner}
        onPress={handleListItemPress}
        onToggleFavorite={handleToggleFavoriteCard}
        onDelete={handleListItemDelete}
      />
    );
  }, [currentUserId, deck?.user_id, favoriteIdSet, handleListItemPress, handleToggleFavoriteCard, handleListItemDelete]);

  const showAddCardFab =
    !showFullScreenLoading &&
    !selectedCard &&
    currentUserId &&
    deck.user_id === currentUserId &&
    !deck.is_shared;

  // The add-card FAB (~56 tall) sits at the bottom; leave room for it.
  const listContentPaddingBottom = listBottomInset + (showAddCardFab ? 76 : 0);

  const listFooter = useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.listFooterLoading} accessibilityRole="progressbar" accessibilityLabel={t('common.loading', 'Yükleniyor')}>
        <ActivityIndicator size="small" color={colors.text} />
      </View>
    );
  }, [loadingMore, colors.text, t]);

  return (
    <>
      {selectedCard && editMode ? (
        <AddEditCardInlineForm
          card={selectedCard}
          deck={deck}
          onSave={updatedCard => {
            cardDetailsRef.current.set(updatedCard.id, updatedCard);
            setCards(cards.map(c => c.id === updatedCard.id ? updatedCard : c));
            setSelectedCard(updatedCard);
            setEditMode(false);
          }}
          onCancel={() => setEditMode(false)}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.background }}>

          {/* --- ALT KATMAN: KARTLAR LİSTESİ --- 
              (Hiçbir zaman ekrandan silinmez (unmount olmaz), arkada hazır bekler. 
              Böylece scroll pozisyonu asla kaybolmaz.) 
          */}
          <View style={{ flex: 1, minHeight: 0 }}>
            {showFullScreenLoading ? (
              <View style={styles.loadingContainer}>
                <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 160, height: 160 }} />
                <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100, marginTop: -65 }} />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={cards}
                keyExtractor={item => item.id?.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: listContentPaddingBottom }}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListHeaderComponent={
                  <View style={styles.cardsBlurSearchContainer}>
                    <SearchBar
                      value={search}
                      onChangeText={setSearch}
                      placeholder={t("common.searchPlaceholder", "Kartlarda ara...")}
                      style={{ flex: 1 }}
                    />
                    <FilterIcon
                      value={cardSort}
                      onChange={handleSortChange}
                    />
                  </View>
                }
                ListEmptyComponent={
                  <View style={styles.noDecksEmpty} pointerEvents="none">
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
                      <Image
                        source={require('../../assets/cardbg.webp')}
                        style={{ position: 'absolute', alignSelf: 'center', width: 500, height: 500, opacity: 0.2 }}
                        resizeMode="contain"
                        pointerEvents="none"
                      />
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
                      <Text style={[typography.styles.body, { color: colors.border, textAlign: 'center', fontSize: fontSizes.body, marginTop: 20 }]}>
                        {t('cardDetail.addToDeck', 'Desteye bir kart ekle')}
                      </Text>
                    </View>
                  </View>
                }
                renderItem={renderCardItem}
                extraData={favoriteCards}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={listFooter}
                removeClippedSubviews={true}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={11}
                updateCellsBatchingPeriod={50}
              />
            )}
          </View>

          {showAddCardFab && (
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel={t('deckDetail.addCard', 'Kart Ekle')}
              style={[styles.addCardFab, addCardFabAnimatedStyle, { bottom: insets.bottom + 24 }]}
              onPressIn={() => {
                addCardFabPressed.value = 1;
              }}
              onPressOut={() => {
                addCardFabPressed.value = 0;
              }}
              onPress={() => {
                triggerHaptic('light');
                requestAnimationFrame(() => {
                  navigation.navigate('AddCard', { deck });
                });
              }}
            >
              <LinearGradient
                colors={['#F98A21', '#FF6B35']}
                locations={[0, 0.99]}
                style={styles.addCardFabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Iconify icon="ic:round-plus" size={26} color="#FFFFFF" />
                <Text style={styles.addCardFabLabel} numberOfLines={1}>
                  {t('deckDetail.addCard', 'Kart Ekle')}
                </Text>
              </LinearGradient>
            </AnimatedPressable>
          )}

          {/* --- ÜST KATMAN: KART DETAY SAYFASI --- 
              (Eğer seçili bir kart varsa, listenin üzerine position: 'absolute' ile tam ekran olarak biner)
          */}
          {selectedCard && (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.background, zIndex: 10 }}>
              <View style={{ flex: 1, backgroundColor: colors.background }}>
                <CardDetailView
                  card={selectedCard}
                  cards={cards}
                  onSelectCard={fetchAndSetCardDetail}
                  onEndReached={loadMore}
                  isDeckOwner={currentUserId && deck.user_id === currentUserId}
                />
              </View>

            </View>
          )}

        </View>
      )}

      <ReportModal
        visible={reportModalVisible}
        onClose={() => { setReportModalVisible(false); setReportCardId(null); }}
        reportType="card"
        alreadyReportedCodes={reportModalAlreadyCodes}
        onSubmit={handleReportModalSubmit}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Same size as the icon: the iOS 26 bar draws its glass capsule around this.
  headerMenuHost: {
    width: 26,
    height: 26,
  },
  headerMenuTrigger: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    flexDirection: 'column',
    marginTop: -120,
  },
  loadingText: {
    fontSize: fontSizes.bodyLarge,
    fontFamily: fonts.semibold,
    textAlign: 'center',
  },
  addCardFab: {
    position: 'absolute',
    right: 20,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#F98A21', // solid base under the gradient: cheap iOS shadow
    zIndex: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
    maxWidth: '88%',
  },
  addCardFabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 8,
    minHeight: 52,
  },
  addCardFabLabel: {
    fontSize: fontSizes.body,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  cardsBlurSearchContainer: {
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
  listFooterLoading: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDecksEmpty: {
    height: 200,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    gap: 10,
    marginTop: 150,
  },
});



