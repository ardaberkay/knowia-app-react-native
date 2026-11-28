import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, memo, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image, Pressable, RefreshControl, Alert } from 'react-native';
import { Text } from '../../components/ui/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useAuth } from '../../contexts/AuthContext';
import { updateCardsChapter } from '../../services/CardService';
import { useTranslation } from 'react-i18next';
import FilterIcon from '../../components/modals/CardFilterIcon';
import SearchBar from '../../components/tools/SearchBar';
import CardDetailSheet from '../../components/layout/CardDetailView';
import { listChapters, distributeUnassignedEvenly, getDeckChaptersProgressRpc } from '../../services/ChapterService';
import { deleteCard, getCardsByChapter, getCardDetail, filterCardsWhileSearching, normSearchText } from '../../services/CardService';
import { addFavoriteCard, removeFavoriteCard } from '../../services/FavoriteService';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import ChapterSelector from '../../components/modals/ChapterSelector';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { triggerHaptic } from '../../lib/hapticManager';
import { useListBottomInset } from '../../components/ui/TabBarInset';
import PhosphorIcon from '../../components/ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';
import CardListItem from '../../components/lists/CardList';
import { useFocusEffect } from '@react-navigation/native';
import { isSpeechAvailable, useSpeakText } from '../../lib/speech';

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

// One row: the shared card row. Default shallow memo; the screen passes
// stable callbacks, so a row re-renders only when its own state changes.
const MemoizedCardItem = memo(({
  card,
  status,
  isFavorite,
  isSpeaking,
  isSelected,
  editMode,
  onToggle,
  onPress,
  onToggleFavorite,
  onSpeak,
}) => (
  <View style={styles.cardRow}>
    <CardListItem
      question={card.question}
      answer={card.answer}
      status={status}
      isFavorite={isFavorite}
      isSpeaking={isSpeaking}
      onPress={() => onPress(card)}
      onToggleFavorite={() => onToggleFavorite(card.id)}
      onSpeak={onSpeak ? () => onSpeak(card) : undefined}
      selectionMode={editMode}
      isSelected={isSelected}
      onToggleSelect={() => onToggle(card.id)}
    />
  </View>
));

// Side padding of the cards list (in the list content, see the FlatList).
const LIST_SIDE_PADDING = 18;

export default function ChapterCardsScreen({ route, navigation }) {
  const { chapter, deck } = route.params;
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [search, setSearch] = useState('');
  // filter / sort menu next to the search bar: 'original' | 'az' | 'fav' | 'learned' | 'unlearned'
  const [cardSort, setCardSort] = useState('original');
  const listOptionsFor = (value) => ({
    filter: ['fav', 'learned', 'unlearned'].includes(value) ? value : null,
    sortBy: value === 'az' ? 'az' : 'original',
  });
  // the search the cards on screen were loaded for (see filterCardsWhileSearching)
  const [cardsSearch, setCardsSearch] = useState('');
  // Search runs on the server over the whole chapter (not just loaded pages).
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);
  const [cardStatusMap, setCardStatusMap] = useState(new Map());
  const [chapterStats, setChapterStats] = useState({ total: 0, learning: 0, learned: 0, new: 0 });
  const [selectedCard, setSelectedCard] = useState(null);
  // Detail sheet: selectedCard is its content, detailVisible opens / closes it.
  const [detailVisible, setDetailVisible] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [distLoading, setDistLoading] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const selectedCardsRef = useRef(new Set());
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const { showSuccess, showError } = useSnackbarHelpers();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const listBottomInset = useListBottomInset();
  const headerHeight = useHeaderHeight();
  const latestDetailFetchRef = useRef(null);
  const [progressMap, setProgressMap] = useState(new Map());
  const [pageNum, setPageNum] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;
  const shufflePressed = useSharedValue(0);

  const shuffleAnimatedStyle = useAnimatedStyle(() => {
    const springConfig = { mass: 0.6, damping: 12, stiffness: 300 };
    return {
      transform: [
        { scale: withSpring(shufflePressed.value ? 0.9 : 1, springConfig) },
        { rotate: withSpring(shufflePressed.value ? '-15deg' : '0deg', springConfig) }
      ],
      opacity: withSpring(shufflePressed.value ? 0.9 : 1, springConfig),
    };
  });

  const BAR_HEIGHT = 50;
  const MARGIN_TOP = 12;

  // Edit bar: shown / hidden at once (no height animation).
  const editBarStyle = editMode
    ? { height: BAR_HEIGHT, marginTop: MARGIN_TOP, overflow: 'hidden' }
    : { height: 0, marginTop: 0, opacity: 0, overflow: 'hidden' };

  const selectedCount = selectedCards.size;

  const moveButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(selectedCount > 0 ? 1 : 0.4, { duration: 200 }),
    };
  }, [selectedCount]);

  useEffect(() => {
    fetchChapterCards();
    checkOwnerAndLoadChapters();
  }, [chapter.id, deck?.id, userId]);

  // New search → first page again (skip the initial empty value; the effect
  // above already loaded it).
  const searchBootRef = useRef(true);
  useEffect(() => {
    if (searchBootRef.current) { searchBootRef.current = false; return; }
    // no full-screen loading: the list and the search bar (with the keyboard) stay
    fetchChapterCards({ silent: true });
  }, [debouncedSearch]);

  const sortBootRef = useRef(true);
  useEffect(() => {
    if (sortBootRef.current) { sortBootRef.current = false; return; }
    fetchChapterCards({ silent: true });
  }, [cardSort]);

  const checkOwnerAndLoadChapters = async () => {
    try {
      if (userId && deck) {
        setCurrentUserId(userId);
        setIsOwner(userId === deck.user_id && !deck.is_shared);

        const data = await listChapters(deck.id);
        setChapters(data);
        const progress = await getDeckChaptersProgressRpc(deck.id, userId);
        setProgressMap(progress);
      }
    } catch (e) {
      // noop
    }
  };

  useLayoutEffect(() => {
    // Known on the first render (session + deck params): no wait for the list.
    const isOwnerUser = Boolean(userId) && deck?.user_id === userId && !deck?.is_shared;

    navigation.setOptions({
      headerShown: true,
      headerTransparent: true,
      headerStyle: { backgroundColor: 'transparent' },
      headerTintColor: colors.text,
      headerTitle: '',
      headerLeft: undefined,
      headerRight: isOwnerUser ? () => (
        <TouchableOpacity
          onPress={() => {
            triggerHaptic('light');
            setEditMode(!editMode);
            if (editMode) {
              setSelectedCards(new Set());
            }
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <PhosphorIcon
            icon={editMode ? ICONS.close : ICONS.edit}
            size={22}
            color={colors.text}
          />
        </TouchableOpacity>
      ) : () => null,
    });
  }, [navigation, chapter?.id, userId, deck?.user_id, deck?.is_shared, editMode, colors.text, colors.background, t]);

  // The server applies the search; until its answer comes, the cards on
  // screen are filtered locally so typing shows a result at once.
  const filteredCards = useMemo(() => filterCardsWhileSearching(cards, search, cardsSearch), [cards, search, cardsSearch]);

  // Each first-page load gets an id; a response (or a load-more) that belongs
  // to an older load is ignored, so pages of two loads never mix.
  const listRequestIdRef = useRef(0);
  const firstPageInFlightRef = useRef(false);

  const fetchChapterCards = async ({ silent = false } = {}) => {
    const requestId = ++listRequestIdRef.current;
    firstPageInFlightRef.current = true;
    try {
      if (!silent) setLoading(true);
      const chapterId = chapter?.id || null;
      const searchForRequest = debouncedSearch;
      const emptyStats = { total: 0, learning: 0, learned: 0, new: 0 };

      // Header counts come from the same RPC as Chapters / DeckDetail, so every
      // screen shows the same numbers.
      const [cardsData, stats] = await Promise.all([
        getCardsByChapter(deck.id, chapterId, 0, PAGE_SIZE, userId || null, searchForRequest || null, listOptionsFor(cardSort)),
        userId
          ? getDeckChaptersProgressRpc(deck.id, userId).then((map) => map.get(chapterId || 'unassigned') || emptyStats)
          : Promise.resolve(emptyStats),
      ]);
      if (requestId !== listRequestIdRef.current) return;

      setChapterStats(stats);
      setCards(cardsData);
      setCardsSearch(searchForRequest);
      setPageNum(0);
      setHasMoreCards(cardsData.length >= PAGE_SIZE);

      // status and is_favorite come with the rows (list_cards RPC)
      setCardStatusMap(new Map(cardsData.map(c => [c.id, c.status || 'new'])));
      setFavoriteCards(cardsData.filter(c => c.is_favorite).map(c => c.id));
    } catch (error) {
      if (requestId !== listRequestIdRef.current) return;
      console.error('Error fetching chapter cards:', error);
      setCards([]);
      setCardStatusMap(new Map());
      setChapterStats({ total: 0, learning: 0, learned: 0, new: 0 });
    } finally {
      if (requestId === listRequestIdRef.current) firstPageInFlightRef.current = false;
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (userId && deck?.id) {
        const data = await listChapters(deck.id, true);
        setChapters(data);
        const progress = await getDeckChaptersProgressRpc(deck.id, userId, true);
        setProgressMap(progress);
      }
      await fetchChapterCards();
    } finally {
      setRefreshing(false);
    }
  }, [deck?.id, userId]);

  const loadMoreChapterCards = async () => {
    if (!hasMoreCards || loadingMore || loading) return;
    // a first page (often a silent search) is still loading: no next page yet
    if (firstPageInFlightRef.current) return;
    // A new search is on its way: don't load the next page of the old one
    // (that was the loader under the instantly filtered results).
    if (normSearchText(search) !== normSearchText(cardsSearch)) return;
    setLoadingMore(true);
    const requestId = listRequestIdRef.current;
    try {
      const nextPage = pageNum + 1;
      const chapterId = chapter?.id || null;
      const cardsData = await getCardsByChapter(deck.id, chapterId, nextPage, PAGE_SIZE, userId || null, debouncedSearch || null, listOptionsFor(cardSort));
      if (requestId !== listRequestIdRef.current) return;
      if (cardsData.length === 0) {
        setHasMoreCards(false);
        return;
      }

      setCardStatusMap(prev => {
        const next = new Map(prev);
        cardsData.forEach(c => next.set(c.id, c.status || 'new'));
        return next;
      });
      const pageFavIds = cardsData.filter(c => c.is_favorite).map(c => c.id);
      setFavoriteCards(prev => [...new Set([...prev, ...pageFavIds])]);

      setCards(prev => {
        const have = new Set(prev.map(c => c.id));
        return [...prev, ...cardsData.filter(c => !have.has(c.id))];
      });
      setPageNum(nextPage);
      setHasMoreCards(cardsData.length >= PAGE_SIZE);
    } catch (e) {
      console.error('Error loading more chapter cards:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  // ref: the toggle stays the same function, so rows don't all re-render
  const favoriteCardsRef = useRef(favoriteCards);
  favoriteCardsRef.current = favoriteCards;
  const favoriteIdSet = useMemo(() => new Set(favoriteCards), [favoriteCards]);
  const handleToggleFavoriteCard = useCallback(async (cardId) => {
    if (!userId) return;
    const wasFavorite = favoriteCardsRef.current.includes(cardId);
    setFavoriteCards(prev => wasFavorite ? prev.filter(id => id !== cardId) : [...prev, cardId]);
    try {
      wasFavorite ? await removeFavoriteCard(userId, cardId) : await addFavoriteCard(userId, cardId);
    } catch (e) {
      setFavoriteCards(prev => wasFavorite ? [...prev, cardId] : prev.filter(id => id !== cardId));
    }
  }, [userId]);

  // Read-aloud of the question: one state for the whole list.
  const { speakingKey, speak: speakText, stop: stopSpeaking } = useSpeakText(deck?.id ?? null);
  const handleSpeakCard = useCallback((card) => {
    speakText(`list_${card.id}`, card.question, 'front');
  }, [speakText]);
  useFocusEffect(useCallback(() => () => stopSpeaking(), [stopSpeaking]));

  // --- Detail sheet ---
  const openDetail = useCallback((card) => {
    fetchAndSetCardDetailRef.current(card);
    setDetailVisible(true);
  }, []);

  const handleSheetEdit = useCallback((card) => {
    navigation.navigate('EditCard', { card, deck, returnKey: route.key });
  }, [deck, navigation, route.key]);

  const handleSheetDelete = useCallback((card) => {
    Alert.alert(
      t('cardDetail.warningTitle', 'Uyarı'),
      t('cardDetail.deleteConfirm', 'Kartı silmek istediğinize emin misiniz?'),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('common.delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCard(card.id);
              setDetailVisible(false);
              await fetchChapterCards();
            } catch (e) {
              showError(t('cardDetail.deleteError', 'Kart silinirken bir hata oluştu.'));
            }
          },
        },
      ]
    );
  }, [showError, t]);

  // Back from the edit page with the saved card.
  const editedCard = route.params?.editedCard;
  useEffect(() => {
    if (!editedCard) return;
    navigation.setParams({ editedCard: undefined });
    cardDetailsRef.current.set(editedCard.id, editedCard);
    setCards((prev) => prev.map((c) => (c.id === editedCard.id ? { ...c, ...editedCard } : c)));
    setSelectedCard((prev) => ({ ...(prev || {}), ...editedCard, isFullDataLoaded: true }));
    setDetailVisible(true);
  }, [editedCard, navigation]);

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
      // keep lightweight data
    }
  }, []);

  const handleDistribute = async () => {
    if (!deck?.id) return;
    if (!chapters?.length) {
      showError(t('chapters.needChapters', 'Dağıtım için en az bir bölüm oluşturmalısın.'));
      return;
    }
    setDistLoading(true);
    try {
      await distributeUnassignedEvenly(deck.id, chapters.map(c => c.id), currentUserId);
      showSuccess(t('chapters.distributed', 'Atanmamış kartlar bölümlere dağıtıldı.'));
      await fetchChapterCards();
    } catch (e) {
      showError(e.message || t('chapters.distributeError', 'Dağıtım yapılamadı.'));
    } finally {
      setDistLoading(false);
    }
  };

  const handleToggleCardSelection = useCallback((cardId) => {
    triggerHaptic('light');

    setSelectedCards((prevSelected) => {
      const newSelected = new Set(prevSelected);

      if (newSelected.has(cardId)) {
        newSelected.delete(cardId);
      } else {
        newSelected.add(cardId);
      }

      // State'ten bağımsız olarak daima son seçimi tut
      selectedCardsRef.current = newSelected;

      return newSelected;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedCards.size === filteredCards.length) {
      selectedCardsRef.current = new Set();
      setSelectedCards(new Set());
    } else {
      const allSelected = new Set(filteredCards.map(c => c.id));

      selectedCardsRef.current = allSelected;
      setSelectedCards(allSelected);
    }
  };

  const handleMoveToChapter = async (targetChapterId) => {
    // Modal içinden gelen callback eski render'a ait olsa bile
    // her zaman güncel seçimi ref'ten al.
    const cardIds = Array.from(selectedCardsRef.current);

    if (cardIds.length === 0) {
      showError(
        t(
          'chapterCards.noCardsSelected',
          'Lütfen en az bir kart seçin.'
        )
      );
      return;
    }

    setMoveLoading(true);

    try {
      await updateCardsChapter(
        cardIds,
        targetChapterId,
        deck.id,
        currentUserId
      );

      showSuccess(
        t(
          'chapterCards.cardsMoved',
          '{{count}} kart bölüme taşındı.',
          { count: cardIds.length }
        )
      );

      // Başarılı taşıma sonrası temizle
      selectedCardsRef.current = new Set();
      setSelectedCards(new Set());

      setEditMode(false);
      setShowChapterModal(false);

      await fetchChapterCards();
    } catch (e) {
      showError(
        e.message ||
        t(
          'chapterCards.moveError',
          'Kartlar taşınamadı.'
        )
      );
    } finally {
      setMoveLoading(false);
    }
  };


  const fetchAndSetCardDetailRef = useRef(fetchAndSetCardDetail);
  fetchAndSetCardDetailRef.current = fetchAndSetCardDetail;
  const handleCardPress = openDetail;

  const renderCardItem = useCallback(({ item: card }) => {
    return (
      <MemoizedCardItem
        card={card}
        status={cardStatusMap.get(card.id) || 'new'}
        isFavorite={favoriteIdSet.has(card.id)}
        isSpeaking={speakingKey === `list_${card.id}`}
        isSelected={selectedCards.has(card.id)}
        editMode={editMode}
        onToggle={handleToggleCardSelection}
        onPress={handleCardPress}
        onToggleFavorite={handleToggleFavoriteCard}
        onSpeak={isSpeechAvailable ? handleSpeakCard : undefined}
      />
    );
  }, [cardStatusMap, favoriteIdSet, speakingKey, selectedCards, editMode, handleToggleCardSelection, handleCardPress, handleToggleFavoriteCard, handleSpeakCard]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LottieView source={require('../../assets/animations/flexloader.json')} speed={1.1} autoPlay loop style={{ width: 160, height: 160 }} />
        <LottieView source={require('../../assets/animations/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100, marginTop: -65 }} />
      </View>
    );
  }

  const chapterIcon = chapter?.id ? ICONS.chapter : ICONS.unassigned;
  const chapterName = chapter?.name || t('chapterCards.noChapter', 'Atanmamış Kartlar');

  return (
    <View style={[styles.bgGradient, { backgroundColor: colors.background }]}>
      {/* Fixed Header Section */}
      <View style={styles.fixedHeaderContainer}>
        <LinearGradient
          colors={[colors.cardBackground, colors.cardBackground]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fixedHeaderGradient, { paddingTop: headerHeight + 32 }]}
        >
          <View style={styles.headerContent}>
            {/* Icon and Title Section */}
            <View style={styles.heroContent}>
              <View style={styles.heroIconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: colors.buttonColor + '20' }]}>
                  <PhosphorIcon icon={chapterIcon} size={28} color={colors.buttonColor} />
                </View>
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>
                  {chapterName}
                </Text>
              </View>
            </View>

            {/* İstatistikler Kartı */}
            <View style={styles.statsCard}>

              {/* Total */}
              <View style={styles.statItem}>
                <View style={styles.iconBox}>
                  <PhosphorIcon icon={ICONS.stack} size={18} color={colors.buttonColor} />
                </View>
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.total}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* New */}
              <View style={styles.statItem}>
                <View style={styles.iconBox}>
                  <PhosphorIcon icon={ICONS.statusNew} size={22} color={colors.buttonColor} />
                </View>
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.new}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Learning */}
              <View style={styles.statItem}>
                <View style={styles.iconBox}>
                  <PhosphorIcon icon={ICONS.fire} size={20} color={colors.buttonColor} />
                </View>
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.learning}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Learned */}
              <View style={styles.statItem}>
                <View style={styles.iconBox}>
                  <PhosphorIcon icon={ICONS.learned} size={18} color={colors.buttonColor} />
                </View>
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.learned}
                </Text>
              </View>

            </View>

            {/* Search Row */}
            <View style={styles.searchRow}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={t('chapterCards.searchPlaceholder', 'Kartlarda ara...')}
                style={styles.searchBar}
              />
              <FilterIcon value={cardSort} onChange={setCardSort} />
            </View>

            {/* Edit mode'da seçim butonları */}
            <Reanimated.View style={[styles.editModeBar, editBarStyle]}>
              {/* İçeriğin ezilmemesi için sabit bir kapsayıcı (container) */}
              <View style={styles.editModeContent}>

                {/* Sol Kısım: Tümünü Seç */}
                <TouchableOpacity
                  onPress={handleSelectAll}
                  style={styles.actionPillButton}
                  activeOpacity={0.7}
                >
                  {/* Same box as the card checkboxes, at pill size. */}
                  <View
                    style={[
                      styles.selectAllBox,
                      {
                        borderColor: colors.buttonColor,
                        backgroundColor: selectedCards.size === filteredCards.length ? colors.buttonColor : 'transparent',
                      },
                    ]}
                  >
                    {selectedCards.size === filteredCards.length && (
                      <PhosphorIcon icon={ICONS.check} size={13} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={[styles.actionPillText, { color: colors.text }]}>
                    {selectedCards.size === filteredCards.length
                      ? t('chapterCards.deselectAll', 'Tümünü Kaldır')
                      : t('chapterCards.selectAll', 'Tümünü Seç')}
                  </Text>
                </TouchableOpacity>

                {/* Orta Kısım: Seçili Sayısı */}
                <View style={styles.badgeContainer}>
                  <Text style={[styles.badgeText, { color: colors.text }]}>
                    {selectedCards.size} {t('chapterCards.selected', 'seçili')}
                  </Text>
                </View>

                {/* Sağ Kısım: Taşı Butonu */}
                <Reanimated.View style={moveButtonAnimatedStyle}>
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic('light');
                      requestAnimationFrame(() => {
                        setShowChapterModal(true);
                      });
                    }}
                    style={[styles.actionPillButton, styles.moveButtonVariant]}
                    activeOpacity={0.7}
                    disabled={selectedCards.size === 0}
                  >
                    <Text style={[styles.moveButtonText, { color: colors.buttonColor }]}>
                      {t('chapterCards.move', 'Taşı')}
                    </Text>
                    <PhosphorIcon
                      icon={ICONS.chevronRight}
                      size={16}
                      color={colors.buttonColor}
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>
                </Reanimated.View>

              </View>
            </Reanimated.View>
          </View>
        </LinearGradient>
      </View>

      {/* List Content */}
      <View style={[styles.listContainer, { backgroundColor: colors.background }]}>
        {cards.length === 0 ? (
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/images/cardbg.webp')}
              style={{ width: 500, height: 500, opacity: 0.2 }}
              resizeMode="contain"
            />
            <Text style={[typography.styles.body, { color: colors.text, opacity: 0.6, textAlign: 'center', fontSize: fontSizes.body, marginTop: -150 }]}>
              {t('chapterCards.noCardsDesc', 'Bu bölümde henüz kart oluşturulmamış.')}
            </Text>
          </View>
        ) : (
          <View>
            <FlatList
              data={filteredCards}
              renderItem={renderCardItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.cardsList, { paddingHorizontal: LIST_SIDE_PADDING, paddingBottom: listBottomInset + styles.fab.height + 16, paddingTop: 20 } /* clears the FAB */]}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              onEndReached={loadMoreChapterCards}
              onEndReachedThreshold={0.5}
              ListFooterComponent={loadingMore ? (
                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.text} />
                </View>
              ) : null}
              removeClippedSubviews={true}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={11}
            />
          </View>
        )}
      </View>

      {/* Floating Action Button - Atanmamış kartlar için dağıtım butonu */}
      {!chapter?.id && !editMode && Boolean(userId) && deck?.user_id === userId && !deck?.is_shared && (
        <AnimatedPressable
          style={[styles.fab, shuffleAnimatedStyle, { bottom: insets.bottom + 24 }]} // Dönüş ve küçülme stilini verdik
          disabled={distLoading} // Yüklenirken tıklamayı kapat
          onPressIn={() => {
            if (!distLoading) shufflePressed.value = 1; // Yüklenmiyorsa animasyonu başlat
          }}
          onPressOut={() => {
            shufflePressed.value = 0; // Parmağı çekince eski haline döndür
          }}
          onPress={() => {
            triggerHaptic('light');
            requestAnimationFrame(() => {
              handleDistribute();
            });
          }}
        >
          <LinearGradient
            colors={['#F98A21', '#FF6B35']}
            locations={[0, 0.99]}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {distLoading ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <PhosphorIcon icon={ICONS.shuffle} size={28} color="#FFFFFF" />
            )}
          </LinearGradient>
        </AnimatedPressable>
      )}

      {/* Bölüm Seçim Modal */}
      <ChapterSelector
        isVisible={showChapterModal}
        onClose={() => {
          // Modal kapanırken seçimi SAKIN temizleme.
          // Seçim sadece taşıma başarıyla bittikten sonra temizlenecek.
          setShowChapterModal(false);
        }}
        chapters={chapters}
        progressMap={progressMap}
        onSelectChapter={(chapterId) => {
          handleMoveToChapter(chapterId);
        }}
      />

      <CardDetailSheet
        card={selectedCard}
        deck={deck}
        visible={detailVisible}
        onDismiss={() => setDetailVisible(false)}
        isFavorite={Boolean(selectedCard && favoriteCards.includes(selectedCard.id))}
        onToggleFavorite={(card) => handleToggleFavoriteCard(card.id)}
        onEdit={isOwner ? handleSheetEdit : undefined}
        onDelete={isOwner ? handleSheetDelete : undefined}
        showCreatedAt={isOwner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bgGradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    flexDirection: 'column',
    marginTop: -120,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerTitle: {
    textAlign: 'center',
  },
  fixedHeaderContainer: {
    zIndex: 1,
    overflow: 'hidden',
  },
  fixedHeaderGradient: {
    paddingBottom: 12,
    paddingHorizontal: 0,
  },
  headerContent: {
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 20,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroIconContainer: {
    marginRight: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  heroTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    ...typography.styles.title2,
    fontSize: fontSizes.title1,
    fontFamily: fonts.bold,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    ...typography.styles.subhead,
    fontSize: fontSizes.body,
    fontFamily: fonts.medium,
    lineHeight: 20,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(150, 150, 150, 0.08)', // Hem dark hem light modda çalışan çok şık, zarif bir arka plan
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  statItem: {
    flex: 1, // Tüm öğelerin genişliğini kusursuz bir şekilde eşitler
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10, // Hafif kavisli kare (squircle) görünümü
    backgroundColor: 'rgba(150, 150, 150, 0.12)', // İkonun arkasındaki premium vurgu
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  statText: {
    fontSize: fontSizes.body,
    fontFamily: fonts.bold, // Sayıların daha okunaklı ve vurgulu olması için kalınlık artırıldı
    letterSpacing: 0.5,
  },
  divider: {
    width: StyleSheet.hairlineWidth, // Cihazın çizebileceği en ince çizgiyi çizer (Çok profesyonel durur)
    height: '60%',
    backgroundColor: 'rgba(150, 150, 150, 0.3)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  searchBar: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    marginTop: -20,
    zIndex: 2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  cardsList: {
    paddingBottom: 20,
  },
  divider: {
    height: 2,
    alignSelf: 'stretch',
    marginVertical: 8,
    borderRadius: 2,
  },
  answer: {
    fontSize: fontSizes.body,
    marginTop: 4,
    fontFamily: fonts.regular,
    letterSpacing: 0.2,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -250,
  },
  loadingText: {
    fontSize: fontSizes.body,
  },
  cardRow: {
    marginBottom: 10,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    zIndex: 1000,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 35,
  },
  selectAllBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModeBar: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Şık bir yarı saydam arka plan (Glassmorphism etkisi)
    borderRadius: 16,
  },
  editModeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  actionPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20, // Tam yuvarlak (hap) görünüm
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // Butonlar için hafif bir vurgu
  },
  actionPillText: {
    fontSize: fontSizes.footnote,
    fontFamily: fonts.semibold,
    marginLeft: 4,
  },
  moveButtonVariant: {
    backgroundColor: '#fff', // Taşı butonu ana eylem olduğu için tam beyaz
  },
  moveButtonText: {
    color: '#ffffff', // Projenin ana rengi (örneğin mavi/mor)
    fontSize: fontSizes.footnote,
    fontFamily: fonts.bold,
  },
  badgeContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: fontSizes.caption,
    fontFamily: fonts.medium,
    opacity: 0.9,
  }
});
