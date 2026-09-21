import React, { memo, useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Platform, BackHandler, ScrollView, Image } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withRepeat,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
import SwipeCardDeck from '../../components/layout/SwipeCardDeck';
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

// --- Alt kontrol butonu ---
const AnimatedTimeButton = ({ onPress, icon, text, buttonStyle, textStyle, iconColor }) => {
  const isPressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
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

const AnimatedActionPressable = Reanimated.createAnimatedComponent(Pressable);
const ACTION_ENTRANCE_OFFSET = verticalScale(8);

const SwipeCardActions = memo(function SwipeCardActions({
  cardId,
  cardWidth,
  isFavorite,
  favoriteColor,
  onFavoritePress,
  swipeX,
  flipProgress,
  entranceProgress,
  entranceOpacity,
}) {
  // This timeline intentionally mirrors SwipeFlipCard.contentEntranceStyle.
  // The action row is outside the ScrollView/face content, but it uses the
  // exact same shared entrance/fade values as the card content.
  const actionEntranceStyle = useAnimatedStyle(() => {
    const x = swipeX?.value ?? 0;
    const labelDistance = Math.max(80, cardWidth * 0.28);
    const fadeStart = labelDistance * 0.55;
    const fadeEnd = labelDistance * 0.68;
    const swipeFade = interpolate(
      Math.abs(x),
      [fadeStart, fadeEnd],
      [1, 0],
      'clamp'
    );

    const entrance = entranceProgress?.value ?? 1;
    const opacity = entranceOpacity?.value ?? 1;

    return {
      opacity: opacity * swipeFade,
      transform: [
        { translateY: (1 - entrance) * ACTION_ENTRANCE_OFFSET },
        { scale: 0.96 + (0.04 * entrance) },
      ],
    };
  }, [cardWidth, entranceOpacity, entranceProgress, swipeX]);

  // The action row itself never participates in the card content ScrollView.
  // Only the visual heart faces use the same Y-axis flip timeline as the card.
  const frontFlipStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${180 * (flipProgress?.value ?? 0)}deg` },
    ],
  }), [flipProgress]);

  const backFlipStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${180 + (180 * (flipProgress?.value ?? 0))}deg` },
    ],
  }), [flipProgress]);

  const handlePress = useCallback(() => {
    triggerHaptic('medium');
    onFavoritePress?.(cardId);
  }, [cardId, onFavoritePress]);

  const favoriteIcon = isFavorite ? 'solar:heart-bold' : 'solar:heart-broken';
  const favoriteIconColor = isFavorite ? favoriteColor : '#FFF7ED';

  return (
    <View
      pointerEvents="box-none"
      style={styles.cardActionRow}
    >
      <AnimatedActionPressable
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? 'Favorilerden kaldır' : 'Favorilere ekle'}
        onPress={handlePress}
        hitSlop={{
          top: scale(10),
          bottom: scale(10),
          left: scale(10),
          right: scale(10),
        }}
        style={[styles.cardActionButton, actionEntranceStyle]}
      >
        <Reanimated.View
          pointerEvents="none"
          style={styles.cardActionIconStage}
        >
          <Reanimated.View
            style={[styles.cardActionIconFace, styles.cardActionIconFrontFace, frontFlipStyle]}
          >
            <Iconify
              icon={favoriteIcon}
              size={moderateScale(25)}
              color={favoriteIconColor}
            />
          </Reanimated.View>

          <Reanimated.View
            style={[styles.cardActionIconFace, styles.cardActionIconBackFace, backFlipStyle]}
          >
            <Iconify
              icon={favoriteIcon}
              size={moderateScale(25)}
              color={favoriteIconColor}
            />
          </Reanimated.View>
        </Reanimated.View>
      </AnimatedActionPressable>
    </View>
  );
});

export default function SwipeDeckScreen({ route, navigation }) {
  const { deck, chapter } = route.params || {};
  const { colors } = useTheme();
  const { session } = useAuth();
  const authUserId = session?.user?.id;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();

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

  const CARD_WIDTH = cardDimensions.width;
  const CARD_HEIGHT = cardDimensions.height;

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const pendingIncomingCardsRef = useRef([]);
  const cardsRef = useRef([]);

  const prefetchCardImages = useCallback((list) => {
    if (!Array.isArray(list)) return;
    list.slice(0, 4).forEach((card) => {
      const uri = card?.cards?.image;
      if (uri) Image.prefetch(uri).catch(() => { });
    });
  }, []);

  const activeCardId = cards[currentIndex]?.card_id;
  const activeCardsLength = Math.max(0, cards.length - currentIndex);

  useEffect(() => {
    prefetchCardImages(cards.slice(currentIndex, currentIndex + 4));
  }, [currentIndex, prefetchCardImages]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const [userId, setUserId] = useState(null);
  const [leftCount, setLeftCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const swipeDeckRef = useRef(null);
  const activeFlipRef = useRef(null);
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
  const leftCountedCardIds = useRef(new Set());
  const historyLeftCardIds = useRef([]);
  const sessionIdRef = useRef(null);
  const paginationCursorRef = useRef({
    afterSortKey: null,
    afterQueueId: null,
  });
  const currentPositionCursorRef = useRef({
    currentSortKey: null,
    currentQueueId: null,
  });
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
  const SWIPE_ANIMATION_MS = 450;
  const REVIEW_PROMPT_DELAY_MS = 600;
  const PRE_FETCH_THRESHOLD = 5;
  const seenCardIdsRef = useRef(new Set());
  const sessionSeenCardIdsRef = useRef(new Set());
  const sessionProgressCountRef = useRef(0);
  const historyStateSnapshotsRef = useRef([]);
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
    // The tutorial only needs the initial top card. Measuring/rebinding this
    // ref after every swipe makes the card subtree participate in parent
    // reconciliation for no visual reason.
    if (currentIndex !== 0 || !activeCardId) return;
    if (firstRenderedCardId !== activeCardId) {
      setFirstRenderedCardId(activeCardId);
    }
    measureTutorialTarget(cardTutorialTargetRef, setCardTargetLayout);
  }, [currentIndex, activeCardId, firstRenderedCardId, width, height, measureTutorialTarget]);

  useEffect(() => {
    if (activeCardsLength > 0) {
      measureTutorialTarget(intervalTutorialTargetRef, setIntervalTargetLayout);
    }
  }, [activeCardsLength, width, height, insets.bottom, measureTutorialTarget]);

  useEffect(() => {
    const hasWorkableCard = activeCardsLength > 0 && Boolean(activeCardId);
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
  }, [loading, cards.length, currentIndex, originalFlowComplete, activeCardsLength, activeCardId, firstRenderedCardId]);

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

  useLayoutEffect(() => {
    const currentCard = cards[currentIndex];

    navigation.setOptions({
      // Header her zaman layout'ta kalsın.
      // Böylece loading -> swipe geçişinde ekran yüksekliği değişmez.
      headerShown: true,

      // Görsel AppBar yok.
      headerTransparent: true,
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerTintColor: '#FFFFFF',
      title: '',

      // Loading sırasında geri oku gizle.
      // Normal swipe ekranında navigator'ın kendi geri oku geri gelir.
      headerLeft: loading
        ? () => null
        : undefined,

      // Loading sırasında sağdaki araçları gizle.
      // Kart hazır olduğunda normal araçlar görünür.
      headerRight: () => {
        if (loading || !currentCard) {
          return null;
        }

        return (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: scale(16),
              paddingHorizontal: scale(8),
            }}
          >
            {!isOwner && (
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  openReportCardModal();
                }}
                activeOpacity={0.7}
                hitSlop={{
                  top: scale(15),
                  bottom: scale(15),
                  left: scale(8),
                  right: scale(8),
                }}
              >
                <Iconify
                  icon="ic:round-report-problem"
                  size={moderateScale(24)}
                  color="#FED7AA"
                />
              </TouchableOpacity>
            )}
          </View>
        );
      },
    });
  }, [
    navigation,
    cards,
    currentIndex,
    loading,
    isOwner,
    openReportCardModal,
  ]);

  const getCategoryColors = (sortOrder) => {
    if (colors.categoryColors && colors.categoryColors[sortOrder]) {
      return colors.categoryColors[sortOrder];
    }
    return ['#A88D6B', '#7A5F3A'];
  };

  const leftInactiveColor = '#f3a14c';
  const leftActiveColor = colors.buttonColor;
  const rightInactiveColor = '#6faa72';
  const rightActiveColor = '#3e8e41';

  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);
      setRightCount(0);
      setLeftCount(0);
      seenCardIdsRef.current = new Set();
      sessionSeenCardIdsRef.current = new Set();
      sessionProgressCountRef.current = 0;
      historyStateSnapshotsRef.current = [];
      leftCountedCardIds.current = new Set();
      historyLeftCardIds.current = [];
      setSessionTargetCount(0);
      setCompletionSummary(null);
      setNextChapter(null);
      hasMoreCardsRef.current = true;

      try {
        setUserId(authUserId);
        const chapterId = typeof chapter === 'undefined'
          ? null
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

        cardsRef.current = learningCards;
        setCards(learningCards);
        prefetchCardImages(learningCards);
        currentIndexRef.current = 0;
        const lastFetchedCard = learningCards[learningCards.length - 1];
        if (lastFetchedCard) {
          paginationCursorRef.current = {
            afterSortKey: lastFetchedCard.sort_key,
            afterQueueId: lastFetchedCard.queue_id,
          };
        }
        seenCardIdsRef.current = new Set(learningCards.map(c => c.card_id));
        sessionSeenCardIdsRef.current = learningCards[0]?.card_id
          ? new Set([learningCards[0].card_id])
          : new Set();
        const initialProgressCount = learningCards.length > 0 ? 1 : 0;
        sessionProgressCountRef.current = initialProgressCount;
        setSessionProgressCount(initialProgressCount);
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
        mergeChapterProgressIntoCache(deck.id, authUserId, statsChapterId).catch(() => { });
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

  // A single UI-thread shared value mirrors the active card's horizontal swipe.
  // During the gesture we never preview the next numeric value: the relevant
  // counter shows its existing icon instead, while the real number stays hidden.
  // When the swipe finishes, only the real React count changes. No second
  // post-swipe counter animation is triggered.
  const activeSwipeX = useSharedValue(0);
  const counterSwipeDistance = Math.max(scale(90), CARD_WIDTH * 0.28);

  // The swipe itself drives the counter color/icon. After the swipe has
  // committed, the new numeric value gets one small, separate pop so the
  // count feels updated without relying on the old highlight animation.
  const leftCounterPop = useSharedValue(1);
  const rightCounterPop = useSharedValue(1);

  useEffect(() => {
    if (leftCount <= 0) return;
    // Quick pop: overshoot, dip slightly, then settle. This is intentionally
    // punchier than the previous grow -> pause -> shrink feeling.
    leftCounterPop.value = withSequence(
      withTiming(1.11, { duration: 45 }),
      withTiming(1, { duration: 65 })
    );
  }, [leftCount, leftCounterPop]);

  useEffect(() => {
    if (rightCount <= 0) return;
    rightCounterPop.value = withSequence(
      withTiming(1.11, { duration: 45 }),
      withTiming(1, { duration: 65 })
    );
  }, [rightCount, rightCounterPop]);

  const animatedLeftCounterPop = useAnimatedStyle(() => ({
    transform: [{ scale: leftCounterPop.value }],
  }));

  const animatedRightCounterPop = useAnimatedStyle(() => ({
    transform: [{ scale: rightCounterPop.value }],
  }));

  const animatedLeftCounter = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, -activeSwipeX.value / Math.max(1, counterSwipeDistance)));
    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 1],
        [leftInactiveColor, leftActiveColor]
      ),
    };
  }, [counterSwipeDistance, leftActiveColor, leftInactiveColor]);

  const animatedRightCounter = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, activeSwipeX.value / Math.max(1, counterSwipeDistance)));
    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 1],
        [rightInactiveColor, rightActiveColor]
      ),
    };
  }, [counterSwipeDistance, rightActiveColor, rightInactiveColor]);

  const animatedLeftCount = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, -activeSwipeX.value / Math.max(1, counterSwipeDistance)));
    return {
      opacity: interpolate(progress, [0, 0.14, 0.28], [1, 0.5, 0], 'clamp'),
    };
  }, [counterSwipeDistance]);

  const animatedRightCount = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, activeSwipeX.value / Math.max(1, counterSwipeDistance)));
    return {
      opacity: interpolate(progress, [0, 0.14, 0.28], [1, 0.5, 0], 'clamp'),
    };
  }, [counterSwipeDistance]);

  const animatedLeftIcon = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, -activeSwipeX.value / Math.max(1, counterSwipeDistance)));
    return {
      opacity: interpolate(progress, [0, 0.10, 0.30], [0, 0.28, 1], 'clamp'),
      transform: [{ scale: interpolate(progress, [0, 0.16, 0.34], [0.78, 0.94, 1], 'clamp') }],
    };
  }, [counterSwipeDistance]);

  const animatedRightIcon = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, activeSwipeX.value / Math.max(1, counterSwipeDistance)));
    return {
      opacity: interpolate(progress, [0, 0.10, 0.30], [0, 0.28, 1], 'clamp'),
      transform: [{ scale: interpolate(progress, [0, 0.16, 0.34], [0.78, 0.94, 1], 'clamp') }],
    };
  }, [counterSwipeDistance]);

  const currentProgress = sessionTargetCount > 0
    ? Math.min(100, (sessionProgressCount / sessionTargetCount) * 100)
    : 0;

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${currentProgress}%`, { duration: 300 }),
    };
  });

  const shimmerTranslate = useSharedValue(-1);

  useEffect(() => {
    shimmerTranslate.value = withRepeat(
      withTiming(2, { duration: 2000 }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => {
    return {
      left: `${shimmerTranslate.value * 100}%`,
    };
  });

  const normalizeIncomingCards = useCallback((incomingCards) => {
    if (!Array.isArray(incomingCards) || incomingCards.length === 0) return [];

    const unique = new Map();
    incomingCards.forEach((card) => {
      const key = card?.queue_id != null
        ? String(card.queue_id)
        : String(card?.card_id || '');
      if (!key || unique.has(key)) return;
      unique.set(key, card);
    });
    return [...unique.values()];
  }, []);

  const mergeIncomingCardsNow = useCallback((incomingCards) => {
    const normalized = normalizeIncomingCards(incomingCards);
    if (normalized.length === 0) return;

    const prev = cardsRef.current;
    const activeIndex = Math.min(Math.max(currentIndexRef.current, 0), prev.length - 1);
    const safeActiveIndex = prev.length > 0 ? activeIndex : -1;
    const consumed = safeActiveIndex >= 0 ? prev.slice(0, safeActiveIndex + 1) : [];
    const upcoming = safeActiveIndex >= 0 ? prev.slice(safeActiveIndex + 1) : [...prev];

    const upcomingKeys = new Set(
      upcoming
        .map((c) => c?.queue_id != null ? String(c.queue_id) : String(c?.card_id || ''))
        .filter(Boolean)
    );
    const keysToMerge = new Set();

    const cardsToMerge = normalized.filter((c) => {
      const key = c?.queue_id != null ? String(c.queue_id) : String(c?.card_id || '');
      if (!key || upcomingKeys.has(key) || keysToMerge.has(key)) return false;
      keysToMerge.add(key);
      return true;
    });

    // Never reorder the already-visible queue. In particular, keep the
    // immediate next card protected so an async fetch/reinsert cannot swap
    // the card underneath the active one for a frame. New cards are appended
    // after the existing upcoming queue.
    const protectedNext = upcoming.slice(0, 1);
    const remainingUpcoming = upcoming.slice(1);
    const mergedUpcoming = [...protectedNext, ...remainingUpcoming, ...cardsToMerge];

    const merged = [...consumed, ...mergedUpcoming];
    cardsRef.current = merged;
    setCards(merged);
    prefetchCardImages(merged);
  }, [normalizeIncomingCards, prefetchCardImages]);

  const commitIncomingCards = useCallback((incomingCards) => {
    const normalized = normalizeIncomingCards(incomingCards);
    if (normalized.length === 0) return;

    if (isAnimatingRef.current) {
      const current = normalizeIncomingCards(pendingIncomingCardsRef.current);
      const existing = new Set(
        current.map((c) => c?.queue_id != null ? String(c.queue_id) : String(c?.card_id || '')).filter(Boolean)
      );
      pendingIncomingCardsRef.current = [
        ...current,
        ...normalized.filter((c) => {
          const key = c?.queue_id != null ? String(c.queue_id) : String(c?.card_id || '');
          if (!key || existing.has(key)) return false;
          existing.add(key);
          return true;
        }),
      ];
      return;
    }

    mergeIncomingCardsNow(normalized);
  }, [mergeIncomingCardsNow, normalizeIncomingCards]);

  const flushPendingIncomingCards = useCallback(() => {
    if (isAnimatingRef.current) return;
    if (pendingIncomingCardsRef.current.length === 0) return;

    const pending = pendingIncomingCardsRef.current;
    pendingIncomingCardsRef.current = [];
    mergeIncomingCardsNow(pending);
  }, [mergeIncomingCardsNow]);

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

      const activeIndex = currentIndexRef.current;
      const upcomingQueueIds = new Set(
        cardsRef.current
          .slice(activeIndex + 1)
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
        commitIncomingCards(newCards);
      } else if (moreCards.length === 0) {
        hasMoreCardsRef.current = false;
      }
    } catch (error) {
      console.error('Error fetching more cards:', error);
    } finally {
      isFetchingMoreRef.current = false;
    }
  }, [userId, commitIncomingCards]);

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

      const activeIndex = currentIndexRef.current;
      const upcomingQueueIds = new Set(
        cardsRef.current
          .slice(activeIndex + 1)
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
        commitIncomingCards(newCards);
      }
    } catch (error) {
      console.error('Error checking due reinserts:', error);
    } finally {
      isDueCheckingRef.current = false;
    }
  }, [commitIncomingCards]);

  const handleSwipe = useCallback(async (cardIndex, direction, meta = null) => {
    if (showSwipeTutorial) return;

    const sourceCards = cardsRef.current;
    const card = sourceCards[cardIndex];
    if (!card) return;

    const actualDirection = meta?.type === 'skip' ? 'skip' : direction;
    const actualSkipMinutes = meta?.skipMinutes ?? null;
    const swipedCardId = card.card_id;

    // The custom deck has already completed the off-screen animation.
    // Only now does React advance the logical index, so the preview card
    // becomes active without a second swiper/index reconciliation step.
    const nextIndex = cardIndex + 1;
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    isAnimatingRef.current = false;

    if (actualDirection === 'left') {
      triggerHaptic('selection');
    } else if (actualDirection === 'right') {
      triggerHaptic('light');
    }

    historyStateSnapshotsRef.current.push({
      sessionSeenCardIds: new Set(sessionSeenCardIdsRef.current),
      sessionProgressCount: sessionProgressCountRef.current,
      leftCountedCardIds: new Set(leftCountedCardIds.current),
      historyLeftCardIds: [...historyLeftCardIds.current],
    });

    sessionSeenCardIdsRef.current.add(swipedCardId);
    const nextCard = sourceCards[cardIndex + 1];
    if (nextCard?.card_id) {
      sessionSeenCardIdsRef.current.add(nextCard.card_id);
    }

    const nextProgressCount = sessionTargetCount > 0
      ? Math.min(sessionTargetCount, sessionSeenCardIdsRef.current.size)
      : sessionSeenCardIdsRef.current.size;
    sessionProgressCountRef.current = nextProgressCount;
    setSessionProgressCount(nextProgressCount);

    // Update the visible counter immediately when the swipe commits.
    // Do this before the async server write so the icon never falls back to
    // the previous number for a frame after the card leaves.
    if (actualDirection === 'right') {
      setRightCount((prev) => prev + 1);
      learnedRuntimeState.deltaLearned += 1;
      estimatedTotalLearnedRef.current += 1;
      scheduleReviewCheck({ delayMs: REVIEW_PROMPT_DELAY_MS, requireMilestoneHit: true });
    } else if (actualDirection === 'left' || actualDirection === 'skip') {
      if (actualDirection === 'left') {
        historyLeftCardIds.current.push(card.card_id);
      }
      leftCountedCardIds.current.add(card.card_id);
      setLeftCount((prev) => prev + 1);
    }

    if (!userId) return;

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

    checkDueReinserts();
    requestAnimationFrame(() => {
      flushPendingIncomingCards();
    });
  }, [
    checkDueReinserts,
    flushPendingIncomingCards,
    scheduleReviewCheck,
    sessionTargetCount,
    showSwipeTutorial,
    userId,
  ]);

  const handleSwipeStart = useCallback(() => {
    if (showSwipeTutorial) return;
    isAnimatingRef.current = true;
  }, [showSwipeTutorial]);

  const handleSwipeCancelled = useCallback(() => {
    isAnimatingRef.current = false;
  }, []);

  const handleCardTap = useCallback(() => {
    if (showSwipeTutorial || loading || isAnimatingRef.current) return;
    activeFlipRef.current?.flip?.();
  }, [loading, showSwipeTutorial]);

  const handleSkip = useCallback((minutes) => {
    if (showSwipeTutorial) return;
    if (isAnimatingRef.current) return;
    if (!cardsRef.current[currentIndexRef.current]) return;
    if (!userId) return;
    swipeDeckRef.current?.swipeLeft({ type: 'skip', skipMinutes: minutes });
  }, [showSwipeTutorial, userId]);

  const handleUndo = async () => {
    if (showSwipeTutorial) return;
    if (undoDisabled || history.length === 0 || !sessionIdRef.current) return;
    if (isAnimatingRef.current) return;

    setUndoDisabled(true);

    const lastIndex = history[history.length - 1];
    const undoneCard = cards[lastIndex];
    const lastDirection = historyDirections[historyDirections.length - 1];

    try {
      const result = await undoLastSwipe({ sessionId: sessionIdRef.current });
      if (result?.success === false && result?.reason === 'empty_stack') {
        return;
      }

      if ((lastDirection === 'left' || lastDirection === 'skip') && undoneCard) {
        setLeftCount((c) => Math.max(0, c - 1));
      } else if (lastDirection === 'right') {
        learnedRuntimeState.deltaLearned = Math.max(0, learnedRuntimeState.deltaLearned - 1);
        estimatedTotalLearnedRef.current = Math.max(0, estimatedTotalLearnedRef.current - 1);
        setRightCount((c) => Math.max(0, c - 1));
      }

      if (lastDirection) {
        const previousState = historyStateSnapshotsRef.current.pop();
        if (previousState) {
          sessionSeenCardIdsRef.current = new Set(previousState.sessionSeenCardIds);
          sessionProgressCountRef.current = previousState.sessionProgressCount;
          leftCountedCardIds.current = new Set(previousState.leftCountedCardIds);
          historyLeftCardIds.current = [...previousState.historyLeftCardIds];
          setSessionProgressCount(previousState.sessionProgressCount);
        }
        setTotalSwipeCount((c) => Math.max(0, c - 1));
        setHistory((prev) => prev.slice(0, -1));
        setHistoryDirections((prev) => prev.slice(0, -1));
      }

      paginationCursorRef.current = { afterSortKey: null, afterQueueId: null };
      currentPositionCursorRef.current = { currentSortKey: null, currentQueueId: null };

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

      cardsRef.current = learningCards;
      setCards(learningCards);
      prefetchCardImages(learningCards);
      currentIndexRef.current = 0;
      setCurrentIndex(0);
      seenCardIdsRef.current = new Set(learningCards.map(c => c.card_id));
      hasMoreCardsRef.current = learningCards.length > 0;

      const lastFetchedCard = learningCards[learningCards.length - 1];
      if (lastFetchedCard) {
        paginationCursorRef.current = {
          afterSortKey: lastFetchedCard.sort_key,
          afterQueueId: lastFetchedCard.queue_id,
        };
      }
    } catch (error) {
      console.error('Failed to undo swipe session action:', error);
    } finally {
      setTimeout(() => {
        setUndoDisabled(false);
      }, 350);
    }
  };

  const handleSwipeCommitted = useCallback((cardIndex, direction, meta) => {
    handleSwipe(cardIndex, direction, meta);
  }, [handleSwipe]);

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

  useEffect(() => {
    if (!autoPlay) return;
    if (currentIndex >= cards.length) {
      setAutoPlay(false);
      return;
    }

    autoPlayFlipTimeout.current = setTimeout(() => {
      activeFlipRef.current?.flip?.();
      autoPlayTimeout.current = setTimeout(() => {
        if (!isAnimatingRef.current) {
          swipeDeckRef.current?.swipeLeft();
        }
      }, 1600);
    }, 1600);

    return () => {
      if (autoPlayTimeout.current) clearTimeout(autoPlayTimeout.current);
      if (autoPlayFlipTimeout.current) clearTimeout(autoPlayFlipTimeout.current);
    };
  }, [autoPlay, currentIndex, cards.length]);

  useEffect(() => {
    return () => {
      if (autoPlayTimeout.current) clearTimeout(autoPlayTimeout.current);
      if (autoPlayFlipTimeout.current) clearTimeout(autoPlayFlipTimeout.current);
    };
  }, []);

  const texts = [
    t('swipeDeck.swipe.tapLearn', 'Tıkla!\nÇevir ve Öğren'),
    t('swipeDeck.swipe.swipeRight', 'Sağa Kaydır!\nBildim'),
    t('swipeDeck.swipe.swipeLeft', 'Sola Kaydır!\nTekrar Et'),
    t('swipeDeck.swipe.chooseTime', 'Tekrar Zamanını Seç..'),
  ];

  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // Eski text'i çıkar
      opacity.value = withTiming(0, { duration: 250 });
      translateX.value = withTiming(-15, { duration: 250 });

      // Text'i JS tarafında değiştir
      setTimeout(() => {
        setTextIndex((prev) => (prev + 1) % texts.length);

        // Yeni text sağdan gelsin
        translateX.value = 15;

        opacity.value = withTiming(1, { duration: 300 });
        translateX.value = withTiming(0, { duration: 300 });
      }, 250);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      {
        translateX: translateX.value,
      },
    ],
  }));
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

  const renderSwipeCard = useCallback((card, {
    isActive,
    swipeX,
    flipProgress,
    entranceProgress,
    entranceOpacity,
  } = {}) => {
    const cardId = card?.card_id;
    const gradientColors = getCategoryColors(categorySortOrder);
    const isPlaceholder = !card || !card.cards;

    return (
      <View
        ref={isActive ? cardTutorialTargetRef : undefined}
        collapsable={false}
        style={styles.swiperRenderCardWrapper}
      >
        <SwipeFlipCard
          ref={isActive ? activeFlipRef : undefined}
          card={card}
          cardId={cardId}
          isPlaceholder={isPlaceholder}
          isActive={Boolean(isActive)}
          cardWidth={CARD_WIDTH}
          cardHeight={CARD_HEIGHT}
          gradientColors={gradientColors}
          cardBackground={colors.cardBackground}
          textColor={colors.text}
          swipeX={swipeX}
          flipProgress={flipProgress}
          entranceProgress={entranceProgress}
          entranceOpacity={entranceOpacity}
          leftSwipeAccentColor={leftActiveColor}
          rightSwipeAccentColor={rightActiveColor}
        />
      </View>
    );
  }, [CARD_HEIGHT, CARD_WIDTH, categorySortOrder, colors.cardBackground, colors.text, getCategoryColors, leftActiveColor, rightActiveColor]);

  const renderSwipeCardActions = useCallback((card, params = {}) => {
    const {
      isActive,
      swipeX,
      flipProgress,
      entranceProgress,
      entranceOpacity,
    } = params;

    if (!isActive || !card?.card_id) return null;

    return (
      <SwipeCardActions
        cardId={card.card_id}
        cardWidth={CARD_WIDTH}
        isFavorite={favoriteIds.has(card.card_id)}
        favoriteColor={colors.buttonColor}
        onFavoritePress={toggleFavorite}
        swipeX={swipeX}
        flipProgress={flipProgress}
        entranceProgress={entranceProgress}
        entranceOpacity={entranceOpacity}
      />
    );
  }, [CARD_WIDTH, colors.buttonColor, favoriteIds, toggleFavorite]);

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
      <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom, paddingTop: insets.top + scale(50) }]}>
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
      <View style={styles.swipeTutorialOverlay} pointerEvents="auto" onTouchStart={() => { }}>
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
    <View
      ref={tutorialOverlayRootRef}
      collapsable={false}
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
          backgroundColor: colors.background,
          marginTop: '20%'
        }
      ]}
    >
      {/* 1. Üst Sayaç Alanı */}
      <View style={[styles.counterRow, { zIndex: 10, elevation: 10, backgroundColor: 'transparent' }]}>
        <Reanimated.View
          style={[
            styles.counterBoxLeft,
            animatedLeftCounter,
            animatedLeftCounterPop,
          ]}
        >
          <View style={{ position: 'relative', minWidth: scale(18), minHeight: moderateScale(20), alignItems: 'center', justifyContent: 'center' }}>
            <Reanimated.Text style={[styles.counterText, animatedLeftCount]}>
              {leftCount}
            </Reanimated.Text>
            <Reanimated.View pointerEvents="none" style={[styles.counterIconOverlay, animatedLeftIcon]}>
              <Iconify icon="mingcute:time-fill" size={moderateScale(18)} color="#fff" />
            </Reanimated.View>
          </View>
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
          style={[
            styles.counterBoxRight,
            animatedRightCounter,
            animatedRightCounterPop,
          ]}
        >
          <View style={{ position: 'relative', minWidth: scale(18), minHeight: moderateScale(20), alignItems: 'center', justifyContent: 'center' }}>
            <Reanimated.Text style={[styles.counterText, animatedRightCount]}>
              {rightCount}
            </Reanimated.Text>
            <Reanimated.View pointerEvents="none" style={[styles.counterIconOverlay, animatedRightIcon]}>
              <Iconify icon="streamline:check-solid" size={moderateScale(16)} color="#fff" />
            </Reanimated.View>
          </View>
        </Reanimated.View>
      </View>

      {/* 2. Orta kart alanı */}
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          marginTop: verticalScale(40),
          zIndex: 1,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        {cards.length > 0 && currentIndex < cards.length && !originalFlowComplete && (
          <SwipeCardDeck
            ref={swipeDeckRef}
            cards={cards}
            currentIndex={currentIndex}
            disabled={showSwipeTutorial || loading}
            cardWidth={CARD_WIDTH}
            cardHeight={CARD_HEIGHT}
            renderCard={renderSwipeCard}
            renderCardActions={renderSwipeCardActions}
            activeSwipeX={activeSwipeX}
            onSwipeStart={handleSwipeStart}
            onSwiped={handleSwipeCommitted}
            onSwipeCancelled={handleSwipeCancelled}
            onCardTap={handleCardTap}
            swipeThreshold={Math.max(scale(90), CARD_WIDTH * 0.28)}
            velocityThreshold={900}
            swipeAnimationDuration={SWIPE_ANIMATION_MS}
            maxRotation={9}
          />
        )}
      </View>

      {/* 3. Alt Kontroller */}
      <View style={{ width: '100%', zIndex: 10, elevation: 10, backgroundColor: 'transparent', gap: 20 }}>
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
            buttonStyle={styles.horizontalButton}
            textStyle={styles.horizontalButtonText}
            iconColor={colors.buttonText}
          />
        </View>

        <View style={[styles.progressBarContainer, { backgroundColor: colors.progressBarSwipe }]}>
          <Reanimated.View
            style={[
              styles.progressBarFill,
              { backgroundColor: colors.buttonColor },
              animatedProgressStyle
            ]}
          >
            <Reanimated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                },
                shimmerStyle
              ]}
            />
          </Reanimated.View>
        </View>

        <View style={[styles.buttonContainer]}>
          <TouchableOpacity
            style={[styles.iconButton, undoDisabled && { opacity: 0.5 }]}
            onPress={handleUndo}
            disabled={undoDisabled}
            hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}
          >
            <Iconify icon="lets-icons:refund-back" size={moderateScale(28)} color={colors.orWhite} />
          </TouchableOpacity>
          <Reanimated.Text style={[animatedStyle, {
            color: '#8A8A8A', ...typography.styles.caption, textAlign: 'center', fontWeight: '900'
          }]}>
            {texts[textIndex]}
          </Reanimated.Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              if (showSwipeTutorial) return;
              setAutoPlay((prev) => !prev);
            }}
            hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}
          >
            {autoPlay ? (
              <Iconify icon="material-symbols:pause-rounded" size={moderateScale(30)} color={colors.orWhite} />
            ) : (
              <Iconify icon="streamline:button-play-solid" size={moderateScale(22)} color={colors.orWhite} />
            )}
          </TouchableOpacity>
        </View>
      </View>

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
  swiperRenderCardWrapper: {
    width: '100%',
    height: '100%',
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


  // Dedicated action row. It stays outside the scrollable card content.
  cardActionRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: verticalScale(64),
    zIndex: 300,
    elevation: 300,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: scale(12),
  },
  cardActionButton: {
    width: scale(40),
    height: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(20),
  },
  cardActionIconStage: {
    width: scale(40),
    height: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardActionIconFace: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: scale(40),
    height: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  cardActionIconFrontFace: {
    zIndex: 2,
  },
  cardActionIconBackFace: {
    zIndex: 1,
  },

  counterRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: scale(16),
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
  counterIconOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: scale(12)
  },
  iconButton: {
    width: scale(48),
    height: scale(48),
    borderRadius: moderateScale(24),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: moderateScale(8),
    transition: 'width 0.3s',
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

  completionReviewMetric: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    textAlign: 'center',
  },
  completionReviewLabel: {
    marginTop: verticalScale(1),
    textAlign: 'center',
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







});