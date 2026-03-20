import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Image, Pressable } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  LinearTransition,
  FadeIn,
  FadeOut,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Swiper from 'react-native-deck-swiper';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { getCardsToLearn, batchUpsertProgress, getChapterProgressCounts } from '../../services/CardService';
import { getDeckById } from '../../services/DeckService';
import { invalidateCache } from '../../services/CacheService';
import { useAuth } from '../../contexts/AuthContext';
import { Iconify } from 'react-native-iconify';
import home_logo from '../../assets/home_logo.png';
import { useTranslation } from 'react-i18next';
import { addFavoriteCard, removeFavoriteCard, getFavoriteCardIds } from '../../services/FavoriteService';
import LottieView from 'lottie-react-native';
import { scale, moderateScale, verticalScale, getIsTablet, useWindowDimensions } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';
import * as BlockService from '../../services/BlockService';
import ReportModal from '../../components/modals/ReportModal';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import SwipeFlipCard from '../../components/layout/SwipeFlipCard';
import { triggerHaptic } from '../../lib/hapticManager';

// Eğer henüz yoksa AnimatedPressable'ı oluştur (önceki sayfalardaki gibi)
const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

// --- YENİ MİNİ BİLEŞENİMİZ ---
const AnimatedTimeButton = ({ onPress, icon, text, buttonStyle, textStyle, iconColor }) => {
  const isPressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    // Easing kullanmıyoruz, sadece duration veriyoruz. 
    // Reanimated kendi pürüzsüz varsayılan easing'ini kullanacak.
    const timingConfig = { duration: 150 };

    return {
      transform: [
        { scale: withTiming(isPressed.value ? 0.98 : 1, timingConfig) }
      ],
      opacity: withTiming(isPressed.value ? 0.75 : 1, timingConfig),
    };
  });

  return (
    <AnimatedPressable
      style={[buttonStyle, animatedStyle]}
      onPressIn={() => { isPressed.value = 1; }}
      onPressOut={() => { isPressed.value = 0; }}
      onPress={() => {
        triggerHaptic('light');
        requestAnimationFrame(() => {
          onPress();
        });
      }}
    >
      <Iconify icon={icon} size={moderateScale(20)} color={iconColor} style={{ marginRight: scale(6) }} />
      <Text style={[textStyle, { color: iconColor }]}>{text}</Text>
    </AnimatedPressable>
  );
};

export default function SwipeDeckScreen({ route, navigation }) {
  const { deck, chapter } = route.params || {};
  const { colors } = useTheme();
  const { session } = useAuth();
  const authUserId = session?.user?.id;

  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();

  // Responsive kart boyutları - useMemo ile optimize edilmiş
  // Hibrit yaklaşım: scale() (dp bazlı) + ekran boyutu sınırları (fiziksel boyut kontrolü)
  const cardDimensions = useMemo(() => {
    const { CARD } = RESPONSIVE_CONSTANTS;

    const getCardWidth = () => {
      if (isTablet) {
        const scaledWidth = scale(CARD.REFERENCE_TABLET_MAX_WIDTH);
        const maxWidth = width * CARD.TABLET_WIDTH_PERCENT;
        return Math.min(scaledWidth, maxWidth);
      }

      const scaledWidth = scale(CARD.REFERENCE_WIDTH);
      const maxWidth = width * CARD.NORMAL_PHONE_WIDTH_PERCENT;
      return Math.min(scaledWidth, maxWidth);
    };

    const calculateCardHeight = (cardWidth) => {
      const idealHeight = cardWidth * CARD.ASPECT_RATIO;
      const maxHeightPercentage = height < RESPONSIVE_CONSTANTS.SMALL_SCREEN_MAX_HEIGHT
        ? CARD.SMALL_SCREEN_MAX_HEIGHT_PERCENT
        : CARD.NORMAL_PHONE_MAX_HEIGHT_PERCENT;

      const maxHeight = height * maxHeightPercentage;
      return Math.min(idealHeight, maxHeight);
    };

    // Yatay margin hesaplama - sağ ve sol boşlukları eşit yap
    const getCardHorizontalMargin = (cardWidth) => {
      const remainingSpace = width - cardWidth;
      return remainingSpace / 2;
    };

    const cardWidth = getCardWidth();
    const cardHeight = calculateCardHeight(cardWidth);
    const horizontalMargin = getCardHorizontalMargin(cardWidth);

    return {
      width: cardWidth,
      height: cardHeight,
      horizontalMargin,
    };
  }, [width, height, isTablet]);

  const swipeX = useRef(new Animated.Value(0)).current;
  const CARD_WIDTH = cardDimensions.width;
  const CARD_HEIGHT = cardDimensions.height;
  const CARD_HORIZONTAL_MARGIN = cardDimensions.horizontalMargin;
  const CARD_ASPECT_RATIO = RESPONSIVE_CONSTANTS.CARD.ASPECT_RATIO;

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userId, setUserId] = useState(null);
  const animatedValuesById = useRef({});
  const flippedByIdRef = useRef({});
  const [leftCount, setLeftCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [initialLearnedCount, setInitialLearnedCount] = useState(0);
  const [leftHighlight, setLeftHighlight] = useState(false);
  const [rightHighlight, setRightHighlight] = useState(false);
  const swiperRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [undoDisabled, setUndoDisabled] = useState(false);
  const [historyDirections, setHistoryDirections] = useState([]);
  const [totalSwipeCount, setTotalSwipeCount] = useState(0);
  const [totalCardCount, setTotalCardCount] = useState(0);
  const [remainingCardCount, setRemainingCardCount] = useState(0);
  const [totalLearningCount, setTotalLearningCount] = useState(0);
  const [currentLearnedCount, setCurrentLearnedCount] = useState(null);
  const [currentLearningCount, setCurrentLearningCount] = useState(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayTimeout = useRef(null);
  const autoPlayFlipTimeout = useRef(null);
  const currentIndexRef = useRef(0);
  const cardsLengthRef = useRef(0);
  const [pendingReinserts, setPendingReinserts] = useState([]); // { card, insertAt }[]
  const leftCountedCardIds = useRef(new Set()); // Sola veya butonla bir kez sayılmış kartlar; reinsert sonrası tekrar sayılmasın
  const historyLeftCardIds = useRef([]); // Undo için: son left kaydın card_id
  const { t } = useTranslation();
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [categorySortOrder, setCategorySortOrder] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportModalAlreadyCodes, setReportModalAlreadyCodes] = useState([]);
  const [reportCardId, setReportCardId] = useState(null);
  const { showSuccess, showError } = useSnackbarHelpers();
  const isOwner = userId && deck?.user_id === userId;

  const BATCH_SIZE = 30;
  const PROGRESS_FLUSH_SIZE = 5;
  const PRE_FETCH_THRESHOLD = 10;
  const pendingProgressRef = useRef({});
  const swipesSinceFlushRef = useRef(0);
  const seenCardIdsRef = useRef(new Set());
  const isFetchingMoreRef = useRef(false);
  const hasMoreCardsRef = useRef(true);

  const openReportCardModal = useCallback(async () => {
    if (!userId || !cards[currentIndex]) return;
    const currentCard = cards[currentIndex];
    try {
      const codes = await BlockService.getMyReportReasonCodesForTarget(userId, 'card', currentCard.card_id);
      setReportModalAlreadyCodes(codes || []);
      setReportCardId(currentCard.card_id);
      setReportModalVisible(true);
    } catch (e) {
      showError(t('moderation.alreadyReported', 'Zaten şikayet ettiniz') || e?.message);
    }
  }, [userId, cards, currentIndex, t, showError]);

  const handleReportModalSubmit = useCallback(async (reasonCode, reasonText) => {
    if (!userId || !reportCardId) return;
    try {
      await BlockService.reportCard(userId, reportCardId, reasonCode, reasonText);
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
  }, [userId, reportCardId, t, showSuccess, showError]);

  // Header'a favori ve (deste sahibi değilse) şikayet butonunu ekle
  useEffect(() => {
    const currentCard = cards[currentIndex];
    const isCurrentCardFavorite = currentCard ? favoriteIds.has(currentCard.card_id) : false;

    navigation.setOptions({
      headerRight: () => {
        if (loading || !currentCard) return null;
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('medium');
                toggleFavorite(currentCard.card_id);
              }}
              style={{ marginRight: scale(8) }}
              hitSlop={{ top: scale(8), right: scale(8), bottom: scale(8), left: scale(8) }}
            >
              <Iconify
                icon={isCurrentCardFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={moderateScale(26)}
                color={isCurrentCardFavorite ? colors.buttonColor : colors.text}
              />
            </TouchableOpacity>
            {!isOwner && (
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  openReportCardModal();
                }}
                style={{ paddingHorizontal: scale(6) }}
                activeOpacity={0.7}
              >
                <Iconify icon="ic:round-report-problem" size={moderateScale(24)} color='#FED7AA' />
              </TouchableOpacity>
            )}
          </View>
        );
      },
    });
  }, [navigation, cards, currentIndex, favoriteIds, colors.buttonColor, colors.text, toggleFavorite, loading, isOwner, openReportCardModal]);

  // Kategoriye göre renkleri al (Supabase sort_order kullanarak)
  const getCategoryColors = (sortOrder) => {
    if (colors.categoryColors && colors.categoryColors[sortOrder]) {
      return colors.categoryColors[sortOrder];
    }
    // Varsayılan renkler (Tarih kategorisi - sort_order: 4)
    return ['#A88D6B', '#7A5F3A'];
  };

  // Sayaç kutuları için renkler
  const leftInactiveColor = '#f3a14c'; // Bir tık daha koyu turuncu
  const leftActiveColor = colors.buttonColor; // Tema turuncusu
  const rightInactiveColor = '#6faa72'; // Bir tık daha koyu yeşil
  const rightActiveColor = '#3e8e41'; // Bir tık daha koyu aktif renk


  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);
      setRightCount(0);
      setLeftCount(0);
      pendingProgressRef.current = {};
      swipesSinceFlushRef.current = 0;
      seenCardIdsRef.current = new Set();
      hasMoreCardsRef.current = true;

      try {
        setUserId(authUserId);
        // Swipe modunda:
        // - chapter === undefined -> Tüm kartlar (chapter filtresi yok)
        // - chapter === null      -> Sadece atanmamış kartlar
        // - chapter.id            -> Belirli bölüm
        const chapterId = typeof chapter === 'undefined'
          ? null // getCardsToLearn için "tümü" senaryosunda chapter_id parametresi null gidiyor
          : (chapter === null ? null : chapter.id);
        const unassignedOnly = chapter === null;

        const [deckData, favCardIds, rpcCards] = await Promise.all([
          getDeckById(deck.id),
          getFavoriteCardIds(authUserId),
          getCardsToLearn(deck.id, authUserId, chapterId, unassignedOnly, BATCH_SIZE, 0),
        ]);

        if (deckData?.categories?.sort_order != null) {
          setCategorySortOrder(deckData.categories.sort_order);
        }

        setFavoriteIds(new Set(favCardIds || []));

        const learningCards = rpcCards.map(card => ({
          card_id: card.card_id,
          status: card.status || 'new',
          next_review: card.next_review || new Date().toISOString(),
          cards: {
            id: card.card_id,
            question: card.question,
            answer: card.answer,
            image: card.image,
            example: card.example,
            note: card.note,
            chapter_id: card.chapter_id,
          }
        }));

        setCards(learningCards);
        seenCardIdsRef.current = new Set(learningCards.map(c => c.card_id));
        flippedByIdRef.current = {};

        const statsChapterId =
          typeof chapter === 'undefined'
            ? undefined
            : (chapter === null ? null : chapter.id);

        const progressCounts = await getChapterProgressCounts(authUserId, deck.id, statsChapterId);
        const totalCardsCount = progressCounts.total;
        const learningCount = progressCounts.learning;
        const learnedCount = progressCounts.learned;

        setTotalCardCount(totalCardsCount);
        setTotalLearningCount(learningCount);
        setInitialLearnedCount(learnedCount);
        setRemainingCardCount(totalCardsCount - learnedCount);

      } catch (error) {
        console.error("Swipe sayfasında veri çekme hatası:", error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, [deck.id, chapter?.id]);

  // SwipeDeck'ten çıkıldığında progress cache'lerini invalidate et (DeckDetail/Chapters güncel sayı görsün)
  useEffect(() => {
    return () => {
      if (deck?.id && authUserId) {
        invalidateCache(`progress_deck_${deck.id}_${authUserId}`);
        invalidateCache(`progress_chapters_${deck.id}_${authUserId}`);
      }
    };
  }, [deck?.id, authUserId]);

  useEffect(() => {
    if (loading || currentIndex === 0) return;
    const remaining = cards.length - currentIndex;
    if (remaining > 0 && remaining <= PRE_FETCH_THRESHOLD && hasMoreCardsRef.current) {
      fetchMoreCards();
    }
  }, [currentIndex, cards.length, loading, fetchMoreCards]);

  useEffect(() => {
    let flushed = false;
    const handleExit = async () => {
      if (flushed) return;
      flushed = true;
      const pending = Object.values(pendingProgressRef.current);
      if (pending.length > 0) {
        pendingProgressRef.current = {};
        swipesSinceFlushRef.current = 0;
        try {
          await batchUpsertProgress(pending);
        } catch (err) {
          console.error('Failed to flush on exit:', err);
        }
      }
      if (authUserId && deck?.id) {
        await Promise.all([
          invalidateCache(`progress_deck_${deck.id}`),
          invalidateCache(`progress_chapters_${deck.id}`),
        ]);
      }
    };
    const unsubscribe = navigation.addListener('blur', handleExit);
    return () => {
      unsubscribe();
      handleExit();
    };
  }, [navigation, authUserId, deck?.id]);

  const leftScale = useSharedValue(1);
  const rightScale = useSharedValue(1);

  useEffect(() => {
    if (leftCount > 0) {
      leftScale.value = withSequence(withSpring(1.05), withSpring(1));
    }
  }, [leftCount]);

  useEffect(() => {
    if (rightCount > 0) {
      rightScale.value = withSequence(withSpring(1.05), withSpring(1));
    }
  }, [rightCount]);

  const animatedLeftBadge = useAnimatedStyle(() => ({ transform: [{ scale: leftScale.value }] }));
  const animatedRightBadge = useAnimatedStyle(() => ({ transform: [{ scale: rightScale.value }] }));

  currentIndexRef.current = currentIndex;
  cardsLengthRef.current = cards.length;

  const currentProgress = totalCardCount > 0
    ? ((leftCount + initialLearnedCount + rightCount) / totalCardCount) * 100
    : 0;

  // Reanimated stili
  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      // currentProgress değiştiğinde genişlik 300ms içinde yumuşakça değişir
      width: withTiming(`${currentProgress}%`, { duration: 300 }),
    };
  });

  const shimmerTranslate = useSharedValue(-1); // -1 (en sol) ile 2 (en sağ) arası

  useEffect(() => {
    shimmerTranslate.value = withRepeat(
      withTiming(2, { duration: 2000 }), // 2 saniyede barı boydan boya geçer
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => {
    return {
      // left değerini barın genişliğine göre (yüzdesel) oranlıyoruz
      left: `${shimmerTranslate.value * 100}%`,
    };
  });

  // next_review (2 dk) geçen kartları kuyruğa rastgele ekle
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentIndexRef.current >= cardsLengthRef.current) {
        setPendingReinserts([]);
        return;
      }
      const now = Date.now();
      setPendingReinserts((prev) => {
        const due = prev.filter((p) => p.insertAt <= now);
        if (due.length === 0) return prev;
        const stillPending = prev.filter((p) => p.insertAt > now);
        setCards((prevCards) => {
          let nextCards = prevCards;
          const idx = Math.min(currentIndexRef.current, nextCards.length - 1);
          const tailStart = idx + 1;
          for (const { card } of due) {
            const rest = nextCards.slice(tailStart);
            const randomPos = Math.floor(Math.random() * (rest.length + 1));
            const newRest = [...rest.slice(0, randomPos), card, ...rest.slice(randomPos)];
            nextCards = [...nextCards.slice(0, tailStart), ...newRest];
          }
          return nextCards;
        });
        return stillPending;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const getAnimatedValueForCardId = useCallback((cardId) => {
    if (!cardId) return null;
    if (!animatedValuesById.current[cardId]) {
      animatedValuesById.current[cardId] = new Animated.Value(0);
    }
    return animatedValuesById.current[cardId];
  }, []);

  const resetFlipForCardId = useCallback((cardId) => {
    if (!cardId) return;
    flippedByIdRef.current[cardId] = false;
    const v = getAnimatedValueForCardId(cardId);
    if (v) v.setValue(0);
  }, [getAnimatedValueForCardId]);

  const flushProgress = useCallback(async () => {
    const pending = { ...pendingProgressRef.current };
    const items = Object.values(pending);
    if (items.length === 0) return;
    pendingProgressRef.current = {};
    swipesSinceFlushRef.current = 0;
    try {
      await batchUpsertProgress(items);
    } catch (error) {
      Object.entries(pending).forEach(([key, val]) => {
        if (!pendingProgressRef.current[key]) {
          pendingProgressRef.current[key] = val;
        }
      });
      console.error('Failed to flush progress:', error);
    }
  }, []);

  const queueProgress = useCallback((cardId, status, nextReview) => {
    if (!userId) return;
    pendingProgressRef.current[cardId] = {
      user_id: userId,
      card_id: cardId,
      status,
      next_review: nextReview,
    };
    swipesSinceFlushRef.current += 1;
    if (swipesSinceFlushRef.current >= PROGRESS_FLUSH_SIZE) {
      flushProgress();
    }
  }, [userId, flushProgress]);

  const fetchMoreCards = useCallback(async () => {
    if (isFetchingMoreRef.current || !userId || !hasMoreCardsRef.current) return;
    isFetchingMoreRef.current = true;
    try {
      await flushProgress();
      const chapterId = chapter?.id || null;
      const unassignedOnly = chapter === null;
      const moreCards = await getCardsToLearn(deck.id, userId, chapterId, unassignedOnly, BATCH_SIZE, 0);

      const newCards = moreCards
        .filter(c => !seenCardIdsRef.current.has(c.card_id))
        .map(card => ({
          card_id: card.card_id,
          status: card.status || 'new',
          next_review: card.next_review || new Date().toISOString(),
          cards: {
            id: card.card_id,
            question: card.question,
            answer: card.answer,
            image: card.image,
            example: card.example,
            note: card.note,
            chapter_id: card.chapter_id,
          }
        }));
      if (newCards.length > 0) {
        newCards.forEach(c => seenCardIdsRef.current.add(c.card_id));
        setCards(prev => [...prev, ...newCards]);
      } else {
        hasMoreCardsRef.current = false;
      }
    } catch (error) {
      console.error('Error fetching more cards:', error);
    } finally {
      isFetchingMoreRef.current = false;
    }
  }, [userId, deck.id, chapter, flushProgress]);

  const handleSwipe = useCallback(async (cardIndex, direction) => {
    if (!cards[cardIndex]) return;
    const card = cards[cardIndex];
    resetFlipForCardId(card.card_id);
    if (!userId) return;
    setHistory((prev) => [...prev, cardIndex]);
    setHistoryDirections((prev) => [...prev, direction]);
    setTotalSwipeCount((prev) => prev + 1);
    if (direction === 'right') {
      setRightCount((prev) => prev + 1);
      setRightHighlight(true);
      setTimeout(() => setRightHighlight(false), 400);
      const now = new Date().toISOString();
      queueProgress(card.card_id, 'learned', now);
    } else if (direction === 'left') {
      historyLeftCardIds.current.push(card.card_id);
      if (!leftCountedCardIds.current.has(card.card_id)) {
        leftCountedCardIds.current.add(card.card_id);
        setLeftCount((prev) => prev + 1);
      }
      setLeftHighlight(true);
      setTimeout(() => setLeftHighlight(false), 400);
      const insertAt = Date.now() + 2 * 60 * 1000;
      const nextReview = new Date(insertAt).toISOString();
      queueProgress(card.card_id, 'learning', nextReview);
      setPendingReinserts((prev) => [...prev, { card, insertAt }]);
    }
    setCurrentIndex(cardIndex + 1);
  }, [cards, userId, resetFlipForCardId, queueProgress]);

  const handleFlipById = useCallback((cardId) => {
    if (!cardId) return;
    const current = !!flippedByIdRef.current[cardId];
    const next = !current;
    flippedByIdRef.current[cardId] = next;

    const v = getAnimatedValueForCardId(cardId);
    if (!v) return;

    Animated.timing(v, {
      toValue: next ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [getAnimatedValueForCardId]);

  const handleSkip = async (minutes) => {
    if (!cards[currentIndex]) return;
    const card = cards[currentIndex];
    if (!userId) return;
    setTotalSwipeCount((prev) => prev + 1);
    const nextReviewIso = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    queueProgress(card.card_id, 'learning', nextReviewIso);
    setHistory((prev) => [...prev, currentIndex]);
    setHistoryDirections((prev) => [...prev, 'left']);
    if (swiperRef.current) {
      swiperRef.current.swipeLeft();
    }
  };

  const handleUndo = () => {
    if (undoDisabled) return;
    setUndoDisabled(true);
    setTimeout(() => setUndoDisabled(false), 1000);
    if (swiperRef.current && history.length > 0) {
      const lastIndex = history[history.length - 1];
      const undoneCard = cards[lastIndex];
      if (undoneCard) {
        delete pendingProgressRef.current[undoneCard.card_id];
      }
      swiperRef.current.swipeBack();
      setCurrentIndex(lastIndex);
      setHistory((prev) => prev.slice(0, -1));
      setHistoryDirections((prev) => {
        if (prev.length === 0) return prev;
        const lastDirection = prev[prev.length - 1];
        if (lastDirection === 'right') {
          setRightCount((c) => Math.max(0, c - 1));
        } else if (lastDirection === 'left') {
          const removedCardId = historyLeftCardIds.current.pop();
          if (removedCardId) leftCountedCardIds.current.delete(removedCardId);
          setLeftCount((c) => Math.max(0, c - 1));
        }
        setTotalSwipeCount((c) => Math.max(0, c - 1));
        return prev.slice(0, -1);
      });
    }
  };

  const toggleFavorite = useCallback(async (cardId) => {
    if (!userId) return;
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
    try {
      if (favoriteIds.has(cardId)) {
        await removeFavoriteCard(userId, cardId);
      } else {
        await addFavoriteCard(userId, cardId);
      }
    } catch (e) {
      // Hata olursa UI'ı geri al
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(cardId)) {
          next.delete(cardId);
        } else {
          next.add(cardId);
        }
        return next;
      });
    }
  }, [userId, favoriteIds]);

  // Auto play fonksiyonu
  useEffect(() => {
    if (!autoPlay) return;
    if (currentIndex >= cards.length) {
      setAutoPlay(false);
      return;
    }


    // Önce kartın ön yüzünü göster (2000ms)
    // Sonra flip yap
    autoPlayFlipTimeout.current = setTimeout(() => {
      const cardId = cards[currentIndex]?.card_id;
      if (cardId) handleFlipById(cardId);
      // Flip sonrası arka yüzü göster (2000ms), sonra swipe yap
      autoPlayTimeout.current = setTimeout(() => {
        if (swiperRef.current) {
          swiperRef.current.swipeLeft();
        }
      }, 1600); // arka yüzü gösterme süresi
    }, 1600); // ön yüzü gösterme süresi

    return () => {
      if (autoPlayTimeout.current) clearTimeout(autoPlayTimeout.current);
      if (autoPlayFlipTimeout.current) clearTimeout(autoPlayFlipTimeout.current);
    };
  }, [autoPlay, currentIndex, cards, handleFlipById]);

  // Auto play durdurucu (kartlar bittiğinde veya ekran değişirse)
  useEffect(() => {
    return () => {
      if (autoPlayTimeout.current) clearTimeout(autoPlayTimeout.current);
      if (autoPlayFlipTimeout.current) clearTimeout(autoPlayFlipTimeout.current);
    };
  }, []);

  useEffect(() => {
    const fetchCurrentStats = async () => {
      if ((cards.length === 0 || currentIndex >= cards.length) && userId && deck?.id) {
        try {
          await flushProgress();

          const statsChapterId =
            typeof chapter === 'undefined'
              ? undefined
              : (chapter === null ? null : chapter.id);
          const { learned, learning } = await getChapterProgressCounts(userId, deck.id, statsChapterId);

          setCurrentLearnedCount(learned || 0);
          setCurrentLearningCount(learning || 0);
        } catch (error) {
          console.error('Error fetching current stats:', error);
        }
      }
    };

    fetchCurrentStats();
  }, [cards.length, currentIndex, userId, deck?.id, chapter?.id, flushProgress]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContent}>
          <LottieView
            source={require('../../assets/cards.json')}
            autoPlay
            loop
            speed={1.5}
            style={styles.loadingAnimation}
          />
          <Text style={[styles.loadingText, { color: colors.text }]}>{t('swipeDeck.loading', "Kartlar Yükleniyor")}</Text>
        </View>
      </View>
    );
  }

  if (cards.length === 0 || currentIndex >= cards.length) {
    // Kullanıcıya ait güncel sayılar (veritabanından çekilen)
    // Learned: useEffect'ten gelen güncel sayı, yoksa başlangıç + bu oturumda öğrenilenler
    const learnedCount = currentLearnedCount !== null
      ? currentLearnedCount
      : (initialLearnedCount + rightCount);
    // Learning: useEffect'ten gelen güncel sayı, yoksa totalLearningCount (fetchCards'tan gelen)
    const learningCount = currentLearningCount !== null
      ? currentLearningCount
      : totalLearningCount;
    const progress = learnedCount;

    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ width: '100%', alignItems: 'center', marginTop: verticalScale(60) }}>
          <Image source={home_logo} style={{ width: scale(260), height: scale(260), resizeMode: 'cover' }} />
          <Text style={[typography.styles.h2, { color: colors.text, textAlign: 'center', marginTop: verticalScale(16), paddingHorizontal: scale(32) }]}>
            {progress === totalCardCount ? t('swipeDeck.bravo', "Bravo! Tüm Kartları Tamamladın") : t('swipeDeck.learnTime', "Kalan Kartları Öğrenmeye Vakit Var")}
          </Text>
          <View style={{ width: scale(72), height: verticalScale(1), backgroundColor: colors.orWhite, borderRadius: moderateScale(2), alignSelf: 'center', marginTop: verticalScale(16), marginBottom: verticalScale(32) }} />

          {/* İstatistik Kartları */}
          <View style={styles.statsContainer}>
            {/* Learning Kartlar */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: '#f3a14c' }]}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(243, 161, 76, 0.1)' }]}>
                <Iconify icon="mingcute:time-fill" size={moderateScale(24)} color="#f3a14c" />
              </View>
              <Text style={[styles.statNumber, { color: colors.text }]}>{learningCount}</Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>{t('swipeDeck.learning', 'Öğreniliyor')}</Text>
            </View>

            {/* Learned Kartlar */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: '#3e8e41' }]}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(62, 142, 65, 0.1)' }]}>
                <Iconify icon="streamline:check-solid" size={moderateScale(20)} color="#3e8e41" />
              </View>
              <Text style={[styles.statNumber, { color: colors.text }]}>{learnedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>{t('swipeDeck.learned', 'Öğrenildi')}</Text>
            </View>

            {/* Toplam kaydırma */}

            <View style={[styles.statCardWide, { backgroundColor: colors.cardBackground, borderColor: colors.border || '#6b7b8c' }]}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(107, 123, 140, 0.15)', width: scale(36), height: scale(36), marginBottom: '0' }]}>
                <Iconify icon="fluent:arrow-repeat-all-48-regular" size={moderateScale(20)} color={colors.text || '#6b7b8c'} />
              </View>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>{t('swipeDeck.totalSwipes', 'Toplam kaydırma')}:</Text>
              <Text style={[styles.statNumber, { color: colors.text, fontSize: moderateScale(24) }]}>{totalSwipeCount}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Sayaçlar */}
        <View style={styles.counterRow}>
          <Reanimated.View
            // layout={LinearTransition.springify()} yerine bunu yazıyoruz:
            layout={LinearTransition.duration(100)}
            style={[
              styles.counterBoxLeft,
              { backgroundColor: leftHighlight ? leftActiveColor : leftInactiveColor },
              animatedLeftBadge
            ]}
          >
            {leftHighlight ? (
              <Reanimated.View key="icon-l" entering={FadeIn.duration(50)} exiting={null}>
                <Iconify icon="mingcute:time-fill" size={moderateScale(18)} color="#fff" />
              </Reanimated.View>
            ) : (
              <Reanimated.View key="text-l" entering={FadeIn.duration(250)} exiting={null}>
                <Text style={styles.counterText}>{leftCount}</Text>
              </Reanimated.View>
            )}
          </Reanimated.View>
          <View style={[styles.deckProgressBox, { flexDirection: 'row' }]}>
            {(() => {
              const uniqueCardIdsUpToNow = new Set(
                cards.slice(0, currentIndex + 1).map((c) => c?.card_id).filter(Boolean)
              );
              const currentCardNumber = uniqueCardIdsUpToNow.size;
              const allUniqueSeen = currentCardNumber >= totalCardCount;
              const currentCardIsReinserted = cards[currentIndex] && leftCountedCardIds.current.has(cards[currentIndex].card_id);
              const hasReinsertToShow =
                pendingReinserts.length > 0 ||
                cards.slice(currentIndex + 1).some((c) => c?.card_id && leftCountedCardIds.current.has(c.card_id));
              const showVaktiGeldi =
                totalCardCount > 0 && allUniqueSeen && hasReinsertToShow && currentCardIsReinserted;
              const iconWrapStyle = {
                borderRadius: moderateScale(10),
                padding: scale(6),
                backgroundColor: colors.cardBackground || 'rgba(128,128,128,0.15)',
                marginRight: scale(10),
              };
              if (showVaktiGeldi) {
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={iconWrapStyle}>
                      <Iconify icon="fluent:arrow-repeat-all-48-regular" size={moderateScale(22)} color={colors.text} />
                    </View>
                    <Text style={[styles.deckProgressText, { color: colors.text }]}>{t('swipeDeck.vaktiGeldi', 'Vakti Geldi')}</Text>
                  </View>
                );
              }
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {currentCardIsReinserted && (
                    <View style={iconWrapStyle}>
                      <Iconify icon="fluent:arrow-repeat-all-48-regular" size={moderateScale(18)} color={colors.text} />
                    </View>
                  )}
                  <Text style={[styles.deckProgressText, { color: colors.text }]}>{currentCardNumber}/{totalCardCount - initialLearnedCount}</Text>
                </View>
              );
            })()}
          </View>
          <Reanimated.View
            layout={LinearTransition.duration(100)}
            style={[
              styles.counterBoxRight,
              { backgroundColor: rightHighlight ? rightActiveColor : rightInactiveColor },
              animatedRightBadge
            ]}
          >
            {rightHighlight ? (
              <Reanimated.View key="icon-r" entering={FadeIn.duration(50)} exiting={null}>
                <Iconify icon="streamline:check-solid" size={moderateScale(16)} color="#fff" />
              </Reanimated.View>
            ) : (
              <Reanimated.View key="text-r" entering={FadeIn.duration(250)} exiting={null}>
                <Text style={styles.counterText}>{rightCount}</Text>
              </Reanimated.View>
            )}
          </Reanimated.View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: verticalScale(15) }}>
          <Swiper
            ref={swiperRef}
            cards={cards}
            cardIndex={currentIndex}
            renderCard={(card, i) => {
              const cardId = card?.card_id;
              const animatedValue = cardId ? getAnimatedValueForCardId(cardId) : null;
              const gradientColors = getCategoryColors(categorySortOrder);
              const isPlaceholder = !card || !card.cards || i > currentIndex;
              return (
                <SwipeFlipCard
                  key={cardId || `placeholder-${i}`}
                  card={card}
                  cardId={cardId}
                  isPlaceholder={isPlaceholder}
                  cardWidth={CARD_WIDTH}
                  cardHeight={CARD_HEIGHT}
                  gradientColors={gradientColors}
                  cardBackground={colors.cardBackground}
                  textColor={colors.text}
                  animatedValue={animatedValue}
                  onFlip={handleFlipById}
                  swipeX={swipeX}
                />
              );
            }}
            onSwiping={(x) => {
              swipeX.setValue(x);
            }}
            onSwipedAborted={() => {
              Animated.spring(swipeX, {
                toValue: 0,
                useNativeDriver: true,
              }).start();
            }}
            onSwipedLeft={(i) => {
              triggerHaptic('selection');
              handleSwipe(i, 'left');
              setCurrentIndex(i + 1);
              swipeX.setValue(0);
            }}
            onSwipedRight={(i) => {
              triggerHaptic('light');
              handleSwipe(i, 'right');
              setCurrentIndex(i + 1);
              swipeX.setValue(0);
            }}
            onSwipedTop={(i) => {
              if (swiperRef.current) {
                swiperRef.current.swipeBack();
              }
              swipeX.setValue(0);
            }}
            disableTopSwipe={true}
            disableBottomSwipe={true}
            stackSize={2}
            showSecondCard={false}
            swipeBackCard={true}
            backgroundColor={colors.background}
            stackSeparation={verticalScale(18)}
            stackScale={0.07}
            cardHorizontalMargin={CARD_HORIZONTAL_MARGIN}
            containerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            cardStyle={{ width: CARD_WIDTH, height: CARD_HEIGHT, alignSelf: 'center', justifyContent: 'center' }}
            stackAnimationFriction={100}
            stackAnimationTension={100}
            swipeAnimationDuration={600}
          />
        </View>
        {/* Yatay birleşik butonlar */}
        {/* Yatay birleşik butonlar */}
        <View style={[styles.horizontalButtonRow, { backgroundColor: colors.buttonColor }]}>

          <AnimatedTimeButton
            onPress={() => handleSkip(15)}
            icon="material-symbols:repeat-rounded"
            text={t('swipeDeck.minutes', "15 dk")}
            buttonStyle={[styles.horizontalButton, { borderRightWidth: moderateScale(1), borderRightColor: '#e0e0e0' }]}
            textStyle={styles.horizontalButtonText}
            iconColor={colors.buttonText}
          />

          <AnimatedTimeButton
            onPress={() => handleSkip(60)}
            icon="mingcute:time-line"
            text={t('swipeDeck.hours', "1 sa")}
            buttonStyle={[styles.horizontalButton, { borderRightWidth: moderateScale(1), borderRightColor: '#e0e0e0' }]}
            textStyle={styles.horizontalButtonText}
            iconColor={colors.buttonText}
          />

          <AnimatedTimeButton
            onPress={() => handleSkip(24 * 60)}
            icon="solar:calendar-broken"
            text={t('swipeDeck.days', "1 gün")}
            buttonStyle={[styles.horizontalButton, { borderRightWidth: moderateScale(1), borderRightColor: '#e0e0e0' }]}
            textStyle={styles.horizontalButtonText}
            iconColor={colors.buttonText}
          />

          <AnimatedTimeButton
            onPress={() => handleSkip(7 * 24 * 60)}
            icon="solar:star-broken"
            text={t('swipeDeck.sevenDays', "7 gün")}
            buttonStyle={styles.horizontalButton} // Son butonda sağ çizgi yok
            textStyle={styles.horizontalButtonText}
            iconColor={colors.buttonText}
          />

        </View>
        {/* Geri alma butonu */}
        <TouchableOpacity style={[styles.undoButton, undoDisabled && { opacity: 0.5 }]} onPress={handleUndo} disabled={undoDisabled}>
          <Iconify icon="lets-icons:refund-back" size={moderateScale(28)} color={colors.orWhite} />
        </TouchableOpacity>
        {/* Auto play butonu */}
        <TouchableOpacity
          style={styles.autoPlayButton}
          onPress={() => setAutoPlay((prev) => !prev)}
        >
          {autoPlay ? (
            <Iconify icon="material-symbols:pause-rounded" size={moderateScale(32)} color={colors.orWhite} />
          ) : (
            <Iconify icon="streamline:button-play-solid" size={moderateScale(20)} color={colors.orWhite} />
          )}
        </TouchableOpacity>
        {/* Progress Bar (undoButton'un hemen üstünde) */}
        <View style={[styles.progressBarContainer, { backgroundColor: colors.progressBarSwipe, overflow: 'hidden' }]}>
          {/* Ana Dolgu Barı */}
          <Reanimated.View
            style={[
              styles.progressBarFill,
              { backgroundColor: colors.buttonColor },
              animatedProgressStyle
            ]}
          >
            {/* Parlama Katmanı (Barın içinde hareket eder) */}
            <Reanimated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: '50%', // Barın yarısı kadar bir parlama alanı
                  backgroundColor: 'rgba(255, 255, 255, 0.3)', // Hafif beyaz parlama
                },
                shimmerStyle
              ]}
            />
          </Reanimated.View>
        </View>
      </SafeAreaView>
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
  container: {
    flex: 1,
  },
  card: {
    borderRadius: moderateScale(26),
    padding: scale(24),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: verticalScale(-10) },
    shadowOpacity: 5,
    shadowRadius: moderateScale(4),
  },
  imageContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(22),
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    borderRadius: moderateScale(24),

  },
  counterRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: scale(16),
    paddingBottom: verticalScale(100),
    height: verticalScale(36),
  },
  counterBoxLeft: {
    position: 'absolute',
    left: scale(-30),
    top: verticalScale(16),
    minWidth: scale(80),
    paddingLeft: scale(30),
    paddingRight: scale(12),
    paddingVertical: verticalScale(8),
    height: verticalScale(36),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(4),
    elevation: 2,
    borderTopRightRadius: moderateScale(18),
    borderBottomRightRadius: moderateScale(18),
  },
  counterBoxRight: {
    position: 'absolute',
    right: scale(-30),
    top: verticalScale(16),
    minWidth: scale(80),
    paddingLeft: scale(12),
    paddingRight: scale(30),
    paddingVertical: verticalScale(8),
    height: verticalScale(36),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(4),
    elevation: 2,
    borderTopLeftRadius: moderateScale(18),
    borderBottomLeftRadius: moderateScale(18),
  },
  counterText: {
    ...typography.styles.button,
    color: '#fff',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  horizontalButtonRow: {
    flexDirection: 'row',
    width: '93%',
    alignSelf: 'center',
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    backgroundColor: '#fff8f0',
    boxSizing: 'border-box',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(8),
    elevation: 4,
    marginBottom: verticalScale(105),
  },
  horizontalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(16),
    backgroundColor: 'transparent',
    borderRightWidth: 0,
    borderColor: '#e0e0e0',
  },
  horizontalButtonText: {
    ...typography.styles.button,
  },
  undoButton: {
    position: 'absolute',
    left: scale(24),
    bottom: verticalScale(24),
    width: scale(48),
    height: scale(48),

    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: moderateScale(6),
    elevation: 4,
    zIndex: 30,
  },
  deckProgressBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: verticalScale(16),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(8),
    height: verticalScale(36),
  },
  deckProgressText: {
    ...typography.styles.subtitle,
    fontWeight: '700',
  },
  progressBarContainer: {
    width: '91%',
    alignSelf: 'center',
    height: verticalScale(3),
    borderRadius: moderateScale(8),
    marginBottom: verticalScale(8),
    position: 'absolute',
    bottom: verticalScale(72),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: moderateScale(8),
    transition: 'width 0.3s',
  },
  autoPlayButton: {
    position: 'absolute',
    right: scale(24),
    bottom: verticalScale(24),
    width: scale(48),
    height: scale(48),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    borderRadius: moderateScale(24),
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    paddingTop: '35%',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  loadingContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingAnimation: {
    width: scale(300),
    height: scale(300),
  },
  loadingText: {
    ...typography.styles.subtitle,
    textAlign: 'center',
  },
  statsContainer: {
    width: '90%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scale(16),
    marginTop: verticalScale(8),
  },
  statCard: {
    width: '45%',
    alignItems: 'center',
    padding: scale(20),
    borderRadius: moderateScale(16),
    borderWidth: moderateScale(2),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(8),
    elevation: 3,
  },
  statCardWide: {
    width: '95%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(16),
    borderWidth: moderateScale(1),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(8),
    elevation: 3,
    flexDirection: 'row',
    gap: scale(10),
  },
  statIconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: verticalScale(12),
  },
  statNumber: {
    ...typography.styles.h2,
    fontSize: moderateScale(32),
    fontWeight: '700',
    marginBottom: verticalScale(4),
  },
  statLabel: {
    ...typography.styles.subtitle,
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
}); 