import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, memo, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, TouchableHighlight, ActivityIndicator, Platform, Image, Pressable, RefreshControl, BackHandler } from 'react-native';
import { Text } from '../../components/ui/AppText';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useAuth } from '../../contexts/AuthContext';
import { updateCardsChapter } from '../../services/CardService';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import SearchBar from '../../components/tools/SearchBar';
import CardDetailView from '../../components/layout/CardDetailView';
import AddEditCardInlineForm from '../../components/layout/EditCardForm';
import { listChapters, distributeUnassignedEvenly, getDeckChaptersProgressRpc } from '../../services/ChapterService';
import { deleteCard, getCardsByChapter, getUserCardProgressForCards, getChapterProgressCounts, getCardDetail } from '../../services/CardService';
import { addFavoriteCard, removeFavoriteCard, getFavoriteCardIdsForCards } from '../../services/FavoriteService';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { MenuView } from '@expo/ui/community/menu';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import ChapterSelector from '../../components/modals/ChapterSelector';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { triggerHaptic } from '../../lib/hapticManager';
import { useListBottomInset } from '../../components/ui/CustomTabBar';

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

const MemoizedCardItem = memo(({
  card,
  status,
  isSelected,
  editMode,
  colors,
  onToggle,
  onPress
}) => {
  let statusIcon = 'streamline-freehand:view-eye-off'; // default: new

  if (status === 'learning') {
    statusIcon = 'mdi:fire';
  } else if (status === 'learned') {
    statusIcon = 'dashicons:welcome-learn-more';
  }

  return (
    <TouchableHighlight
      style={[
        styles.cardItem,
        {
          backgroundColor: colors.cardBackground,
          borderColor: editMode && isSelected ? colors.buttonColor : colors.cardBorder,
          borderWidth: editMode && isSelected ? 2 : 1,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
        },
      ]}
      onPress={() => {
        if (editMode) {
          onToggle(card.id);
        } else {
          onPress(card);
        }
      }}
      underlayColor={colors.cardBackground === '#F4F1EA' ? '#EBE7DD' : '#383838'}
    >
      <View style={styles.cardContent}>
        {editMode && (
          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              onPress={() => onToggle(card.id)}
              style={[
                styles.checkbox,
                {
                  backgroundColor: isSelected ? colors.buttonColor : 'transparent',
                  borderColor: colors.buttonColor,
                }
              ]}
            >
              {isSelected && (
                <Iconify icon="hugeicons:tick-01" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={[
          styles.leftSection,
          {
            borderRightColor: colors.cardBorder,
            flex: editMode ? 2 : 3,
          }
        ]}>
          <Text
            style={[styles.question, { fontSize: fontSizes.body }, { color: colors.cardQuestionText }]}
            numberOfLines={1}
          >
            {card.question}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.cardDivider }]} />
          <Text
            style={[styles.question, { fontSize: fontSizes.body }, { color: colors.cardQuestionText }]}
            numberOfLines={1}
          >
            {card.answer}
          </Text>
        </View>

        <View style={[
          styles.rightSection,
          {
            backgroundColor: colors.cardBackground ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)',
          }
        ]}>
          <Iconify
            icon={statusIcon}
            size={50}
            color={'#444444'}
          />
        </View>
      </View>
    </TouchableHighlight>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.status === nextProps.status &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.editMode === nextProps.editMode &&
    prevProps.card.id === nextProps.card.id &&
    prevProps.colors === nextProps.colors
  );
});

export default function ChapterCardsScreen({ route, navigation }) {
  const { chapter, deck } = route.params;
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [search, setSearch] = useState('');
  const [cardStatusMap, setCardStatusMap] = useState(new Map());
  const [chapterStats, setChapterStats] = useState({ total: 0, learning: 0, learned: 0, new: 0 });
  const [selectedCard, setSelectedCard] = useState(null);
  const [editCardMode, setEditCardMode] = useState(false);
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
  const moreMenuActionsRef = useRef({});
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const listBottomInset = useListBottomInset();
  const headerHeight = useHeaderHeight();
  const latestDetailFetchRef = useRef(null);
  const selectedCardRef = useRef(null);
  const editCardModeRef = useRef(false);
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

  const animatedBarStyle = useAnimatedStyle(() => {
    return {
      height: withTiming(editMode ? BAR_HEIGHT : 0, { duration: 300 }),
      opacity: withTiming(editMode ? 1 : 0, { duration: 300 }),
      marginTop: withTiming(editMode ? MARGIN_TOP : 0, { duration: 300 }),
      overflow: 'hidden',
    };
  }, [editMode, BAR_HEIGHT, MARGIN_TOP]);

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

  useEffect(() => {
    selectedCardRef.current = selectedCard;
  }, [selectedCard]);

  useEffect(() => {
    editCardModeRef.current = editCardMode;
  }, [editCardMode]);

  useEffect(() => {
    const onBackPress = () => {
      if (editCardModeRef.current) {
        setEditCardMode(false);
        return true;
      }
      if (selectedCardRef.current) {
        setSelectedCard(null);
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (editCardModeRef.current) {
        e.preventDefault();
        setEditCardMode(false);
        return;
      }
      if (selectedCardRef.current) {
        e.preventDefault();
        setSelectedCard(null);
      }
    });

    return unsubscribe;
  }, [navigation]);

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
    const isOwnerUser = currentUserId && deck?.user_id === currentUserId && !deck?.is_shared;

    if (!selectedCard && loading) {
      navigation.setOptions({
        headerShown: true,
        headerTransparent: true,
        headerStyle: { backgroundColor: 'transparent' },
        headerTintColor: colors.text,
        headerTitle: '',
        headerRight: () => null,
      });
      return;
    }

    if (selectedCard) {
      if (editCardMode) {
        navigation.setOptions({
          headerShown: true,
          headerTransparent: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitle: '',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => setEditCardMode(false)}
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
          headerRight: () => null,
        });
        return;
      }

      navigation.setOptions({
        headerShown: true,
        headerTransparent: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitle: '',
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 8 }}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('medium');
                requestAnimationFrame(() => {
                  handleToggleFavoriteCard(selectedCard.id);
                });
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
            {isOwnerUser && (
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
                  <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={24} color={colors.text} />
                </View>
              </MenuView>
            )}
          </View>
        ),
      });
      return;
    }

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
          <Iconify
            icon={editMode ? "mingcute:close-fill" : "lucide:edit"}
            size={22}
            color={colors.text}
          />
        </TouchableOpacity>
      ) : () => null,
    });
  }, [loading, navigation, chapter?.id, currentUserId, deck?.user_id, deck?.is_shared, editMode, selectedCard, editCardMode, favoriteCards, colors.text, colors.background, t]);

  const filteredCards = useMemo(() => {
    if (!search.trim()) return cards;
    const s = search.trim().toLowerCase();
    return cards.filter(c =>
      (c.question && c.question.toLowerCase().includes(s)) ||
      (c.answer && c.answer.toLowerCase().includes(s))
    );
  }, [cards, search]);

  const fetchChapterCards = async () => {
    try {
      setLoading(true);
      const chapterId = chapter?.id || null;

      const [cardsData, stats] = await Promise.all([
        getCardsByChapter(deck.id, chapterId, 0, PAGE_SIZE, userId || null),
        userId ? getChapterProgressCounts(userId, deck.id, chapterId) : Promise.resolve({ total: 0, learning: 0, learned: 0, new: 0 }),
      ]);

      setChapterStats(stats);
      setCards(cardsData);
      setPageNum(0);
      setHasMoreCards(cardsData.length >= PAGE_SIZE);

      if (cardsData.length > 0 && userId) {
        const cardIds = cardsData.map(c => c.id);
        const [progressMap, favSet] = await Promise.all([
          getUserCardProgressForCards(userId, cardIds),
          getFavoriteCardIdsForCards(userId, cardIds),
        ]);
        const statusMap = new Map();
        cardIds.forEach(id => { statusMap.set(id, progressMap[id] || 'new'); });
        setCardStatusMap(statusMap);
        setFavoriteCards(Array.from(favSet));
      } else {
        const statusMap = new Map();
        cardsData.forEach(c => statusMap.set(c.id, 'new'));
        setCardStatusMap(statusMap);
        setFavoriteCards([]);
      }
    } catch (error) {
      console.error('Error fetching chapter cards:', error);
      setCards([]);
      setCardStatusMap(new Map());
      setChapterStats({ total: 0, learning: 0, learned: 0, new: 0 });
    } finally {
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
    setLoadingMore(true);
    try {
      const nextPage = pageNum + 1;
      const chapterId = chapter?.id || null;
      const cardsData = await getCardsByChapter(deck.id, chapterId, nextPage, PAGE_SIZE, userId || null);
      if (cardsData.length === 0) {
        setHasMoreCards(false);
        return;
      }

      if (userId && cardsData.length > 0) {
        const cardIds = cardsData.map(c => c.id);
        const [progressMap, favSet] = await Promise.all([
          getUserCardProgressForCards(userId, cardIds),
          getFavoriteCardIdsForCards(userId, cardIds),
        ]);
        const newStatusMap = new Map(cardStatusMap);
        cardIds.forEach(id => { newStatusMap.set(id, progressMap[id] || 'new'); });
        setCardStatusMap(newStatusMap);
        setFavoriteCards(prev => [...new Set([...prev, ...Array.from(favSet)])]);
      } else {
        const newStatusMap = new Map(cardStatusMap);
        cardsData.forEach(c => newStatusMap.set(c.id, 'new'));
        setCardStatusMap(newStatusMap);
      }

      setCards(prev => [...prev, ...cardsData]);
      setPageNum(nextPage);
      setHasMoreCards(cardsData.length >= PAGE_SIZE);
    } catch (e) {
      console.error('Error loading more chapter cards:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleFavoriteCard = useCallback(async (cardId) => {
    if (!userId) return;
    const wasFavorite = favoriteCards.includes(cardId);
    setFavoriteCards(prev => wasFavorite ? prev.filter(id => id !== cardId) : [...prev, cardId]);
    try {
      wasFavorite ? await removeFavoriteCard(userId, cardId) : await addFavoriteCard(userId, cardId);
    } catch (e) {
      setFavoriteCards(prev => wasFavorite ? [...prev, cardId] : prev.filter(id => id !== cardId));
    }
  }, [userId, favoriteCards]);

  const handleEditSelectedCard = () => {
    if (!selectedCard) return;
    setEditCardMode(true);
  };

  const handleDeleteSelectedCard = async () => {
    if (!selectedCard) return;
    try {
      await deleteCard(selectedCard.id);
      setSelectedCard(null);
      setEditCardMode(false);
      await fetchChapterCards();
    } catch (e) {
      showError(t('cardDetail.deleteError', 'Kart silinirken bir hata oluştu.'));
    }
  };

  // The header menu lives in a setOptions closure; read the handlers through a
  // ref so it always sees the current selection.
  moreMenuActionsRef.current = { edit: handleEditSelectedCard, delete: handleDeleteSelectedCard };

  const fetchAndSetCardDetail = useCallback(async (card) => {
    if (!card) {
      setSelectedCard(null);
      return;
    }
    const cardId = card.id;
    latestDetailFetchRef.current = cardId;
    setSelectedCard(card);

    if (!card.isFullDataLoaded) {
      try {
        const detail = await getCardDetail(cardId);
        if (latestDetailFetchRef.current === cardId && detail) {
          const updatedCard = { ...card, ...detail, isFullDataLoaded: true };
          setSelectedCard(prev => prev?.id === cardId ? updatedCard : prev);
          setCards(prevCards => prevCards.map(c => c.id === cardId ? updatedCard : c));
        }
      } catch (e) {
        // keep lightweight data
      }
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

  const CARD_ITEM_HEIGHT = 110 + 12;
  const getItemLayout = useCallback((data, index) => ({
    length: CARD_ITEM_HEIGHT,
    offset: CARD_ITEM_HEIGHT * index,
    index,
  }), [CARD_ITEM_HEIGHT]);

  const handleCardPress = useCallback((card) => {
    fetchAndSetCardDetail(card);
  }, [fetchAndSetCardDetail]);

  const renderCardItem = useCallback(({ item: card }) => {
    return (
      <MemoizedCardItem
        card={card}
        status={cardStatusMap.get(card.id) || 'new'}
        isSelected={selectedCards.has(card.id)}
        editMode={editMode}
        colors={colors}
        onToggle={handleToggleCardSelection}
        onPress={handleCardPress}
      />
    );
  }, [cardStatusMap, selectedCards, editMode, colors, handleToggleCardSelection, handleCardPress]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LottieView source={require('../../assets/flexloader.json')} speed={1.1} autoPlay loop style={{ width: 160, height: 160 }} />
        <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100, marginTop: -65 }} />
      </View>
    );
  }

  // Kart detay görünümü gösteriliyorsa
  if (selectedCard) {
    return (
      <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
        {editCardMode ? (
          <AddEditCardInlineForm
            card={selectedCard}
            deck={deck}
            onSave={async (updatedCard) => {
              setCards(cards.map(c => c.id === updatedCard.id ? updatedCard : c));
              setSelectedCard(updatedCard);
              setEditCardMode(false);
              await fetchChapterCards();
            }}
            onCancel={() => {
              setEditCardMode(false);
            }}
          />
        ) : (
          <>
            <CardDetailView
              card={selectedCard}
              cards={cards}
              onSelectCard={card => {
                fetchAndSetCardDetail(card);
                setEditCardMode(false);
              }}
              showCreatedAt={true}
              isDeckOwner={isOwner}
            />
          </>
        )}
      </SafeAreaView>
    );
  }

  const chapterIcon = chapter?.id ? 'streamline-freehand:plugin-jigsaw-puzzle' : 'mage:inbox-star';
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
                  <Iconify icon={chapterIcon} size={28} color={colors.buttonColor} />
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
                  <Iconify icon="ri:stack-fill" size={18} color={colors.buttonColor} />
                </View>
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.total}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* New */}
              <View style={styles.statItem}>
                <View style={styles.iconBox}>
                  <Iconify icon="basil:eye-closed-outline" size={22} color={colors.buttonColor} />
                </View>
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.new}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Learning */}
              <View style={styles.statItem}>
                <View style={styles.iconBox}>
                  <Iconify icon="mdi:fire" size={20} color={colors.buttonColor} />
                </View>
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.learning}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Learned */}
              <View style={styles.statItem}>
                <View style={styles.iconBox}>
                  <Iconify icon="dashicons:welcome-learn-more" size={18} color={colors.buttonColor} />
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
            </View>

            {/* Edit mode'da seçim butonları */}
            <Reanimated.View style={[styles.editModeBar, animatedBarStyle]}>
              {/* İçeriğin ezilmemesi için sabit bir kapsayıcı (container) */}
              <View style={styles.editModeContent}>

                {/* Sol Kısım: Tümünü Seç */}
                <TouchableOpacity
                  onPress={handleSelectAll}
                  style={styles.actionPillButton}
                  activeOpacity={0.7}
                >
                  <Iconify
                    icon={selectedCards.size === filteredCards.length ? "material-symbols:all-out-rounded" : "material-symbols:all-out-outline-rounded"}
                    size={18}
                    color={colors.text}
                  />
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
                    <Iconify
                      icon="ion:chevron-forward"
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
              source={require('../../assets/cardbg.webp')}
              style={{ width: 500, height: 500, opacity: 0.2 }}
              resizeMode="contain"
            />
            <Text style={[typography.styles.body, { color: colors.text, opacity: 0.6, textAlign: 'center', fontSize: fontSizes.body, marginTop: -150 }]}>
              {t('chapterCards.noCardsDesc', 'Bu bölümde henüz kart oluşturulmamış.')}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 18 }}>
            <FlatList
              data={filteredCards}
              renderItem={renderCardItem}
              keyExtractor={(item) => item.id.toString()}
              getItemLayout={getItemLayout}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.cardsList, { paddingBottom: listBottomInset + styles.fab.height + 16, paddingTop: 20 } /* clears the FAB */]}
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
      {!chapter?.id && !editMode && currentUserId && deck?.user_id === currentUserId && !deck?.is_shared && (
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
              <Iconify icon="fluent:arrow-shuffle-24-filled" size={28} color="#FFFFFF" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  // Same size as the icon: the iOS 26 bar draws its glass capsule around this.
  headerMenuHost: {
    width: 24,
    height: 24,
  },
  headerMenuTrigger: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  cardItem: {
    width: '100%',
    minHeight: 110,
    borderRadius: 30,
    marginBottom: 12,
    padding: 0,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    width: '100%',
    minHeight: 110,
    alignSelf: 'stretch',
  },
  leftSection: {
    flex: 3,
    padding: 20,
    justifyContent: 'center',
    borderRightWidth: 5,
    minHeight: 110,
  },
  rightSection: {
    width: '25%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    minHeight: 110,
  },
  question: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.bodyLarge,
    marginBottom: 8,
    letterSpacing: 0.3,
    marginTop: 4,
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
  checkboxContainer: {
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
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
