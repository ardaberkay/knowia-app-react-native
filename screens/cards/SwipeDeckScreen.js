import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Pressable, Platform, BackHandler, ScrollView } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  LinearTransition,
  FadeIn,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Swiper from 'react-native-deck-swiper';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import {
  getChapterProgressCounts,
  getTotalLearnedCardsCount,
  startSwipeSession,
  getSwipeSessionQueueCount,
  getSwipeSessionCompletionCounts,
  getChapterFutureReviewSummary,
  getSwipeSessionNextCards,
  recordSwipeSessionSwipe,
  undoLastSwipe,
  endSwipeSession,
} from '../../services/CardService';
import { getDeckById } from '../../services/DeckService';
import { invalidateCache, hasSeenSwipeTutorial, markSwipeTutorialSeen } from '../../services/CacheService';
import { listChapters, mergeChapterProgressIntoCache } from '../../services/ChapterService';
import { useAuth } from '../../contexts/AuthContext';
import { Iconify } from 'react-native-iconify';
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
import { maybePromptForReview, getReviewMilestones } from '../../services/ReviewPromptService';

// Eğer henüz yoksa AnimatedPressable'ı oluştur (önceki sayfalardaki gibi)
const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);
const learnedRuntimeState = {
  userId: null,
  baseLearned: 0,
  deltaLearned: 0,
  lastSyncedAt: 0,
};

const formatFutureReview = (dateString, t) => {
  const minutes = Math.max(1, Math.ceil((new Date(dateString).getTime() - Date.now()) / 60000));
  if (minutes < 60) return t('swipeDeck.completion.minutesFromNow', { count: minutes, defaultValue: `${minutes} dk sonra` });
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return t('swipeDeck.completion.hoursFromNow', { count: hours, defaultValue: `${hours} sa sonra` });
  return t('swipeDeck.completion.daysFromNow', { count: Math.ceil(hours / 24), defaultValue: `${Math.ceil(hours / 24)} gün sonra` });
};

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
  const insets = useSafeAreaInsets();
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
  const currentIndexRef = useRef(0);

  const activeCards = useMemo(
    () => (cards ?? []).slice(currentIndex),
    [cards, currentIndex]
  );
  const activeCardId = activeCards[0]?.card_id;

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const [userId, setUserId] = useState(null);
  const animatedValuesById = useRef({});
  const flippedByIdRef = useRef({});
  const [leftCount, setLeftCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [leftHighlight, setLeftHighlight] = useState(false);
  const [rightHighlight, setRightHighlight] = useState(false);
  const swiperRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [undoDisabled, setUndoDisabled] = useState(false);
  const [historyDirections, setHistoryDirections] = useState([]);
  const [totalSwipeCount, setTotalSwipeCount] = useState(0);
  const [sessionTargetCount, setSessionTargetCount] = useState(0);
  const [completionSummary, setCompletionSummary] = useState(null);
  const [nextChapter, setNextChapter] = useState(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayTimeout = useRef(null);
  const autoPlayFlipTimeout = useRef(null);
  const leftCountedCardIds = useRef(new Set()); // Sola veya butonla bir kez sayılmış kartlar; reinsert sonrası tekrar sayılmasın
  const historyLeftCardIds = useRef([]); // Undo için: son left kaydın card_id
  const sessionIdRef = useRef(null);
  const paginationCursorRef = useRef({
    afterSortKey: null,
    afterQueueId: null,
  });
  const currentPositionCursorRef = useRef({
    currentSortKey: null,
    currentQueueId: null,
  });
  const programmaticSwipeRef = useRef(null);
  const tutorialOverlayRootRef = useRef(null);
  const cardTutorialTargetRef = useRef(null);
  const intervalTutorialTargetRef = useRef(null);
  const { t } = useTranslation();
  const [showSwipeTutorial, setShowSwipeTutorial] = useState(false);
  const [swipeTutorialStep, setSwipeTutorialStep] = useState(0);
  const [firstRenderedCardId, setFirstRenderedCardId] = useState(null);
  const [cardTargetLayout, setCardTargetLayout] = useState(null);
  const [intervalTargetLayout, setIntervalTargetLayout] = useState(null);
  const hasCheckedSwipeTutorialRef = useRef(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [categorySortOrder, setCategorySortOrder] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportModalAlreadyCodes, setReportModalAlreadyCodes] = useState([]);
  const [reportCardId, setReportCardId] = useState(null);
  const { showSuccess, showError } = useSnackbarHelpers();
  const isOwner = userId && deck?.user_id === userId;
  const isAnimatingRef = useRef(false);
  const SESSION_BATCH_LIMIT = 20;
  const SWIPE_ANIMATION_MS = 500;
  const REVIEW_PROMPT_DELAY_MS = 600;
  const PRE_FETCH_THRESHOLD = 5;
  const seenCardIdsRef = useRef(new Set());
  const sessionSeenCardIdsRef = useRef(new Set());
  const [sessionProgressCount, setSessionProgressCount] = useState(0);
  const isFetchingMoreRef = useRef(false);
  const lastDueCheckAtRef = useRef(Date.now());
  const isDueCheckingRef = useRef(false);
  const hasMoreCardsRef = useRef(true);
  const reviewMilestonesRef = useRef(getReviewMilestones());
  const estimatedTotalLearnedRef = useRef(0);
  const reviewCheckInFlightRef = useRef(false);
  const reviewPromptTimeoutRef = useRef(null);
  const hasInitializedGlobalLearnedRef = useRef(false);
  const lastTriggeredMilestoneRef = useRef(null);

  const swipeTutorialSteps = useMemo(() => ([
    {
      title: t('swipeDeck.tutorial.flipTitle', 'Kartı çevir'),
      description: t('swipeDeck.tutorial.flipDescription', 'Cevabı tahmin ettikten sonra karta dokunarak arka yüzünü görebilirsin.'),
      target: 'card',
      icon: 'fluent:card-ui-portrait-flip-24-regular',
    },
    {
      title: t('swipeDeck.tutorial.swipeTitle', 'Kaydırarak öğren'),
      description: t('swipeDeck.tutorial.swipeDescription', 'Tamamen öğrendiğin kartları sağa kaydır. Sık tekrar etmek istediklerini sola kaydır.'),
      target: 'card',
      showSwipeHint: true,
      icon: 'carbon:ibm-event-automation',
    },
    {
      title: t('swipeDeck.tutorial.intervalTitle', 'Tekrar zamanını seç'),
      description: t('swipeDeck.tutorial.intervalDescription', 'Kartı ne kadar iyi bildiğine göre tekrar süresini seç. 15 dakika, 1 saat, 1 gün veya 7 gün sonra yeniden karşına çıksın. Öğrendikçe kartı daha seyrek görmen yeterli olacaktır.'),
      target: 'interval',
      icon: 'hugeicons:chat-delay-01',
    },
  ]), [t]);

  const activeTutorialStep = swipeTutorialSteps[swipeTutorialStep] || swipeTutorialSteps[0];

  const measureTutorialTarget = useCallback((ref, setter) => {
    requestAnimationFrame(() => {
      if (!ref.current || !tutorialOverlayRootRef.current) return;
      tutorialOverlayRootRef.current.measureInWindow((rootX, rootY, rootWidth, rootHeight) => {
        if (!rootWidth || !rootHeight) return;
        ref.current?.measureInWindow?.((x, y, measuredWidth, measuredHeight) => {
          if (!measuredWidth || !measuredHeight) return;
          setter({
            x: x - rootX,
            y: y - rootY,
            width: measuredWidth,
            height: measuredHeight,
          });
        });
      });
    });
  }, []);

  const completeSwipeTutorial = useCallback(async () => {
    setShowSwipeTutorial(false);
    await markSwipeTutorialSeen();
  }, []);

  useEffect(() => {
    if (activeCardId && firstRenderedCardId === activeCardId) {
      measureTutorialTarget(cardTutorialTargetRef, setCardTargetLayout);
    }
  }, [activeCardId, firstRenderedCardId, width, height, measureTutorialTarget]);

  useEffect(() => {
    if (activeCards.length > 0) {
      measureTutorialTarget(intervalTutorialTargetRef, setIntervalTargetLayout);
    }
  }, [activeCards.length, width, height, insets.bottom, measureTutorialTarget]);

  useEffect(() => {
    const hasWorkableCard = activeCards.length > 0 && Boolean(activeCardId);
    const hasRenderedActiveCard = Boolean(activeCardId) && firstRenderedCardId === activeCardId;
    const isEmptyOrCompletionState = cards.length === 0 || currentIndex >= cards.length || originalFlowComplete;
    if (
      hasCheckedSwipeTutorialRef.current ||
      loading ||
      !hasWorkableCard ||
      !hasRenderedActiveCard ||
      isEmptyOrCompletionState
    ) return;
    hasCheckedSwipeTutorialRef.current = true;

    let isMounted = true;
    const loadSwipeTutorialState = async () => {
      const hasSeenTutorial = await hasSeenSwipeTutorial();
      if (isMounted && !hasSeenTutorial) {
        setSwipeTutorialStep(0);
        setShowSwipeTutorial(true);
      }
    };

    loadSwipeTutorialState();
    return () => {
      isMounted = false;
    };
  }, [loading, cards.length, currentIndex, originalFlowComplete, activeCards.length, activeCardId, firstRenderedCardId]);

  const getEffectiveLearnedEstimate = useCallback(() => {
    return learnedRuntimeState.baseLearned + learnedRuntimeState.deltaLearned;
  }, []);

  const scheduleReviewCheck = useCallback(async ({ delayMs = REVIEW_PROMPT_DELAY_MS, requireMilestoneHit = false } = {}) => {
    if (!authUserId) return;
    if (autoPlay) return;

    let estimated = getEffectiveLearnedEstimate();
    if (requireMilestoneHit) {
      const reachedMilestone = [...reviewMilestonesRef.current]
        .reverse()
        .find((m) => estimated >= m);
      if (!reachedMilestone) return;
      if (lastTriggeredMilestoneRef.current === reachedMilestone) return;
      lastTriggeredMilestoneRef.current = reachedMilestone;
    }

    if (reviewPromptTimeoutRef.current) clearTimeout(reviewPromptTimeoutRef.current);
    reviewPromptTimeoutRef.current = setTimeout(async () => {
      if (reviewCheckInFlightRef.current) return;
      reviewCheckInFlightRef.current = true;
      try {
        estimated = getEffectiveLearnedEstimate();
        estimatedTotalLearnedRef.current = estimated;
        await maybePromptForReview({
          userId: authUserId,
          totalLearned: estimated,
          allowFallback: true,
        });
      } catch (error) {
        console.error('Review eligibility check failed:', error);
      } finally {
        reviewCheckInFlightRef.current = false;
      }
    }, delayMs);
  }, [authUserId, autoPlay, getEffectiveLearnedEstimate]);

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(16), paddingHorizontal: scale(8) }}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('medium');
                toggleFavorite(currentCard.card_id);
              }}
              hitSlop={{ top: scale(15), bottom: scale(15), left: scale(8), right: scale(8) }}
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
                activeOpacity={0.7}
                hitSlop={{ top: scale(15), bottom: scale(15), left: scale(8), right: scale(8) }}
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
      seenCardIdsRef.current = new Set();
      sessionSeenCardIdsRef.current = new Set();
      setSessionTargetCount(0);
      setCompletionSummary(null);
      setNextChapter(null);
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

        const sessionId = await startSwipeSession({
          deckId: deck.id,
          chapterId,
          unassignedOnly,
        });

        sessionIdRef.current = sessionId;
        const targetCount = await getSwipeSessionQueueCount(sessionId);
        setSessionTargetCount(targetCount);
        paginationCursorRef.current = {
          afterSortKey: null,
          afterQueueId: null,
        };
        currentPositionCursorRef.current = {
          currentSortKey: null,
          currentQueueId: null,
        };

        const [deckData, favCardIds, rpcCards] = await Promise.all([
          getDeckById(deck.id),
          getFavoriteCardIds(authUserId),
          getSwipeSessionNextCards({
            sessionId,
            afterSortKey: null,
            afterQueueId: null,
            currentSortKey: null,
            currentQueueId: null,
            limit: SESSION_BATCH_LIMIT,
          }),
        ]);

        if (deckData?.categories?.sort_order != null) {
          setCategorySortOrder(deckData.categories.sort_order);
        }

        setFavoriteIds(new Set(favCardIds || []));

        const learningCards = rpcCards.map(card => ({
          queue_id: card.queue_id,
          sort_key: card.sort_key,
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
        const lastFetchedCard = learningCards[learningCards.length - 1];
        if (lastFetchedCard) {
          paginationCursorRef.current = {
            afterSortKey: lastFetchedCard.sort_key,
            afterQueueId: lastFetchedCard.queue_id,
          };
        }
        seenCardIdsRef.current = new Set(learningCards.map(c => c.card_id));
        flippedByIdRef.current = {};
        sessionSeenCardIdsRef.current = learningCards[0]?.card_id
          ? new Set([learningCards[0].card_id])
          : new Set();
        setSessionProgressCount(learningCards.length > 0 ? 1 : 0);
        setCurrentIndex(0);

        let globalLearnedCount = getEffectiveLearnedEstimate();
        const shouldInitGlobalLearned = !hasInitializedGlobalLearnedRef.current || learnedRuntimeState.userId !== authUserId;

        if (shouldInitGlobalLearned) {
          globalLearnedCount = await getTotalLearnedCardsCount(authUserId);
          learnedRuntimeState.userId = authUserId;
          learnedRuntimeState.baseLearned = globalLearnedCount;
          learnedRuntimeState.deltaLearned = 0;
          hasInitializedGlobalLearnedRef.current = true;
        }
        estimatedTotalLearnedRef.current = globalLearnedCount;

      } catch (error) {
        console.error("Swipe sayfasında veri çekme hatası:", error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, [deck.id, chapter?.id]);

  // Swipe çıkışı: tek bölümde cache'i merge et; tüm deste modunda chapters progress cache'ini sıfırla
  useEffect(() => {
    return () => {
      if (reviewPromptTimeoutRef.current) clearTimeout(reviewPromptTimeoutRef.current);
      if (!deck?.id || !authUserId) return;
      invalidateCache(`progress_deck_${deck.id}_${authUserId}`);
      const statsChapterId =
        typeof chapter === 'undefined'
          ? undefined
          : (chapter === null ? null : chapter.id);
      if (statsChapterId === undefined) {
        invalidateCache(`progress_chapters_${deck.id}_${authUserId}`);
      } else {
        mergeChapterProgressIntoCache(deck.id, authUserId, statsChapterId).catch(() => {});
      }
    };
  }, [deck?.id, authUserId, chapter]);

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
      const activeSessionId = sessionIdRef.current;
      if (activeSessionId) {
        try {
          await endSwipeSession({ sessionId: activeSessionId });
        } catch (err) {
          console.warn('endSwipeSession failed:', err);
        } finally {
          if (sessionIdRef.current === activeSessionId) {
            sessionIdRef.current = null;
          }
        }
      }
      if (authUserId && deck?.id) {
        invalidateCache(`progress_deck_${deck.id}_${authUserId}`);
        const statsChapterId =
          typeof chapter === 'undefined'
            ? undefined
            : (chapter === null ? null : chapter.id);
        if (statsChapterId === undefined) {
          await invalidateCache(`progress_chapters_${deck.id}_${authUserId}`);
        } else {
          await mergeChapterProgressIntoCache(deck.id, authUserId, statsChapterId);
        }
      }
    };
    const unsubscribe = navigation.addListener('blur', handleExit);
    return () => {
      unsubscribe();
      handleExit();
    };
  }, [navigation, authUserId, deck?.id, chapter]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onHardwareBack = () => {
      if (isAnimatingRef.current) return true;
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, []);

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

  const currentProgress = sessionTargetCount > 0
    ? Math.min(100, (sessionProgressCount / sessionTargetCount) * 100)
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

  const fetchMoreCards = useCallback(async () => {
    if (isFetchingMoreRef.current || !userId || !sessionIdRef.current || !hasMoreCardsRef.current) return;
    isFetchingMoreRef.current = true;
    try {
      const moreCards = await getSwipeSessionNextCards({
        sessionId: sessionIdRef.current,
        afterSortKey: paginationCursorRef.current.afterSortKey,
        afterQueueId: paginationCursorRef.current.afterQueueId,
        currentSortKey: currentPositionCursorRef.current.currentSortKey,
        currentQueueId: currentPositionCursorRef.current.currentQueueId,
        limit: SESSION_BATCH_LIMIT,
      });
      lastDueCheckAtRef.current = Date.now();

      const upcomingQueueIds = new Set(
        cards
          .slice(currentIndex + 1)
          .map(c => c?.queue_id)
          .filter(Boolean)
      );

      const newCards = moreCards
        .filter(c => !upcomingQueueIds.has(c.queue_id))
        .map(card => ({
          queue_id: card.queue_id,
          sort_key: card.sort_key,
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
        const lastFetchedCard = newCards[newCards.length - 1];
        paginationCursorRef.current = {
          afterSortKey: lastFetchedCard.sort_key,
          afterQueueId: lastFetchedCard.queue_id,
        };
        setCards(prev => {
          const consumed = prev.slice(0, currentIndex + 1);
          const upcoming = prev.slice(currentIndex + 1);
          const upcomingQueueIdsForMerge = new Set(
            upcoming.map(c => c?.queue_id).filter(Boolean)
          );
          const cardsToMerge = newCards.filter(c => !upcomingQueueIdsForMerge.has(c.queue_id));
          const mergedUpcoming = [...upcoming, ...cardsToMerge].sort((a, b) => {
            const sortA = Number(a.sort_key ?? 0);
            const sortB = Number(b.sort_key ?? 0);
            if (sortA !== sortB) return sortA - sortB;
            return String(a.queue_id ?? '').localeCompare(String(b.queue_id ?? ''));
          });
          return [...consumed, ...mergedUpcoming];
        });
      } else if (moreCards.length === 0) {
        hasMoreCardsRef.current = false;
      }
    } catch (error) {
      console.error('Error fetching more cards:', error);
    } finally {
      isFetchingMoreRef.current = false;
    }
  }, [userId, cards, currentIndex]);

  const checkDueReinserts = useCallback(async () => {
    if (isDueCheckingRef.current) return;
    if (!sessionIdRef.current) return;
    if (isFetchingMoreRef.current) return;
    if (Date.now() - lastDueCheckAtRef.current < 120000) return;

    isDueCheckingRef.current = true;
    try {
      const dueCards = await getSwipeSessionNextCards({
        sessionId: sessionIdRef.current,
        afterSortKey: paginationCursorRef.current.afterSortKey,
        afterQueueId: paginationCursorRef.current.afterQueueId,
        currentSortKey: currentPositionCursorRef.current.currentSortKey,
        currentQueueId: currentPositionCursorRef.current.currentQueueId,
        limit: 5,
      });

      lastDueCheckAtRef.current = Date.now();

      const upcomingQueueIds = new Set(
        cards
          .slice(currentIndex + 1)
          .map(c => c?.queue_id)
          .filter(Boolean)
      );

      const newCards = dueCards
        .filter(c => !upcomingQueueIds.has(c.queue_id))
        .map(card => ({
          queue_id: card.queue_id,
          sort_key: card.sort_key,
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
        setCards(prev => {
          const consumed = prev.slice(0, currentIndex + 1);
          const upcoming = prev.slice(currentIndex + 1);
          const upcomingQueueIdsForMerge = new Set(
            upcoming.map(c => c?.queue_id).filter(Boolean)
          );
          const cardsToMerge = newCards.filter(c => !upcomingQueueIdsForMerge.has(c.queue_id));
          const mergedUpcoming = [...upcoming, ...cardsToMerge].sort((a, b) => {
            const sortA = Number(a.sort_key ?? 0);
            const sortB = Number(b.sort_key ?? 0);
            if (sortA !== sortB) return sortA - sortB;
            return String(a.queue_id ?? '').localeCompare(String(b.queue_id ?? ''));
          });
          return [...consumed, ...mergedUpcoming];
        });
      }
    } catch (error) {
      console.error('Error checking due reinserts:', error);
    } finally {
      isDueCheckingRef.current = false;
    }
  }, [cards, currentIndex]);

  const handleSwipe = useCallback(async (cardIndex, direction) => {
    if (showSwipeTutorial) {
      programmaticSwipeRef.current = null;
      return;
    }
    if (!cards[cardIndex]) return;
    const card = cards[cardIndex];
    const override = programmaticSwipeRef.current;
    const actualDirection = override?.direction || direction;
    const actualSkipMinutes = override?.skipMinutes ?? null;
    programmaticSwipeRef.current = null;
    const swipedCardId = card.card_id;
    setTimeout(() => resetFlipForCardId(swipedCardId), SWIPE_ANIMATION_MS);
    sessionSeenCardIdsRef.current.add(swipedCardId);
    const nextCard = cards[cardIndex + 1];
    if (nextCard?.card_id) {
      sessionSeenCardIdsRef.current.add(nextCard.card_id);
    }
    setSessionProgressCount(sessionSeenCardIdsRef.current.size);
    if (!userId) return;
    isAnimatingRef.current = true;
    setHistory((prev) => [...prev, cardIndex]);
    setHistoryDirections((prev) => [...prev, actualDirection]);
    setTotalSwipeCount((prev) => prev + 1);
    currentPositionCursorRef.current = {
      currentSortKey: card.sort_key,
      currentQueueId: card.queue_id,
    };
    try {
      await recordSwipeSessionSwipe({
        sessionId: sessionIdRef.current,
        cardId: card.card_id,
        direction: actualDirection,
        skipMinutes: actualSkipMinutes,
      });
    } catch (error) {
      console.error('Failed to record swipe session swipe:', error);
    }
    if (actualDirection === 'right') {
      setRightCount((prev) => prev + 1);
      learnedRuntimeState.deltaLearned += 1;
      estimatedTotalLearnedRef.current += 1;
      setRightHighlight(true);
      setTimeout(() => setRightHighlight(false), 400);
      scheduleReviewCheck({ delayMs: REVIEW_PROMPT_DELAY_MS, requireMilestoneHit: true });
    } else if (actualDirection === 'left' || actualDirection === 'skip') {
      if (actualDirection === 'left') {
        historyLeftCardIds.current.push(card.card_id);
      }
      leftCountedCardIds.current.add(card.card_id);
      setLeftCount((prev) => prev + 1);
      setLeftHighlight(true);
      setTimeout(() => setLeftHighlight(false), 400);
    }
    checkDueReinserts();
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, SWIPE_ANIMATION_MS);
  }, [cards, userId, resetFlipForCardId, scheduleReviewCheck, checkDueReinserts, showSwipeTutorial]);

  const handleFlipById = useCallback((cardId) => {
    if (showSwipeTutorial) return;
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
  }, [getAnimatedValueForCardId, showSwipeTutorial]);

  const handleSkip = (minutes) => {
    if (showSwipeTutorial) return;
    if (!cards[currentIndex]) return;
    if (!userId) return;
    programmaticSwipeRef.current = {
      direction: 'skip',
      skipMinutes: minutes,
    };
    if (swiperRef.current) {
      swiperRef.current.swipeLeft();
    }
  };

  const handleUndo = async () => {
    if (showSwipeTutorial) return;
    if (undoDisabled || !sessionIdRef.current || !swiperRef.current) return;

    setUndoDisabled(true);

    const lastIndex = history[history.length - 1];
    const undoneCard = cards[lastIndex];
    const lastDirection = historyDirections[historyDirections.length - 1];

    try {
      const result = await undoLastSwipe({ sessionId: sessionIdRef.current });
      if (result?.success === false && result?.reason === 'empty_stack') {
        return;
      }

      if (undoneCard) {
        resetFlipForCardId(undoneCard.card_id);
      }

      if ((lastDirection === 'left' || lastDirection === 'skip') && undoneCard) {
        if (lastDirection === 'left') {
          historyLeftCardIds.current.pop();
        }
        leftCountedCardIds.current.delete(undoneCard.card_id);
        setLeftCount((c) => Math.max(0, c - 1));
      } else if (lastDirection === 'right') {
        learnedRuntimeState.deltaLearned = Math.max(0, learnedRuntimeState.deltaLearned - 1);
        estimatedTotalLearnedRef.current = Math.max(0, estimatedTotalLearnedRef.current - 1);
        setRightCount((c) => Math.max(0, c - 1));
      }

      if (lastDirection) {
        setTotalSwipeCount((c) => Math.max(0, c - 1));
        setHistory((prev) => prev.slice(0, -1));
        setHistoryDirections((prev) => prev.slice(0, -1));
      }

      paginationCursorRef.current = {
        afterSortKey: null,
        afterQueueId: null,
      };
      currentPositionCursorRef.current = {
        currentSortKey: null,
        currentQueueId: null,
      };

      const freshCards = await getSwipeSessionNextCards({
        sessionId: sessionIdRef.current,
        afterSortKey: null,
        afterQueueId: null,
        currentSortKey: null,
        currentQueueId: null,
        limit: SESSION_BATCH_LIMIT,
      });

      const learningCards = freshCards.map(card => ({
        queue_id: card.queue_id,
        sort_key: card.sort_key,
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
      setCurrentIndex(0);
      seenCardIdsRef.current = new Set(learningCards.map(c => c.card_id));
      flippedByIdRef.current = {};
      hasMoreCardsRef.current = learningCards.length > 0;

      const advancedToCard = cards[lastIndex + 1];
      if (advancedToCard?.card_id) {
        sessionSeenCardIdsRef.current.delete(advancedToCard.card_id);
      }
      if (undoneCard?.card_id) {
        sessionSeenCardIdsRef.current.add(undoneCard.card_id);
      }
      setSessionProgressCount(Math.max(1, sessionSeenCardIdsRef.current.size));

      const lastFetchedCard = learningCards[learningCards.length - 1];
      if (lastFetchedCard) {
        paginationCursorRef.current = {
          afterSortKey: lastFetchedCard.sort_key,
          afterQueueId: lastFetchedCard.queue_id,
        };
      }

      requestAnimationFrame(() => {
        if (swiperRef.current) {
          swiperRef.current.jumpToCardIndex(0);
        }
      });
    } catch (error) {
      console.error('Failed to undo swipe session action:', error);
    } finally {
      setTimeout(() => {
        setUndoDisabled(false);
      }, 350);
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

  const originalFlowComplete =
    sessionTargetCount > 0 &&
    sessionProgressCount >= sessionTargetCount;

  useEffect(() => {
    const isComplete = cards.length === 0 || currentIndex >= cards.length || originalFlowComplete;
    if (!isComplete || !userId || !deck?.id || !sessionIdRef.current) return;

    let cancelled = false;
    const fetchCompletionSummary = async () => {
      try {
        const sessionCountsPromise = getSwipeSessionCompletionCounts(sessionIdRef.current, userId);
        const hasChapterScope = Boolean(chapter?.id);
        const chapterProgressPromise = hasChapterScope
          ? getChapterProgressCounts(userId, deck.id, chapter.id)
          : Promise.resolve(null);
        const reviewsPromise = hasChapterScope
          ? getChapterFutureReviewSummary(userId, deck.id, chapter.id)
          : Promise.resolve({ nearest: null, farthest: null });
        const chaptersPromise = hasChapterScope
          ? listChapters(deck.id)
          : Promise.resolve([]);

        const [sessionCounts, chapterProgress, reviews, chapters] = await Promise.all([
          sessionCountsPromise,
          chapterProgressPromise,
          reviewsPromise,
          chaptersPromise,
        ]);
        if (cancelled) return;

        setCompletionSummary({ sessionCounts, chapterProgress, reviews });
        if (hasChapterScope) {
          const chapterIndex = chapters.findIndex(item => item.id === chapter.id);
          const followingChapter = chapterIndex >= 0 ? chapters[chapterIndex + 1] : null;
          if (followingChapter) {
            const nextProgress = await getChapterProgressCounts(userId, deck.id, followingChapter.id);
            if (!cancelled) setNextChapter({ ...followingChapter, totalCards: nextProgress.total });
          }
        }
      } catch (error) {
        console.error('Error fetching completion summary:', error);
      }
    };

    fetchCompletionSummary();
    return () => { cancelled = true; };
  }, [cards.length, currentIndex, originalFlowComplete, userId, deck?.id, chapter?.id]);

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

  if (cards.length === 0 || currentIndex >= cards.length || originalFlowComplete) {
    const sessionCounts = completionSummary?.sessionCounts;
    const sessionLearned = sessionCounts
      ? Math.min(sessionCounts.learned || 0, sessionTargetCount)
      : null;
    const sessionPlanned = sessionLearned === null
      ? null
      : Math.max(0, sessionTargetCount - sessionLearned);
    const chapterProgress = completionSummary?.chapterProgress;
    const chapterLearned = chapterProgress?.learned || 0;
    const chapterUnfinished = chapterProgress ? chapterProgress.total - chapterLearned : 0;
    const chapterPercent = chapterProgress?.total
      ? Math.round((chapterLearned / chapterProgress.total) * 100)
      : 0;
    const nearestReview = completionSummary?.reviews?.nearest;
    const farthestReview = completionSummary?.reviews?.farthest;
    const isEmptyChapter = Boolean(chapter?.id) && sessionTargetCount === 0 && cards.length === 0;

    if (isEmptyChapter) {
      return (
        <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
          <View style={styles.emptyCompletionContent}>
            <Text style={styles.emptyCompletionIcon}>📚</Text>
            <Text style={[typography.styles.h2, styles.emptyCompletionTitle, { color: colors.text }]}>{t('swipeDeck.completion.emptyTitle', 'Bu bölümde şu anda çalışılacak kart yok.')}</Text>
            <View style={[styles.emptyCompletionInfo, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
              <Text style={[typography.styles.caption, { color: colors.muted }]}>{t('swipeDeck.completion.nearestReview', 'En yakın tekrar')}</Text>
              <Text style={[typography.styles.subtitle, styles.emptyCompletionTime, { color: colors.text }]}>{nearestReview ? formatFutureReview(nearestReview.at, t) : t('swipeDeck.completion.allLearned', 'Tüm kartlar öğrenildi')}</Text>
            </View>
            <View style={styles.completionCtaArea}>
              <View style={styles.completionButtonRow}>
                <TouchableOpacity style={[styles.completionButton, styles.completionButtonHalf, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, borderWidth: StyleSheet.hairlineWidth }]} onPress={() => navigation.goBack()}>
                  <Text style={[typography.styles.button, { color: colors.text }]}>{t('swipeDeck.completion.back', 'Geri Dön')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={!nextChapter}
                  style={[styles.completionButton, styles.completionButtonHalf, { backgroundColor: nextChapter ? colors.buttonColor : colors.cardBackground, borderColor: nextChapter ? 'transparent' : colors.cardBorder, borderWidth: nextChapter ? 0 : StyleSheet.hairlineWidth, opacity: nextChapter ? 1 : 0.55 }]}
                  onPress={() => nextChapter && navigation.replace('SwipeDeck', { deck, chapter: nextChapter })}
                >
                  <Text style={[typography.styles.button, { color: nextChapter ? colors.buttonText : colors.muted }]}>{t('swipeDeck.completion.nextChapter', 'Sonraki Bölüm')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.completionNextMetaRow}>
                <View style={styles.completionNextMetaSpacer} />
                <Text style={[styles.nextChapterMeta, { color: colors.muted }]}>{nextChapter ? t('swipeDeck.completion.chapterMeta', { chapter: nextChapter.ordinal, count: nextChapter.totalCards, defaultValue: `Bölüm ${nextChapter.ordinal} • ${nextChapter.totalCards} kart` }) : t('swipeDeck.completion.noNextChapter', 'Sonraki bölüm yok')}</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={[styles.completionContent, { paddingBottom: insets.bottom + verticalScale(24) }]} showsVerticalScrollIndicator={false}>
          <View style={styles.completionHero}>
            <LinearGradient colors={[colors.buttonColor, '#FF6B35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.completionHeroCard}>
              <View style={styles.completionHeroTitleRow}>
                <Iconify icon="material-symbols:trophy" size={moderateScale(36)} color="#FFFFFF" />
                <Text style={[typography.styles.h2, styles.completionTitle, { color: '#FFFFFF' }]}>{t('swipeDeck.completion.title', 'Oturum Tamamlandı!')}</Text>
              </View>
              <View style={styles.completionHeroMetricCircle}>
                <Text style={[styles.completionHeroMetric, { color: '#FFFFFF' }]}>{sessionTargetCount}</Text>
                <Text style={[typography.styles.body, styles.completionHeroLabel, { color: 'rgba(255,255,255,0.88)' }]}>{t('swipeDeck.completion.cardsStudied', 'Kart Çalışıldı')}</Text>
              </View>
              <View style={styles.completionHeroSessionStats}>
                <View style={styles.completionHeroSessionStat}>
                  <Text style={styles.completionHeroSessionNumber}>{sessionLearned ?? '—'}</Text>
                  <Text style={styles.completionHeroSessionLabel}>{t('swipeDeck.completion.learned', 'Öğrenildi')}</Text>
                </View>
                <View style={styles.completionHeroSessionDivider} />
                <View style={styles.completionHeroSessionStat}>
                  <Text style={styles.completionHeroSessionNumber}>{sessionPlanned ?? '—'}</Text>
                  <Text style={styles.completionHeroSessionLabel}>{t('swipeDeck.completion.reviewPlanned', 'Tekrar Planlandı')}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={[styles.completionChapterCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                <View style={styles.completionChapterHeader}>
                  <View style={styles.completionChapterTitleRow}>
                    <Iconify icon="streamline-flex:module-puzzle-2" size={moderateScale(20)} color={colors.buttonColor} />
                    <Text style={[typography.styles.subtitle, { color: colors.text }]}>{t('swipeDeck.completion.chapterProgress', 'Bölüm İlerlemesi')}</Text>
                  </View>
                  <Text style={[styles.completionChapterProgressValue, { color: colors.buttonColor }]}>{chapterProgress ? `%${chapterPercent}` : '--'}</Text>
                </View>
                <View style={[styles.completionChapterProgressTrack, { backgroundColor: colors.progressBarSwipe || colors.border }]}>
                  <View style={[styles.completionChapterProgressFill, { width: `${chapterProgress ? chapterPercent : 0}%`, backgroundColor: colors.buttonColor }]} />
                </View>
                <View style={styles.completionChapterMetrics}>
                  <Text style={[typography.styles.body, { color: colors.text }]}>{chapterProgress ? `• ${t('swipeDeck.completion.learnedCount', { count: chapterLearned, defaultValue: `${chapterLearned} Öğrenildi` })}` : '—'}</Text>
                  <Text style={[typography.styles.body, { color: colors.muted }]}>{chapterProgress ? `• ${t('swipeDeck.completion.learningCount', { count: chapterUnfinished, defaultValue: `${chapterUnfinished} Öğrenme Sürecinde` })}` : '—'}</Text>
                </View>
                <View style={[styles.completionChapterDivider, { backgroundColor: colors.border }]} />
                <View style={styles.completionReviewGrid}>
                  <View style={styles.completionReviewItem}>
                    <Iconify icon="lets-icons:clock-fill" size={moderateScale(22)} color={colors.buttonColor} />
                    <View style={styles.completionReviewTextGroup}>
                      <Text style={[styles.completionReviewMetric, { color: colors.text }]}>{nearestReview ? formatFutureReview(nearestReview.at, t) : '—'}</Text>
                      <Text style={[typography.styles.caption, styles.completionReviewLabel, { color: colors.muted }]}>{nearestReview ? t('swipeDeck.completion.cardsReady', { count: nearestReview.count, defaultValue: `${nearestReview.count} kart hazır` }) : t('swipeDeck.completion.nearestReview', 'En yakın tekrar')}</Text>
                    </View>
                  </View>
                  <View style={styles.completionReviewItem}>
                    <Iconify icon="solar:calendar-bold" size={moderateScale(22)} color={colors.secondary} />
                    <View style={styles.completionReviewTextGroup}>
                      <Text style={[styles.completionReviewMetric, { color: colors.text }]}>{farthestReview ? formatFutureReview(farthestReview.at, t) : '—'}</Text>
                      <Text style={[typography.styles.caption, styles.completionReviewLabel, { color: colors.muted }]}>{t('swipeDeck.completion.farthestReview', 'En uzak tekrar')}</Text>
                    </View>
                  </View>
                </View>
          </View>

          <View style={styles.completionCtaArea}>
            <View style={styles.completionButtonRow}>
              <TouchableOpacity style={[styles.completionButton, styles.completionButtonHalf, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, borderWidth: StyleSheet.hairlineWidth }]} onPress={() => navigation.goBack()}>
                <Text style={[typography.styles.button, { color: colors.text }]}>{t('swipeDeck.completion.back', 'Geri Dön')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!nextChapter}
                style={[styles.completionButton, styles.completionButtonHalf, { backgroundColor: nextChapter ? colors.buttonColor : colors.cardBackground, borderColor: nextChapter ? 'transparent' : colors.cardBorder, borderWidth: nextChapter ? 0 : StyleSheet.hairlineWidth, opacity: nextChapter ? 1 : 0.55 }]}
                onPress={() => nextChapter && navigation.replace('SwipeDeck', { deck, chapter: nextChapter })}
              >
                <Text style={[typography.styles.button, { color: nextChapter ? colors.buttonText : colors.muted }]}>{t('swipeDeck.completion.nextChapter', 'Sonraki Bölüm')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.completionNextMetaRow}>
              <View style={styles.completionNextMetaSpacer} />
              <Text style={[styles.nextChapterMeta, { color: colors.muted }]}>{nextChapter ? t('swipeDeck.completion.chapterMeta', { chapter: nextChapter.ordinal, count: nextChapter.totalCards, defaultValue: `Bölüm ${nextChapter.ordinal} • ${nextChapter.totalCards} kart` }) : t('swipeDeck.completion.noNextChapter', 'Sonraki bölüm yok')}</Text>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  const renderSwipeTutorialOverlay = () => {
    if (!showSwipeTutorial || !activeTutorialStep) return null;

    const isFirstStep = swipeTutorialStep === 0;
    const isLastStep = swipeTutorialStep === swipeTutorialSteps.length - 1;
    const isCardTarget = activeTutorialStep.target === 'card';
    const targetLayout = isCardTarget ? cardTargetLayout : intervalTargetLayout;
    const targetPadding = isCardTarget ? scale(10) : scale(6);
    const targetRadius = isCardTarget ? moderateScale(26) : moderateScale(12);
    const hasValidTargetLayout =
      targetLayout &&
      Number.isFinite(targetLayout.x) &&
      Number.isFinite(targetLayout.y) &&
      Number.isFinite(targetLayout.width) &&
      Number.isFinite(targetLayout.height) &&
      targetLayout.width > 0 &&
      targetLayout.height > 0;
    const spotlightLeft = hasValidTargetLayout ? Math.max(0, targetLayout.x - targetPadding) : 0;
    const spotlightTop = hasValidTargetLayout ? Math.max(0, targetLayout.y - targetPadding) : 0;
    const spotlightWidth = hasValidTargetLayout
      ? Math.min(width - spotlightLeft, targetLayout.width + targetPadding * 2)
      : 0;
    const spotlightHeight = hasValidTargetLayout
      ? Math.min(height - spotlightTop, targetLayout.height + targetPadding * 2)
      : 0;
    const shouldUseSpotlight =
      hasValidTargetLayout &&
      spotlightWidth > 0 &&
      spotlightHeight > 0 &&
      spotlightLeft + spotlightWidth <= width + 1 &&
      spotlightTop + spotlightHeight <= height + 1;
    const spotlightRadius = shouldUseSpotlight
      ? Math.min(targetRadius, spotlightWidth / 2, spotlightHeight / 2)
      : targetRadius;
    const cornerCoverRadius = isCardTarget ? Math.min(spotlightRadius, moderateScale(10)) : spotlightRadius;
    const targetFrameStyle = hasValidTargetLayout ? {
      top: spotlightTop,
      left: spotlightLeft,
      width: spotlightWidth,
      height: spotlightHeight,
      borderRadius: spotlightRadius,
    } : null;
    const coachmarkPositionStyle = isCardTarget
      ? {
        top: targetLayout ? Math.max(verticalScale(54), targetLayout.y - verticalScale(156)) : verticalScale(74),
        left: scale(18),
        right: scale(18),
      }
      : {
        left: scale(18),
        right: scale(18),
        bottom: targetFrameStyle
          ? Math.max(verticalScale(24), height - targetFrameStyle.top - verticalScale(60))
          : verticalScale(144) + insets.bottom,
      };
    const swipeDirectionHintPositionStyle = activeTutorialStep.showSwipeHint
      ? {
        top: (coachmarkPositionStyle.top ?? verticalScale(74)) + verticalScale(340),
        left: scale(24),
        right: scale(24),
      }
      : null;

    return (
      <View style={styles.swipeTutorialOverlay} pointerEvents="auto" onTouchStart={() => {}}>
        {shouldUseSpotlight ? (
          <>
            <View style={[styles.swipeTutorialDimLayer, { top: 0, left: 0, right: 0, height: spotlightTop }]} />
            <View style={[styles.swipeTutorialDimLayer, { top: spotlightTop, left: 0, width: spotlightLeft, height: spotlightHeight }]} />
            <View style={[styles.swipeTutorialDimLayer, { top: spotlightTop, left: spotlightLeft + spotlightWidth, right: 0, height: spotlightHeight }]} />
            <View style={[styles.swipeTutorialDimLayer, { top: spotlightTop + spotlightHeight, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.swipeTutorialCornerCover, { top: spotlightTop, left: spotlightLeft, width: cornerCoverRadius, height: cornerCoverRadius, borderBottomRightRadius: cornerCoverRadius }]} />
            <View style={[styles.swipeTutorialCornerCover, { top: spotlightTop, left: spotlightLeft + spotlightWidth - cornerCoverRadius, width: cornerCoverRadius, height: cornerCoverRadius, borderBottomLeftRadius: cornerCoverRadius }]} />
            <View style={[styles.swipeTutorialCornerCover, { top: spotlightTop + spotlightHeight - cornerCoverRadius, left: spotlightLeft, width: cornerCoverRadius, height: cornerCoverRadius, borderTopRightRadius: cornerCoverRadius }]} />
            <View style={[styles.swipeTutorialCornerCover, { top: spotlightTop + spotlightHeight - cornerCoverRadius, left: spotlightLeft + spotlightWidth - cornerCoverRadius, width: cornerCoverRadius, height: cornerCoverRadius, borderTopLeftRadius: cornerCoverRadius }]} />
          </>
        ) : (
          <View style={styles.swipeTutorialFullDimLayer} />
        )}
        {targetFrameStyle && (
          <View pointerEvents="none" style={[styles.swipeTutorialTargetFrame, targetFrameStyle]} />
        )}
        <View style={[styles.swipeTutorialCoachmarkGroup, coachmarkPositionStyle]}>
          <View style={[styles.swipeTutorialCard, styles.swipeTutorialCardInGroup, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <View style={styles.swipeTutorialStepPill}>
              <Text style={styles.swipeTutorialStepText}>{swipeTutorialStep + 1}/{swipeTutorialSteps.length}</Text>
            </View>
            <View style={styles.swipeTutorialTitleRow}>
              <Iconify icon={activeTutorialStep.icon} size={moderateScale(20)} color="#F98A21" />
              <Text style={[styles.swipeTutorialTitle, { color: colors.text }]}>{activeTutorialStep.title}</Text>
            </View>
            <Text style={[styles.swipeTutorialDescription, { color: colors.muted }]}>{activeTutorialStep.description}</Text>
            {isCardTarget ? <View style={styles.swipeTutorialArrowUp} /> : <View style={styles.swipeTutorialArrowDown} />}
            <View style={styles.swipeTutorialActions}>
              <Pressable onPress={completeSwipeTutorial} style={styles.swipeTutorialGhostButton}>
                <Text style={[styles.swipeTutorialGhostText, { color: colors.muted }]}>{t('swipeDeck.tutorial.skip', 'Geç')}</Text>
              </Pressable>
              <View style={styles.swipeTutorialNavActions}>
                <Pressable
                  disabled={isFirstStep}
                  onPress={() => setSwipeTutorialStep((step) => Math.max(0, step - 1))}
                  style={[styles.swipeTutorialBackButton, { borderColor: colors.cardBorder }, isFirstStep && styles.swipeTutorialDisabledButton]}
                >
                  <Text style={[styles.swipeTutorialBackText, { color: colors.text }]}>{t('swipeDeck.tutorial.back', 'Geri')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (isLastStep) {
                      completeSwipeTutorial();
                    } else {
                      setSwipeTutorialStep((step) => Math.min(swipeTutorialSteps.length - 1, step + 1));
                    }
                  }}
                  style={styles.swipeTutorialNextButton}
                >
                  <Text style={styles.swipeTutorialNextText}>
                    {isLastStep ? t('swipeDeck.tutorial.done', 'Anladım') : t('swipeDeck.tutorial.next', 'İleri')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
        {activeTutorialStep.showSwipeHint && swipeDirectionHintPositionStyle && (
          <View pointerEvents="none" style={[styles.swipeTutorialSwipeHint, swipeDirectionHintPositionStyle]}>
            <View style={[styles.swipeTutorialSwipeBadge, styles.swipeTutorialSwipeBadgeLeft]}>
              <View style={[styles.swipeTutorialSwipeBadgeGlow, styles.swipeTutorialSwipeBadgeGlowLeft]} />
              <View style={[styles.swipeTutorialSwipeBadgeContent, styles.swipeTutorialSwipeBadgeContentLeft]}>
                <Iconify icon="ion:arrow-undo" size={moderateScale(16)} color="#FFFFFF" />
                <Text style={styles.swipeTutorialSwipeHintText}>{t('swipeDeck.tutorial.swipeHintLeft', 'Tekrar Et')}</Text>
              </View>
            </View>
            <View style={[styles.swipeTutorialSwipeBadge, styles.swipeTutorialSwipeBadgeRight]}>
              <View style={[styles.swipeTutorialSwipeBadgeGlow, styles.swipeTutorialSwipeBadgeGlowRight]} />
              <View style={[styles.swipeTutorialSwipeBadgeContent, styles.swipeTutorialSwipeBadgeContentRight]}>
                <Text style={styles.swipeTutorialSwipeHintText}>{t('swipeDeck.tutorial.swipeHintRight', 'Öğrendim')}</Text>
                <Iconify icon="ion:arrow-redo" size={moderateScale(16)} color="#FFFFFF" />
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View ref={tutorialOverlayRootRef} collapsable={false} style={styles.container}>
      <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background}]}>
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
              const currentCardNumber = sessionProgressCount;
              const allUniqueSeen = sessionTargetCount > 0 && currentCardNumber >= sessionTargetCount;
              const currentCardIsReinserted = cards[currentIndex] && leftCountedCardIds.current.has(cards[currentIndex].card_id);
              const hasReinsertToShow = cards
                .slice(currentIndex + 1)
                .some((c) => c?.card_id && leftCountedCardIds.current.has(c.card_id));
              const showVaktiGeldi =
                sessionTargetCount > 0 && allUniqueSeen && hasReinsertToShow && currentCardIsReinserted;
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
                  <Text style={[styles.deckProgressText, { color: colors.text }]}>{currentCardNumber}/{sessionTargetCount}</Text>
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: verticalScale(8), overflow: 'hidden' }}>
          {activeCards.length > 0 && (
          <Swiper
            key={activeCards[0]?.card_id ?? `deck-${currentIndex}`}
            ref={swiperRef}
            cards={activeCards}
            keyExtractor={(card) => card?.card_id ?? card?.queue_id}
            renderCard={(card, i) => {
              const cardId = card?.card_id;
              const animatedValue = cardId ? getAnimatedValueForCardId(cardId) : null;
              const gradientColors = getCategoryColors(categorySortOrder);
              const isPlaceholder = !card || !card.cards;
              return (
                <View
                  key={cardId || `placeholder-${i}`}
                  ref={i === 0 ? cardTutorialTargetRef : undefined}
                  collapsable={false}
                  onLayout={() => {
                    if (i === 0 && cardId && firstRenderedCardId !== cardId) {
                      setFirstRenderedCardId(cardId);
                      measureTutorialTarget(cardTutorialTargetRef, setCardTargetLayout);
                    }
                  }}
                >
                  <SwipeFlipCard
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
                    swipeX={i === 0 ? swipeX : null}
                  />
                </View>
              );
            }}
            onSwiping={(x) => {
              if (showSwipeTutorial) return;
              swipeX.setValue(x);
            }}
            onSwipedAborted={() => {
              if (showSwipeTutorial) return;
              Animated.spring(swipeX, {
                toValue: 0,
                useNativeDriver: true,
              }).start();
            }}
            onSwiped={() => {
              if (showSwipeTutorial) return;
              setCurrentIndex((prev) => prev + 1);
              swipeX.setValue(0);
            }}
            onSwipedLeft={() => {
              if (showSwipeTutorial) return;
              triggerHaptic('selection');
              handleSwipe(currentIndexRef.current, 'left');
            }}
            onSwipedRight={() => {
              if (showSwipeTutorial) return;
              triggerHaptic('light');
              handleSwipe(currentIndexRef.current, 'right');
            }}
            disableLeftSwipe={showSwipeTutorial}
            disableRightSwipe={showSwipeTutorial}
            disableTopSwipe={true}
            disableBottomSwipe={true}
            stackSize={2}
            showSecondCard={true}
            swipeBackCard={false}
            backgroundColor={colors.background}
            stackSeparation={0}
            useViewOverflow={Platform.OS === 'ios' ? false : true}
            stackScale={1}
            cardHorizontalMargin={CARD_HORIZONTAL_MARGIN}
            containerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            cardStyle={{ width: CARD_WIDTH, height: CARD_HEIGHT, alignSelf: 'center', justifyContent: 'center' }}
            stackAnimationFriction={100}
            stackAnimationTension={100}
            swipeAnimationDuration={SWIPE_ANIMATION_MS}
          />
          )}
        </View>
        {/* Yatay birleşik butonlar */}
        {/* Yatay birleşik butonlar */}
        <View style={{ paddingBottom: insets.bottom }}>
        <View
          ref={intervalTutorialTargetRef}
          collapsable={false}
          onLayout={() => measureTutorialTarget(intervalTutorialTargetRef, setIntervalTargetLayout)}
          style={[styles.horizontalButtonRow, { backgroundColor: colors.buttonColor }]}
        >

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
        </View>
        {/* Geri alma butonu */}
        <TouchableOpacity style={[styles.undoButton, undoDisabled && { opacity: 0.5 }, { paddingBottom: insets.bottom }]} onPress={handleUndo} disabled={undoDisabled}>
          <Iconify icon="lets-icons:refund-back" size={moderateScale(28)} color={colors.orWhite} />
        </TouchableOpacity>
        {/* Auto play butonu */}
        <TouchableOpacity
          style={[styles.autoPlayButton, { paddingBottom: insets.bottom }]}
          onPress={() => {
            if (showSwipeTutorial) return;
            setAutoPlay((prev) => !prev);
          }}
        >
          {autoPlay ? (
            <Iconify icon="material-symbols:pause-rounded" size={moderateScale(32)} color={colors.orWhite} />
          ) : (
            <Iconify icon="streamline:button-play-solid" size={moderateScale(20)} color={colors.orWhite} />
          )}
        </TouchableOpacity>
        {/* Progress Bar (undoButton'un hemen üstünde) */}
        <View style={[styles.progressBarContainer, { backgroundColor: colors.progressBarSwipe, overflow: 'hidden', marginBottom: insets.bottom }]}>
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
      {renderSwipeTutorialOverlay()}
      <ReportModal
        visible={reportModalVisible}
        onClose={() => { setReportModalVisible(false); setReportCardId(null); }}
        reportType="card"
        alreadyReportedCodes={reportModalAlreadyCodes}
        onSubmit={handleReportModalSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  swipeTutorialOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 9999,
    elevation: 9999,
  },
  swipeTutorialFullDimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 0,
    elevation: 0,
  },
  swipeTutorialDimLayer: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 0,
    elevation: 0,
  },
  swipeTutorialCornerCover: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 0,
    elevation: 0,
  },
  swipeTutorialTargetFrame: {
    position: 'absolute',
    borderWidth: moderateScale(2),
    borderColor: '#F98A21',
    backgroundColor: 'transparent',
    shadowColor: '#F98A21',
    shadowOpacity: 0.5,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 0 },
    zIndex: 1,
    elevation: 10000,
  },
  swipeTutorialCoachmarkGroup: {
    position: 'absolute',
    zIndex: 2,
    elevation: 10001,
  },
  swipeTutorialCard: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: moderateScale(22),
    padding: scale(18),
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: moderateScale(16),
    shadowOffset: { width: 0, height: verticalScale(8) },
    zIndex: 2,
    elevation: 10001,
  },
  swipeTutorialCardInGroup: {
    position: 'relative',
  },
  swipeTutorialStepPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(249,138,33,0.14)',
    marginBottom: verticalScale(10),
  },
  swipeTutorialStepText: {
    ...typography.styles.caption,
    color: '#F98A21',
    fontWeight: '700',
  },
  swipeTutorialTitle: {
    ...typography.styles.subtitle,
    fontWeight: '800',
    flex: 1,
  },
  swipeTutorialTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: verticalScale(6),
  },
  swipeTutorialDescription: {
    ...typography.styles.body,
    lineHeight: moderateScale(21),
  },
  swipeTutorialSwipeHint: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: scale(10),
    zIndex: 2,
    elevation: 10001,
  },
  swipeTutorialSwipeBadge: {
    width: scale(148),
    minHeight: verticalScale(34),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F98A21',
    overflow: 'hidden',
    shadowColor: '#F98A21',
    shadowOpacity: 0.28,
    shadowRadius: moderateScale(6),
    shadowOffset: { width: 0, height: verticalScale(3) },
    elevation: 6,
  },
  swipeTutorialSwipeBadgeLeft: {
    borderTopLeftRadius: moderateScale(28),
    borderBottomLeftRadius: moderateScale(10),
    borderTopRightRadius: moderateScale(16),
    borderBottomRightRadius: moderateScale(26),
    transform: [{ skewX: '-5deg' }],
  },
  swipeTutorialSwipeBadgeRight: {
    borderTopLeftRadius: moderateScale(16),
    borderBottomLeftRadius: moderateScale(26),
    borderTopRightRadius: moderateScale(28),
    borderBottomRightRadius: moderateScale(10),
    transform: [{ skewX: '5deg' }],
  },
  swipeTutorialSwipeBadgeGlow: {
    position: 'absolute',
    width: scale(34),
    height: scale(34),
    borderRadius: moderateScale(17),
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  swipeTutorialSwipeBadgeGlowLeft: {
    left: scale(-12),
    top: verticalScale(-8),
  },
  swipeTutorialSwipeBadgeGlowRight: {
    right: scale(-12),
    top: verticalScale(-8),
  },
  swipeTutorialSwipeBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: verticalScale(5),
    paddingHorizontal: scale(8),
  },
  swipeTutorialSwipeBadgeContentLeft: {
    transform: [{ skewX: '5deg' }],
  },
  swipeTutorialSwipeBadgeContentRight: {
    transform: [{ skewX: '-5deg' }],
  },
  swipeTutorialSwipeHintText: {
    ...typography.styles.caption,
    textAlign: 'center',
    color: '#FFFFFF',
    fontWeight: '800',
  },
  swipeTutorialArrowDown: {
    position: 'absolute',
    bottom: verticalScale(-10),
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: scale(10),
    borderRightWidth: scale(10),
    borderTopWidth: verticalScale(10),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#F98A21',
  },
  swipeTutorialArrowUp: {
    position: 'absolute',
    bottom: verticalScale(-10),
    alignSelf: 'center',
    width: scale(18),
    height: scale(18),
    borderRadius: moderateScale(4),
    backgroundColor: '#F98A21',
    transform: [{ rotate: '45deg' }],
  },
  swipeTutorialActions: {
    marginTop: verticalScale(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  swipeTutorialGhostButton: {
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(4),
  },
  swipeTutorialGhostText: {
    ...typography.styles.button,
    fontWeight: '700',
  },
  swipeTutorialNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  swipeTutorialBackButton: {
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(14),
  },
  swipeTutorialDisabledButton: {
    opacity: 0.42,
  },
  swipeTutorialBackText: {
    ...typography.styles.button,
    fontWeight: '700',
  },
  swipeTutorialNextButton: {
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(16),
    backgroundColor: '#F98A21',
  },
  swipeTutorialNextText: {
    ...typography.styles.button,
    color: '#FFFFFF',
    fontWeight: '800',
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
    ...Platform.select({
      ios: {
        marginBottom: verticalScale(84),
      },
      android: {
        marginBottom: verticalScale(94),
      },
    })
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
    ...Platform.select({
      ios: {
        bottom: verticalScale(60),
      },
      android: {
        bottom: verticalScale(68),
      },
    }),
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
  completionContent: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(18),
  },
  completionHero: {
    width: '100%',
    alignItems: 'center',
    zIndex: 1,
    marginBottom: verticalScale(22),
  },
  completionHeroCard: {
    width: '100%',
    alignItems: 'center',
    borderRadius: moderateScale(30),
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(28),
    paddingHorizontal: scale(20),
    overflow: 'hidden',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: verticalScale(8) },
    shadowOpacity: 0.22,
    shadowRadius: moderateScale(14),
    elevation: 5,
  },
  completionHeroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    marginBottom: verticalScale(16),
  },
  completionHeroMetricCircle: {
    width: scale(136),
    height: scale(136),
    borderRadius: moderateScale(68),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  completionTitle: {
    textAlign: 'center',
    marginBottom: 0,
  },
  completionHeroMetric: {
    fontSize: moderateScale(52),
    fontWeight: '800',
    lineHeight: verticalScale(56),
  },
  completionHeroLabel: {
    fontWeight: '700',
  },
  completionHeroSessionStats: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: verticalScale(20),
  },
  completionHeroSessionStat: {
    flex: 1,
    alignItems: 'center',
  },
  completionHeroSessionNumber: {
    color: '#FFFFFF',
    fontSize: moderateScale(24),
    fontWeight: '800',
  },
  completionHeroSessionLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: moderateScale(12),
    marginTop: verticalScale(2),
    textAlign: 'center',
  },
  completionHeroSessionDivider: {
    width: StyleSheet.hairlineWidth,
    height: verticalScale(36),
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  completionSectionHeader: {
    width: '100%',
    marginBottom: verticalScale(10),
    fontWeight: '700',
    paddingHorizontal: scale(4),
  },
  completionStatGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: scale(10),
    paddingHorizontal: scale(12),
    marginTop: verticalScale(-30),
    marginBottom: verticalScale(18),
    zIndex: 2,
  },
  completionStatCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: moderateScale(18),
    padding: scale(14),
    minHeight: verticalScale(118),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(6),
    elevation: 1,
  },
  completionStatIcon: {
    width: scale(34),
    height: scale(34),
    borderRadius: moderateScale(17),
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionStatNumber: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    marginTop: verticalScale(8),
  },
  completionStatLabel: {
    marginTop: verticalScale(2),
    textAlign: 'center',
  },
  emptyCompletionContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(24),
  },
  emptyCompletionIcon: {
    fontSize: moderateScale(44),
    marginBottom: verticalScale(16),
  },
  emptyCompletionTitle: {
    textAlign: 'center',
    marginBottom: verticalScale(20),
  },
  emptyCompletionInfo: {
    width: '100%',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: moderateScale(22),
    padding: scale(18),
    marginBottom: verticalScale(24),
  },
  emptyCompletionTime: {
    marginTop: verticalScale(6),
    textAlign: 'center',
  },
  completionChapterCard: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: moderateScale(22),
    padding: scale(18),
    marginBottom: verticalScale(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(6),
    elevation: 1,
  },
  completionChapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completionChapterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  completionChapterProgressValue: {
    fontSize: moderateScale(24),
    fontWeight: '800',
  },
  completionChapterProgressTrack: {
    height: verticalScale(12),
    borderRadius: moderateScale(6),
    overflow: 'hidden',
    marginTop: verticalScale(16),
  },
  completionChapterProgressFill: {
    height: '100%',
    borderRadius: moderateScale(6),
  },
  completionChapterPercent: {
    marginTop: verticalScale(7),
  },
  completionChapterMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
    marginTop: verticalScale(16),
  },
  completionChapterDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: verticalScale(18),
  },
  completionReviewGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: scale(10),
  },
  completionReviewItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: verticalScale(6),
  },
  completionReviewTextGroup: {
    minHeight: verticalScale(42),
    justifyContent: 'center',
    alignItems: 'center',
  },
  completionReviewCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: moderateScale(18),
    padding: scale(14),
    minHeight: verticalScale(106),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(6),
    elevation: 1,
  },
  completionReviewMetric: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    textAlign: 'center',
  },
  completionReviewLabel: {
    marginTop: verticalScale(1),
    textAlign: 'center',
  },
  completionHeading: {
    width: '100%',
    marginTop: verticalScale(14),
    marginBottom: verticalScale(6),
  },
  completionCard: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: moderateScale(8),
    padding: scale(12),
    marginBottom: verticalScale(8),
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: moderateScale(8),
    elevation: 2,
  },
  completionSessionCount: {
    ...typography.styles.h2,
    textAlign: 'center',
  },
  completionSectionLabel: {
    ...typography.styles.body,
    textAlign: 'center',
    marginTop: verticalScale(2),
    marginBottom: verticalScale(8),
  },
  completionRow: {
    gap: verticalScale(8),
  },
  completionInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
  },
  completionInlineDivider: {
    width: StyleSheet.hairlineWidth,
    height: verticalScale(16),
  },
  completionProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: verticalScale(10),
  },
  completionProgressTrack: {
    flex: 1,
    height: verticalScale(8),
    borderRadius: moderateScale(8),
    overflow: 'hidden',
  },
  completionProgressFill: {
    height: '100%',
    borderRadius: moderateScale(8),
  },
  completionProgressText: {
    ...typography.styles.body,
    fontWeight: '700',
  },
  completionReviewTime: {
    ...typography.styles.h2,
    marginTop: verticalScale(12),
    marginBottom: verticalScale(4),
  },
  completionButton: {
    width: '100%',
    minHeight: verticalScale(52),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: moderateScale(18),
    paddingHorizontal: scale(16),
  },
  completionCtaArea: {
    width: '100%',
    marginTop: verticalScale(4),
    marginBottom: verticalScale(28),
  },
  completionButtonRow: {
    width: '100%',
    flexDirection: 'row',
    gap: scale(10),
    alignItems: 'flex-start',
  },
  completionButtonHalf: {
    flex: 1,
    width: undefined,
  },
  nextChapterButton: {
    backgroundColor: 'transparent',
    borderWidth: moderateScale(1),
  },
  nextChapterWrap: {
    flex: 1,
  },
  nextChapterMeta: {
    ...typography.styles.body,
    textAlign: 'center',
    flex: 1,
    marginTop: verticalScale(6),
  },
  completionNextMetaRow: {
    flexDirection: 'row',
    gap: scale(10),
  },
  completionNextMetaSpacer: {
    flex: 1,
  },
  completionReviewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(12),
    paddingTop: verticalScale(8),
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
