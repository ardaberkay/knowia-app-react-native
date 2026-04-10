import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, BackHandler, Alert, Animated, Easing, Modal, Image, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import LottieView from 'lottie-react-native';
import AddEditCardInlineForm from '../../components/layout/EditCardForm';
import { useTranslation } from 'react-i18next';
import CardListItem from '../../components/lists/CardList';
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/modals/CardFilterIcon';
import CardDetailView from '../../components/layout/CardDetailView';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import * as BlockService from '../../services/BlockService';
import { deleteCard, getCardsByDeck, getUserCardProgressForCards, getCardDetail } from '../../services/CardService';
import { addFavoriteCard, removeFavoriteCard, getFavoriteCardIdsForCards } from '../../services/FavoriteService';
import { invalidateCache } from '../../services/CacheService';
import ReportModal from '../../components/modals/ReportModal';
import { triggerHaptic } from '../../lib/hapticManager';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

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
  const moreMenuRef = useRef(null);
  const flatListRef = useRef(null);
  const dataFetchedRef = useRef(false);
  const latestDetailFetchRef = useRef(null);
  const serverSortRef = useRef('original');
  const serverFilterRef = useRef(null);
  const favoriteCardsRef = useRef(new Set());
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [moreMenuPos, setMoreMenuPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportModalAlreadyCodes, setReportModalAlreadyCodes] = useState([]);
  const [reportCardId, setReportCardId] = useState(null);
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const showFullScreenLoading = loading && cards.length === 0 && !selectedCard;
  const insets = useSafeAreaInsets();
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

  const fetchData = useCallback(async (silent = false, options = {}) => {
    const {
      sort: sortOverride,
      filter: filterOverride,
      forceRefresh = false,
    } = options || {};

    const requestedSort = ['original', 'az'].includes(sortOverride) ? sortOverride : serverSortRef.current;
    const nextFilter = (filterOverride === null)
      ? null
      : (['fav', 'unlearned', 'learned'].includes(filterOverride) ? filterOverride : serverFilterRef.current);
    const nextSort = nextFilter ? 'original' : requestedSort;

    if (!silent) setLoading(true);
    try {
      const cardsData = await getCardsByDeck(deck.id, 0, PAGE_SIZE, nextSort, forceRefresh, userId, nextFilter || undefined);

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

      const cardsWithProgress = cardsData.map(card => ({
        ...card,
        status: statusMap[card.id] || (nextFilter === 'learned' ? 'learned' : 'new')
      }));

      serverSortRef.current = nextSort;
      serverFilterRef.current = nextFilter;
      setCards(cardsWithProgress);
      setFavoriteCards(Array.from(favoriteCardIds));
      setPage(0);
      setHasMore(cardsData.length >= PAGE_SIZE);
      dataFetchedRef.current = true;
    } catch (e) {
      console.error("Error fetching deck cards:", e);
      setCards([]);
      setFavoriteCards([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [deck.id, userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(false, { forceRefresh: true });
    setRefreshing(false);
  }, [fetchData]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const cardsData = await getCardsByDeck(deck.id, nextPage, PAGE_SIZE, serverSortRef.current, false, userId, serverFilterRef.current || undefined);
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

      setCards(prev => [...prev, ...newCards]);
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
    setCardSort('original');
    fetchData(false, { sort: 'original', filter: null });
  }, [deck.id, fetchData]);

  useFocusEffect(
    useCallback(() => {
      if (dataFetchedRef.current) {
        fetchData(true);
      }
    }, [fetchData])
  );

  const filteredCards = useMemo(() => {
    let list = cards;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(c =>
        (c.question && c.question.toLowerCase().includes(s)) ||
        (c.answer && c.answer.toLowerCase().includes(s))
      );
    }
    return list;
  }, [cards, search]);

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
      fetchData(true, { sort: nextSort, filter: nextFilter });
    }
  }, [fetchData]);

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
              size={moderateScale(30)}
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
              size={Platform.OS === 'ios' ? moderateScale(30) : moderateScale(24)}
              color={colors.text}
            />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: scale(4), gap: scale(16), paddingHorizontal: scale(8) }}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('medium');
                handleToggleFavoriteCard(selectedCard.id);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: scale(15), bottom: scale(15), left: scale(8), right: scale(8) }}
            >
              <Iconify
                icon={favoriteCards.includes(selectedCard.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={moderateScale(24)}
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
                hitSlop={{ top: scale(15), bottom: scale(15), left: scale(8), right: scale(8) }}
              >
                <Iconify icon="ic:round-report-problem" size={moderateScale(24)} color='#FED7AA' />
              </TouchableOpacity>
            )}
            {isOwner && (
              <TouchableOpacity
                ref={moreMenuRef}
                onPress={() => {
                  triggerHaptic('light');
                  requestAnimationFrame(() => {
                    openMoreMenu();
                  });
                }}
                activeOpacity={0.7}
                hitSlop={{ top: scale(15), bottom: scale(15), left: scale(8), right: scale(8) }}
              >
                <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={moderateScale(26)} color={colors.text} />
              </TouchableOpacity>
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
  }, [showFullScreenLoading, selectedCard, editMode, colors.text, navigation, deck, favoriteCards, currentUserId, handleToggleFavoriteCard, openMoreMenu, openReportCardModal]);

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
        fetchData(true, { sort: 'original', filter: 'fav', forceRefresh: true });
      }
    } catch (e) {
      setFavoriteCards(prev => wasFavorite ? [...prev, cardId] : prev.filter(id => id !== cardId));
    }
  }, [userId, deck.id, fetchData]);

  const handleEditSelectedCard = () => {
    if (!selectedCard) return;
    setEditMode(true);
    setMoreMenuVisible(false);
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
          onPress: () => setMoreMenuVisible(false)
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
            } finally {
              setMoreMenuVisible(false);
            }
          }
        }
      ]
    );
  };

  const openMoreMenu = () => {
    if (moreMenuRef.current && moreMenuRef.current.measureInWindow) {
      moreMenuRef.current.measureInWindow((x, y, width, height) => {
        setMoreMenuPos({ x, y, width, height });
        setMoreMenuVisible(true);
      });
    } else {
      setMoreMenuVisible(true);
    }
  };

  const fetchAndSetCardDetail = useCallback(async (card) => {
    if (!card) {
      setSelectedCard(null);
      return;
    }

    const cardId = card.id;

    // 1. Kullanıcıyı bekletmemek için eldeki hafif veriyi (soru/cevap) anında ekrana bas
    setSelectedCard(card);

    // 2. Eğer bu kartın 'note', 'image' gibi detayları henüz çekilmediyse API'ye git
    // isFullDataLoaded adında kendimiz bir işaret (flag) koyuyoruz.
    if (!card.isFullDataLoaded) {
      try {
        const detail = await getCardDetail(cardId);

        if (detail) {
          // Gelen yeni veriyi eski veriyle birleştir ve "artık tam yüklendi" diye işaretle
          const updatedCard = { ...card, ...detail, isFullDataLoaded: true };

          // Ekranda açık olan detayı güncelle (veriler sessizce yerine otursun)
          setSelectedCard(prev => prev?.id === cardId ? updatedCard : prev);

          // ÇOK ÖNEMLİ: Ana listedeki kartı da bu yeni verilerle güncelle!
          // Böylece kullanıcı slider'da sağa/sola gidip tekrar bu karta gelirse 
          // yanıp sönme olmaz ve boşuna internet harcanmaz.
          setCards(prevCards => prevCards.map(c => c.id === cardId ? updatedCard : c));
        }
      } catch (e) {
        console.error("Kart detayları çekilemedi:", e);
      }
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

  const listContentPaddingBottom = showAddCardFab
    ? insets.bottom + verticalScale(100)
    : verticalScale(24);

  return (
    <>
      {selectedCard && editMode ? (
        <AddEditCardInlineForm
          card={selectedCard}
          deck={deck}
          onSave={updatedCard => {
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
                <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: scale(160, 0.3), height: scale(160, 0.3) }} />
                <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: scale(100, 0.3), height: scale(100, 0.3), marginTop: verticalScale(-65) }} />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={filteredCards}
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
                        style={{ position: 'absolute', alignSelf: 'center', width: moderateScale(500, 0.3), height: moderateScale(500, 0.3), opacity: 0.2 }}
                        resizeMode="contain"
                        pointerEvents="none"
                      />
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
                      <Text style={[typography.styles.body, { color: colors.border, textAlign: 'center', fontSize: moderateScale(16), marginTop: verticalScale(20) }]}>
                        {t('cardDetail.addToDeck', 'Desteye bir kart ekle')}
                      </Text>
                    </View>
                  </View>
                }
                renderItem={renderCardItem}
                extraData={favoriteCards}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={null}
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
              style={[styles.addCardFab, addCardFabAnimatedStyle, { bottom: insets.bottom + verticalScale(24) }]}
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
                <Iconify icon="ic:round-plus" size={moderateScale(26)} color="#FFFFFF" />
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
                <CardDetailView card={selectedCard} cards={cards} onSelectCard={fetchAndSetCardDetail} />
              </View>

              {/* Detay sayfasının More (Üç nokta) Menüsü */}
              <Modal
                visible={moreMenuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMoreMenuVisible(false)}
              >
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setMoreMenuVisible(false)}>
                  <View
                    style={{
                      position: 'absolute',
                      right: scale(20),
                      top: moreMenuPos.y + moreMenuPos.height + (Platform.OS === 'android' ? verticalScale(4) : verticalScale(8)) + insets.top,
                      minWidth: scale(160),
                      backgroundColor: colors.cardBackground,
                      borderRadius: moderateScale(14),
                      paddingVertical: verticalScale(8),
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: verticalScale(2) },
                      shadowOpacity: 0.15,
                      shadowRadius: moderateScale(8),
                      elevation: 8,
                      borderWidth: moderateScale(1),
                      borderColor: colors.cardBorder,
                    }}
                  >
                    <TouchableOpacity onPress={handleEditSelectedCard} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: verticalScale(12), paddingHorizontal: scale(16) }} activeOpacity={0.7}>
                      <Iconify icon="lucide:edit" size={moderateScale(20)} color={colors.text} style={{ marginRight: scale(12) }} />
                      <Text style={[typography.styles.body, { color: colors.text, fontSize: moderateScale(16) }]}>{t('cardDetail.edit', 'Kartı Düzenle')}</Text>
                    </TouchableOpacity>
                    <View style={{ height: verticalScale(1), backgroundColor: colors.border, marginVertical: verticalScale(4) }} />
                    <TouchableOpacity onPress={handleDeleteSelectedCard} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: verticalScale(12), paddingHorizontal: scale(16) }} activeOpacity={0.7}>
                      <Iconify icon="mdi:garbage" size={moderateScale(20)} color="#E74C3C" style={{ marginRight: scale(12) }} />
                      <Text style={[typography.styles.body, { color: '#E74C3C', fontSize: moderateScale(16) }]}>{t('cardDetail.delete', 'Kartı Sil')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: verticalScale(200),
    flexDirection: 'column',
    marginTop: verticalScale(-120),
  },
  loadingText: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    textAlign: 'center',
  },
  addCardFab: {
    position: 'absolute',
    right: scale(20),
    borderRadius: moderateScale(28),
    overflow: 'hidden',
    zIndex: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: verticalScale(1) },
    shadowOpacity: 0.12,
    shadowRadius: moderateScale(4),
    elevation: 2,
    maxWidth: '88%',
  },
  addCardFabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(18),
    gap: scale(8),
    minHeight: scale(52),
  },
  addCardFabLabel: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardsBlurSearchContainer: {
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
  noDecksEmpty: {
    height: verticalScale(200),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: scale(16),
    backgroundColor: 'transparent',
    flexDirection: 'column',
    gap: verticalScale(10),
    marginTop: verticalScale(150),
  },
});



