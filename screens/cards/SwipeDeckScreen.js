import React, { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable, Platform, BackHandler, Image, useWindowDimensions } from 'react-native';
import { Text, MAX_FONT_SIZE_MULTIPLIER } from '../../components/ui/AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withRepeat,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
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
  getSwipeClientConfig,
} from '../../services/CardService';
import { getDeckById } from '../../services/DeckService';
import { invalidateCache, markCachedQueriesStale, hasSeenSwipeTutorial, markSwipeTutorialSeen } from '../../services/CacheService';
import { getActivitySummary, invalidateActivitySummary } from '../../services/ProfileService';
import { listChapters } from '../../services/ChapterService';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { addFavoriteCard, removeFavoriteCard, getFavoriteCardIds } from '../../services/FavoriteService';
import LottieView from 'lottie-react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import * as BlockService from '../../services/BlockService';
import ReportModal from '../../components/modals/ReportModal';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import SwipeFlipCard, { SwipeCardActions } from '../../components/layout/SwipeFlipCard';
import CardDetailSheet from '../../components/layout/CardDetailView';
import { SwipeCardStage } from '../../components/layout/SwipeCardDeck';
import VoiceSettingsSheet from '../../components/modals/VoiceSettingsSheet';
import SwipeTutorialOverlay from '../../components/layout/SwipeTutorialOverlay';
import SwipeCompletionView from '../../components/layout/SwipeCompletionView';
import { MenuView } from '@expo/ui/community/menu';
import { isSpeechAvailable, useCardSpeech } from '../../lib/speech';
import { triggerHaptic } from '../../lib/hapticManager';
import { maybePromptForReview, getReviewMilestones } from '../../services/ReviewPromptService';
import { getCategoryColors } from '../../theme/colors';
import PhosphorIcon from '../../components/ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

// Eğer henüz yoksa AnimatedPressable'ı oluştur (önceki sayfalardaki gibi)
const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

const learnedRuntimeState = {
  userId: null,
  baseLearned: 0,
  deltaLearned: 0,
  lastSyncedAt: 0,
};

// --- Alt kontrol butonu ---
const AnimatedTimeButton = ({ onPress, label, time, buttonStyle, textColor }) => {
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
      <View style={styles.timeButtonTextColumn}>
        <Text
          style={[styles.timeButtonLabel, { color: textColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {label}
        </Text>
        <Text
          style={[styles.timeButtonTime, { color: textColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {time}
        </Text>
      </View>
    </AnimatedPressable>
  );
};

export default function SwipeDeckScreen({ route, navigation }) {
  const { deck, chapter } = route.params || {};
  const { colors, isDarkMode } = useTheme();
  const { session } = useAuth();
  const authUserId = session?.user?.id;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { width, height } = useWindowDimensions();

  // The card size is measured and owned by SwipeCardStage (so measuring never
  // re-renders this screen). The counters' swipe worklets read its width here.
  const cardWidthValue = useSharedValue(0);

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
  // Back-face "see more": which cards overflow, and the card whose full
  // content is open in the sheet. The content stays mounted until the sheet
  // has finished closing, so it doesn't empty out mid-animation.
  const [backOverflowIds, setBackOverflowIds] = useState(() => new Set());
  const [expandedCard, setExpandedCard] = useState(null);
  const [expandedVisible, setExpandedVisible] = useState(false);
  // The sheet's shapes: the card's own fields, and the deck with the
  // category loaded for this screen.
  const expandedSheetCard = useMemo(() => (
    expandedCard?.cards ? { ...expandedCard.cards, id: expandedCard.card_id ?? expandedCard.cards.id } : null
  ), [expandedCard]);
  const expandedSheetDeck = useMemo(() => {
    if (!deck) return null;
    const sortOrder = categorySortOrder ?? deck.categories?.sort_order;
    return { ...deck, categories: { ...(deck.categories || {}), sort_order: sortOrder } };
  }, [categorySortOrder, deck]);
  // Which card shows its back face. Written by the deck's flip callback; a
  // ref, not state, so flipping never re-renders this screen.
  const flippedCardIdRef = useRef(null);
  const handleBackOverflowChange = useCallback((id, overflowing) => {
    setBackOverflowIds((prev) => {
      if (prev.has(id) === overflowing) return prev;
      const next = new Set(prev);
      if (overflowing) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  // Reverse mode (answer first). Swipes still count toward normal progress.
  // Remembered per deck on this device.
  const [isReversed, setIsReversed] = useState(false);
  const reverseStorageKey = deck?.id ? `swipe_reverse_${deck.id}` : null;
  useEffect(() => {
    if (!reverseStorageKey) return;
    let cancelled = false;
    AsyncStorage.getItem(reverseStorageKey)
      .then((v) => { if (!cancelled) setIsReversed(v === 'true'); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [reverseStorageKey]);
  const toggleReversed = useCallback(() => {
    setIsReversed((prev) => {
      const next = !prev;
      if (reverseStorageKey) {
        AsyncStorage.setItem(reverseStorageKey, next ? 'true' : 'false').catch(() => {});
      }
      return next;
    });
  }, [reverseStorageKey]);

  // Text-to-speech (speaker button + voice settings sheet), see lib/speech.js.
  const { speakingCardId, handleSpeak, stopSpeaking, openVoiceSheet, voiceSheetProps } = useCardSpeech({
    deckId: deck?.id,
    cardsRef,
    flippedCardIdRef,
    isReversed,
    currentIndex,
  });

  // Called by the deck once per flip (the flip animation itself runs on the
  // UI thread). Only refs change here unless speech has to stop.
  const handleCardFlip = useCallback((index, flipped) => {
    const id = cardsRef.current[index]?.card_id ?? null;
    flippedCardIdRef.current = flipped ? id : null;
    stopSpeaking();
  }, [stopSpeaking]);

  // App bar overflow (kebab) menu: a native menu anchored to the button.
  // It lives in a setOptions closure, so actions are read through a ref.
  const moreMenuActionsRef = useRef({});

  const handleShowMore = useCallback((id) => {
    const card = cardsRef.current.find((c) => c?.card_id === id);
    if (!card) return;
    setExpandedCard(card);
    setExpandedVisible(true);
  }, []);
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
  // Every card_id this mount has received. A known card coming back from the
  // server is only accepted as a reinsert (its last local swipe was "left").
  const seenCardIdsRef = useRef(new Set());
  const lastDirectionByCardRef = useRef(new Map());
  // The latest record_swipe; fetches and undo wait for it so the server state
  // they read already includes the swipe.
  const lastRecordPromiseRef = useRef(Promise.resolve());
  // How often due reinserts are checked; follows the server's left delay.
  const dueCheckIntervalMsRef = useRef(60000);
  // Server keeps only the last N undo snapshots per session (swipe_config).
  const undoLimitRef = useRef(10);
  const [undoDepth, setUndoDepth] = useState(0);
  const isMountedRef = useRef(true);
  const progressCachesClearedRef = useRef(false);
  const sessionCountedCardKeysRef = useRef(new Set());
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
      icon: ICONS.tapToFlip,
    },
    {
      title: t('swipeDeck.tutorial.swipeTitle', 'Kaydırarak öğren'),
      description: t('swipeDeck.tutorial.swipeLead', 'Kartın arkasını gördükten sonra kaydırarak karar ver.'),
      target: 'card',
      showSwipeHint: true,
      icon: ICONS.swipeToLearn,
      points: [
        { icon: ICONS.swipeRight, color: '#3E8E41', text: t('swipeDeck.tutorial.pointRight', 'Sağa: Öğrendim. Kart öğrenildi olur ve bu destede bir daha karşına çıkmaz.') },
        { icon: ICONS.swipeLeft, color: '#F3A14C', text: t('swipeDeck.tutorial.pointLeft', 'Sola: Tekrar Et. Kart bu oturumda birkaç kart sonra yeniden gelir.') },
      ],
    },
    {
      title: t('swipeDeck.tutorial.intervalTitle', 'Tekrar zamanını seç'),
      description: t('swipeDeck.tutorial.intervalLead', 'Seçtiğin süre boyunca kart karşına çıkmaz, bu oturumda da gelmez.'),
      target: 'interval',
      icon: ICONS.reviewInterval,
      points: [
        { icon: ICONS.repeat, color: '#F3A14C', text: t('swipeDeck.tutorial.pointShort', '10 dk · 1 saat: Az bildiğin kartlar için, sık tekrar.') },
        { icon: ICONS.time, color: '#3E8E41', text: t('swipeDeck.tutorial.pointLong', '1 gün · 1 hafta: İyi bildiğin kartlar için, seyrek tekrar.') },
      ],
    },
  ]), [t]);

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

  moreMenuActionsRef.current = {
    reverse: toggleReversed,
    voice: () => setTimeout(openVoiceSheet, 250),
    report: () => setTimeout(openReportCardModal, 250),
  };

  // The header only needs to know whether a card is showing (menu actions are
  // read through a ref), so it is not rebuilt on every swipe.
  const hasCurrentCard = !!cards[currentIndex];
  useLayoutEffect(() => {
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
        if (loading || !hasCurrentCard) {
          return null;
        }

        return (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              paddingHorizontal: 8,
            }}
          >
            {isReversed ? (
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('selection');
                  toggleReversed();
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 15, bottom: 15, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('swipeDeck.reverseActive', 'Ters mod: önce cevap')}
                style={styles.reverseBadge}
              >
                <PhosphorIcon icon={ICONS.reverse} size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
            <MenuView
              actions={[
                {
                  id: 'reverse',
                  title: isReversed ? t('swipeDeck.reverseOff', 'Normal çalış') : t('swipeDeck.reverseOn', 'Ters çevir'),
                  image: 'arrow.up.arrow.down',
                },
                isSpeechAvailable ? { id: 'voice', title: t('swipeDeck.voice.settings', 'Ses ayarları'), image: 'speaker.wave.2' } : null,
                !isOwner ? { id: 'report', title: t('moderation.reportCard', 'Kartı şikayet et'), image: 'exclamationmark.bubble' } : null,
              ].filter(Boolean)}
              onOpenMenu={() => triggerHaptic('selection')}
              onPressAction={({ nativeEvent }) => moreMenuActionsRef.current[nativeEvent.event]?.()}
              style={styles.headerMenuHost}
            >
              <View style={styles.headerMenuTrigger}>
                <PhosphorIcon
                  icon={ICONS.more}
                  size={24}
                  color="#FFFFFF"
                />
              </View>
            </MenuView>
          </View>
        );
      },
    });
  }, [
    navigation,
    hasCurrentCard,
    loading,
    isOwner,
    isReversed,
    toggleReversed,
    t,
  ]);

  const leftInactiveColor = '#f3a14c';
  const leftActiveColor = colors.buttonColor;
  const rightInactiveColor = '#6faa72';
  const rightActiveColor = '#3e8e41';

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Progress counts shown on DeckDetail / Chapters / ChapterSelector come from
  // the server RPC; after a swipe their caches are stale. Cleared once on the
  // first swipe and again on exit, before the session is closed, so a screen
  // that focuses while we leave never reads the old numbers.
  const clearDeckProgressCaches = useCallback(async () => {
    if (!deck?.id || !authUserId) return;
    await Promise.all([
      invalidateCache(`deck_progress_${deck.id}_${authUserId}`),
      invalidateCache(`progress_deck_${deck.id}_${authUserId}`),
      invalidateCache(`progress_chapters_${deck.id}_${authUserId}`),
    ]);
    // cached card pages carry each card's learned state
    markCachedQueriesStale(`cards_deck_${deck.id}_`);
    markCachedQueriesStale(`fav_cards_${authUserId}`);
  }, [deck?.id, authUserId]);

  useEffect(() => {
    let cancelled = false;
    const fetchCards = async () => {
      setLoading(true);
      setRightCount(0);
      setLeftCount(0);
      seenCardIdsRef.current = new Set();
      lastDirectionByCardRef.current = new Map();
      lastRecordPromiseRef.current = Promise.resolve();
      progressCachesClearedRef.current = false;
      setUndoDepth(0);
      sessionCountedCardKeysRef.current = new Set();
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

        const [sessionId, swipeConfig] = await Promise.all([
          startSwipeSession({ deckId: deck.id, chapterId, unassignedOnly }),
          getSwipeClientConfig(),
        ]);

        if (cancelled || !isMountedRef.current) {
          // Left the screen while the session was starting: close it now,
          // nothing else would.
          endSwipeSession({ sessionId }).catch(() => { });
          return;
        }

        dueCheckIntervalMsRef.current = Math.max(15, swipeConfig.left_delay_seconds) * 1000;
        undoLimitRef.current = swipeConfig.undo_limit;
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
        // Do not count the initially visible card as completed progress.
        // The header can still show 1/N separately from the completion counter.
        sessionCountedCardKeysRef.current = new Set();
        sessionProgressCountRef.current = 0;
        setSessionProgressCount(0);
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
        if (!cancelled) setLoading(false);
      }
    };

    fetchCards();
    return () => { cancelled = true; };
  }, [deck.id, chapter?.id]);

  useEffect(() => {
    return () => {
      if (reviewPromptTimeoutRef.current) clearTimeout(reviewPromptTimeoutRef.current);
    };
  }, []);

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
      await clearDeckProgressCaches();
      const activeSessionId = sessionIdRef.current;
      if (activeSessionId) {
        sessionIdRef.current = null;
        // Wait for the last swipe so it isn't lost when the queue is deleted.
        await lastRecordPromiseRef.current;
        // A failed end is harmless: the next session start removes this
        // user's open sessions and the hourly cleanup catches the rest.
        endSwipeSession({ sessionId: activeSessionId }).catch((err) => {
          if (__DEV__) console.warn('endSwipeSession failed:', err?.message);
        });
      }
    };
    const unsubscribe = navigation.addListener('blur', handleExit);
    return () => {
      unsubscribe();
      handleExit();
    };
  }, [navigation, clearDeckProgressCaches]);

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

  // Counters follow the card's own swipe phases (components/layout/SwipeFlipCard):
  // the number fades out exactly while the card text fades (55–68% of the
  // label distance), and the icon + colour come in exactly while the card's
  // "Tekrar et" / "Öğrendim" label comes in (68–100%). Same distance formula.
  const SWIPE_TEXT_FADE = [0.55, 0.68];
  const SWIPE_LABEL_START = 0.68;

  const animatedLeftCounter = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, -activeSwipeX.value / Math.max(80, cardWidthValue.value * 0.28)));
    const v = Math.min(1, Math.max(0, (p - SWIPE_LABEL_START) / (1 - SWIPE_LABEL_START)));
    return {
      backgroundColor: interpolateColor(v, [0, 1], [leftInactiveColor, leftActiveColor]),
    };
  }, [cardWidthValue, leftActiveColor, leftInactiveColor]);

  const animatedRightCounter = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, activeSwipeX.value / Math.max(80, cardWidthValue.value * 0.28)));
    const v = Math.min(1, Math.max(0, (p - SWIPE_LABEL_START) / (1 - SWIPE_LABEL_START)));
    return {
      backgroundColor: interpolateColor(v, [0, 1], [rightInactiveColor, rightActiveColor]),
    };
  }, [cardWidthValue, rightActiveColor, rightInactiveColor]);

  const animatedLeftCount = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, -activeSwipeX.value / Math.max(80, cardWidthValue.value * 0.28)));
    return {
      opacity: interpolate(p, SWIPE_TEXT_FADE, [1, 0], 'clamp'),
    };
  }, [cardWidthValue]);

  const animatedRightCount = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, activeSwipeX.value / Math.max(80, cardWidthValue.value * 0.28)));
    return {
      opacity: interpolate(p, SWIPE_TEXT_FADE, [1, 0], 'clamp'),
    };
  }, [cardWidthValue]);

  const animatedLeftIcon = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, -activeSwipeX.value / Math.max(80, cardWidthValue.value * 0.28)));
    const v = Math.min(1, Math.max(0, (p - SWIPE_LABEL_START) / (1 - SWIPE_LABEL_START)));
    return {
      opacity: interpolate(v, [0, 0.35, 1], [0, 0.35, 1]),
      transform: [{ scale: interpolate(v, [0, 1], [0.9, 1]) }],
    };
  }, [cardWidthValue]);

  const animatedRightIcon = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, activeSwipeX.value / Math.max(80, cardWidthValue.value * 0.28)));
    const v = Math.min(1, Math.max(0, (p - SWIPE_LABEL_START) / (1 - SWIPE_LABEL_START)));
    return {
      opacity: interpolate(v, [0, 0.35, 1], [0, 0.35, 1]),
      transform: [{ scale: interpolate(v, [0, 1], [0.9, 1]) }],
    };
  }, [cardWidthValue]);

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

  // Original-session progress is keyed ONLY by card_id.
  // A reinsert may receive a new queue_id, but it is still the same card.
  // Therefore queue_id must never determine whether progress advances.
  const getSessionProgressCardKey = useCallback((card) => {
    if (!card?.card_id) return null;
    return `card:${String(card.card_id)}`;
  }, []);

  const queueKey = (c) => (c?.queue_id != null ? String(c.queue_id) : String(c?.card_id || ''));

  // (sort_key, queue_id) order, the server's queue order.
  const compareQueuePosition = (a, b) => {
    const ak = Number(a?.sort_key);
    const bk = Number(b?.sort_key);
    if (ak !== bk) return ak - bk;
    return Number(a?.queue_id ?? 0) - Number(b?.queue_id ?? 0);
  };

  const toLearningCard = (card) => ({
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
    },
  });

  const normalizeIncomingCards = useCallback((incomingCards) => {
    if (!Array.isArray(incomingCards) || incomingCards.length === 0) return [];
    const unique = new Map();
    incomingCards.forEach((card) => {
      const key = queueKey(card);
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

    // A card already waiting in the upcoming queue is never added twice.
    const upcomingCardIds = new Set(upcoming.map((c) => c?.card_id).filter(Boolean));
    const cardsToMerge = normalized.filter((c) => c?.card_id && !upcomingCardIds.has(c.card_id));
    if (cardsToMerge.length === 0) return;

    // Each card goes to its server position (sort_key) instead of the end of
    // the loaded batch; that is where the server put a reinserted card. The
    // immediate next card stays protected so it can't be swapped under the
    // active one for a frame.
    const protectedNext = upcoming.slice(0, 1);
    const rest = upcoming.slice(1);
    cardsToMerge.sort(compareQueuePosition).forEach((card) => {
      const at = rest.findIndex((c) => compareQueuePosition(c, card) > 0);
      if (at === -1) rest.push(card); else rest.splice(at, 0, card);
    });

    const merged = [...consumed, ...protectedNext, ...rest];
    cardsRef.current = merged;
    setCards(merged);
    prefetchCardImages(merged);
  }, [normalizeIncomingCards, prefetchCardImages]);

  const commitIncomingCards = useCallback((incomingCards) => {
    // Never mutate the visible queue after the original session reaches N/N.
    // Late network responses/reinsert checks can otherwise append cards to a
    // completed mount even though the completion screen is already active.
    if (sessionTargetCount > 0 && sessionProgressCountRef.current >= sessionTargetCount) {
      return;
    }

    const normalized = normalizeIncomingCards(incomingCards);
    if (normalized.length === 0) return;

    if (isAnimatingRef.current) {
      const current = normalizeIncomingCards(pendingIncomingCardsRef.current);
      const existing = new Set(current.map(queueKey).filter(Boolean));
      pendingIncomingCardsRef.current = [
        ...current,
        ...normalized.filter((c) => {
          const key = queueKey(c);
          if (!key || existing.has(key)) return false;
          existing.add(key);
          return true;
        }),
      ];
      return;
    }

    mergeIncomingCardsNow(normalized);
  }, [mergeIncomingCardsNow, normalizeIncomingCards, sessionTargetCount]);

  const flushPendingIncomingCards = useCallback(() => {
    if (sessionTargetCount > 0 && sessionProgressCountRef.current >= sessionTargetCount) {
      // Completed mounts must not reveal delayed reinserts.
      pendingIncomingCardsRef.current = [];
      return;
    }
    if (isAnimatingRef.current) return;
    if (pendingIncomingCardsRef.current.length === 0) return;

    const pending = pendingIncomingCardsRef.current;
    pendingIncomingCardsRef.current = [];
    mergeIncomingCardsNow(pending);
  }, [mergeIncomingCardsNow, sessionTargetCount]);

  // Sorts one next_cards response into what this mount should show, and moves
  // the pagination cursor. Rules:
  // - A card_id never seen before is a normal page row: it is accepted, and
  //   only these rows move the cursor (the cursor never goes backwards).
  // - A known card_id is accepted only as a server reinsert, i.e. when its
  //   last local swipe was "left". Anything else (a stale row after a right
  //   swipe or a skip) is dropped. This is what stops cards from repeating.
  const ingestServerRows = useCallback((rows) => {
    let next = paginationCursorRef.current;
    const accepted = [];
    (rows || []).forEach((row) => {
      if (!row?.card_id) return;
      if (seenCardIdsRef.current.has(row.card_id)) {
        if (lastDirectionByCardRef.current.get(row.card_id) !== 'left') return;
        lastDirectionByCardRef.current.delete(row.card_id); // one reinsert per left swipe
        accepted.push(toLearningCard(row));
        return;
      }
      seenCardIdsRef.current.add(row.card_id);
      accepted.push(toLearningCard(row));
      const isAhead = next.afterSortKey == null
        || compareQueuePosition(row, { sort_key: next.afterSortKey, queue_id: next.afterQueueId }) > 0;
      if (isAhead) next = { afterSortKey: row.sort_key, afterQueueId: row.queue_id };
    });
    paginationCursorRef.current = next;
    return accepted;
  }, []);

  const fetchMoreCards = useCallback(async () => {
    if (sessionTargetCount > 0 && sessionProgressCountRef.current >= sessionTargetCount) return;
    if (isFetchingMoreRef.current || !userId || !sessionIdRef.current || !hasMoreCardsRef.current) return;
    isFetchingMoreRef.current = true;
    try {
      // Read the queue only after the latest swipe is stored (a right-swiped
      // card must already be gone from it).
      await lastRecordPromiseRef.current;
      if (!sessionIdRef.current) return;
      const moreCards = await getSwipeSessionNextCards({
        sessionId: sessionIdRef.current,
        afterSortKey: paginationCursorRef.current.afterSortKey,
        afterQueueId: paginationCursorRef.current.afterQueueId,
        currentSortKey: currentPositionCursorRef.current.currentSortKey,
        currentQueueId: currentPositionCursorRef.current.currentQueueId,
        limit: SESSION_BATCH_LIMIT,
      });
      lastDueCheckAtRef.current = Date.now();
      if (!isMountedRef.current) return;

      if (moreCards.length === 0) {
        hasMoreCardsRef.current = false;
        return;
      }
      const newCards = ingestServerRows(moreCards);
      if (newCards.length > 0) commitIncomingCards(newCards);
    } catch (error) {
      console.error('Error fetching more cards:', error);
    } finally {
      isFetchingMoreRef.current = false;
    }
  }, [userId, commitIncomingCards, ingestServerRows, sessionTargetCount]);

  const checkDueReinserts = useCallback(async () => {
    if (sessionTargetCount > 0 && sessionProgressCountRef.current >= sessionTargetCount) return;
    if (isDueCheckingRef.current) return;
    if (!sessionIdRef.current) return;
    if (isFetchingMoreRef.current) return;
    if (Date.now() - lastDueCheckAtRef.current < dueCheckIntervalMsRef.current) return;

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
      if (!isMountedRef.current) return;

      const newCards = ingestServerRows(dueCards);
      if (newCards.length > 0) commitIncomingCards(newCards);
    } catch (error) {
      console.error('Error checking due reinserts:', error);
    } finally {
      isDueCheckingRef.current = false;
    }
  }, [commitIncomingCards, ingestServerRows, sessionTargetCount]);

  // One retry for a dropped request. "Queue item not found" is final (the card
  // is no longer in this session), so it is not retried.
  const recordSwipeWithRetry = async (args) => {
    try {
      await recordSwipeSessionSwipe(args);
    } catch (error) {
      if (String(error?.message || '').includes('Queue item not found')) {
        if (__DEV__) console.warn('record_swipe skipped:', error.message);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      try {
        await recordSwipeSessionSwipe(args);
      } catch (retryError) {
        console.error('Failed to record swipe session swipe:', retryError?.message);
      }
    }
  };

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
    flippedCardIdRef.current = null;
    isAnimatingRef.current = false;

    if (actualDirection === 'left') {
      triggerHaptic('selection');
    } else if (actualDirection === 'right') {
      triggerHaptic('light');
    }

    historyStateSnapshotsRef.current.push({
      sessionCountedCardKeys: new Set(sessionCountedCardKeysRef.current),
      sessionProgressCount: sessionProgressCountRef.current,
      leftCountedCardIds: new Set(leftCountedCardIds.current),
      historyLeftCardIds: [...historyLeftCardIds.current],
    });

    // Only the first swipe of a queue entry advances the original-session
    // progress. Reinserted cards keep the same key, so they do not advance it.
    const sessionProgressKey = getSessionProgressCardKey(card);
    const isAlreadyCountedInSession = sessionProgressKey
      ? sessionCountedCardKeysRef.current.has(sessionProgressKey)
      : false;

    if (sessionProgressKey && !isAlreadyCountedInSession) {
      sessionCountedCardKeysRef.current.add(sessionProgressKey);
    }

    const nextProgressCount = sessionProgressKey && !isAlreadyCountedInSession
      ? Math.min(
        sessionTargetCount > 0 ? sessionTargetCount : Number.MAX_SAFE_INTEGER,
        sessionCountedCardKeysRef.current.size,
      )
      : sessionProgressCountRef.current;

    sessionProgressCountRef.current = nextProgressCount;
    setSessionProgressCount(nextProgressCount);

    if (sessionTargetCount > 0 && nextProgressCount >= sessionTargetCount) {
      // N/N is the terminal point for this mount. Any reinserted cards already
      // present in the local array remain inaccessible because the render path
      // switches to the completion screen immediately.
      hasMoreCardsRef.current = false;
      pendingIncomingCardsRef.current = [];
    }

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

    lastDirectionByCardRef.current.set(card.card_id, actualDirection);
    setUndoDepth((d) => Math.min(d + 1, undoLimitRef.current));

    // Swipes are stored strictly in order; fetches and undo wait on this chain.
    const recordArgs = {
      sessionId: sessionIdRef.current,
      cardId: card.card_id,
      direction: actualDirection,
      skipMinutes: actualSkipMinutes,
    };
    lastRecordPromiseRef.current = lastRecordPromiseRef.current
      .then(() => recordSwipeWithRetry(recordArgs))
      .catch(() => { });
    await lastRecordPromiseRef.current;

    if (!progressCachesClearedRef.current) {
      progressCachesClearedRef.current = true;
      clearDeckProgressCaches();
    }
    if (!isMountedRef.current) return;

    checkDueReinserts();
    requestAnimationFrame(() => {
      flushPendingIncomingCards();
    });
  }, [
    checkDueReinserts,
    clearDeckProgressCaches,
    flushPendingIncomingCards,
    getSessionProgressCardKey,
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

  const handleSkip = useCallback((minutes) => {
    if (showSwipeTutorial) return;
    if (isAnimatingRef.current) return;
    if (!cardsRef.current[currentIndexRef.current]) return;
    if (!userId) return;
    swipeDeckRef.current?.swipeLeft({ type: 'skip', skipMinutes: minutes });
  }, [showSwipeTutorial, userId]);

  const handleUndo = async () => {
    if (showSwipeTutorial) return;
    if (undoDisabled || history.length === 0 || undoDepth === 0 || !sessionIdRef.current) return;
    if (isAnimatingRef.current) return;

    setUndoDisabled(true);
    flippedCardIdRef.current = null;

    // Keep the local deck intact. Swiping advances currentIndex; it does not
    // remove cards from `cards`, so the server-side undo only needs the UI to
    // move back to the historical index. Re-fetching the whole queue here was
    // desynchronizing the mounted SwipeCardDeck slots and could leave a blank
    // card after repeated Undo operations.
    const lastIndex = history[history.length - 1];
    const undoneCard = cardsRef.current[lastIndex] || cards[lastIndex];
    const lastDirection = historyDirections[historyDirections.length - 1];

    try {
      // The swipe being undone must be stored first, or the server would undo
      // the one before it.
      await lastRecordPromiseRef.current;
      const result = await undoLastSwipe({ sessionId: sessionIdRef.current });
      if (result?.success === false && result?.reason === 'empty_stack') {
        setUndoDepth(0);
        return;
      }
      setUndoDepth((d) => Math.max(0, d - 1));
      if (undoneCard?.card_id) {
        lastDirectionByCardRef.current.delete(undoneCard.card_id);
        // A reinserted copy of this card may already wait further down the
        // local queue; the server just moved it back, so drop the copy.
        const before = cardsRef.current;
        const pruned = before.filter((c, i) => i <= lastIndex || c?.card_id !== undoneCard.card_id);
        if (pruned.length !== before.length) {
          cardsRef.current = pruned;
          setCards(pruned);
        }
        pendingIncomingCardsRef.current = pendingIncomingCardsRef.current
          .filter((c) => c?.card_id !== undoneCard.card_id);
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
          sessionCountedCardKeysRef.current = new Set(previousState.sessionCountedCardKeys);
          sessionProgressCountRef.current = previousState.sessionProgressCount;
          leftCountedCardIds.current = new Set(previousState.leftCountedCardIds);
          historyLeftCardIds.current = [...previousState.historyLeftCardIds];
          setSessionProgressCount(previousState.sessionProgressCount);
        }
        setTotalSwipeCount((c) => Math.max(0, c - 1));
        setHistory((prev) => prev.slice(0, -1));
        setHistoryDirections((prev) => prev.slice(0, -1));
      }

      // Do NOT call getSwipeSessionNextCards() here and do NOT replace `cards`.
      // The current deck already contains the undone card. Moving currentIndex
      // back makes that exact existing card active again and lets
      // SwipeCardDeck's currentIndex effect reset its animation state safely.
      if (undoneCard && lastIndex >= 0 && lastIndex < cardsRef.current.length) {
        currentIndexRef.current = lastIndex;
        setCurrentIndex(lastIndex);

        // The user is now looking at the undone card. Keep the backend cursor
        // aligned with that card; the next normal swipe updates it again.
        currentPositionCursorRef.current = {
          currentSortKey: undoneCard.sort_key ?? null,
          currentQueueId: undoneCard.queue_id ?? null,
        };
      }
    } catch (error) {
      console.error('Failed to undo swipe session action:', error);
    } finally {
      setTimeout(() => {
        if (isMountedRef.current) setUndoDisabled(false);
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
      swipeDeckRef.current?.flip?.();
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
    let swapTimeout = null;
    const interval = setInterval(() => {
      // Eski text'i çıkar
      opacity.value = withTiming(0, { duration: 250 });
      translateX.value = withTiming(-15, { duration: 250 });

      // Text'i JS tarafında değiştir
      swapTimeout = setTimeout(() => {
        setTextIndex((prev) => (prev + 1) % texts.length);

        // Yeni text sağdan gelsin
        translateX.value = 15;

        opacity.value = withTiming(1, { duration: 300 });
        translateX.value = withTiming(0, { duration: 300 });
      }, 250);
    }, 3000);

    return () => {
      clearInterval(interval);
      if (swapTimeout) clearTimeout(swapTimeout);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      {
        translateX: translateX.value,
      },
    ],
  }));
  // N/N is a hard boundary for this mounted swipe session.
  // Reinserted cards may exist in the local queue, but once every original
  // session card has been completed they must never become visible again.
  // A fresh mount starts a new swipe session and can fetch them again then.
  const originalFlowComplete =
    sessionTargetCount > 0 &&
    sessionProgressCount >= sessionTargetCount;

  // Leaving the screen (finished or not) makes Home/Profile refetch today's
  // goal and streak: the swipes were counted on the server.
  useEffect(() => () => {
    if (userId) invalidateActivitySummary(userId);
  }, [userId]);

  useEffect(() => {
    const isComplete = cards.length === 0 || currentIndex >= cards.length || originalFlowComplete;
    if (!isComplete || !userId || !deck?.id || !sessionIdRef.current) return;

    let cancelled = false;
    const fetchCompletionSummary = async () => {
      try {
        // a failed summary must not take the rest of the screen down
        const sessionCountsPromise = getSwipeSessionCompletionCounts(sessionIdRef.current, userId).catch(() => null);
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

        // Today's goal/streak after this session (fresh, bypassing the cache).
        const activityPromise = invalidateActivitySummary(userId)
          .then(() => getActivitySummary(userId, { days: 1, force: true }))
          .catch(() => null);

        const [sessionCounts, chapterProgress, reviews, chapters, activity] = await Promise.all([
          sessionCountsPromise,
          chapterProgressPromise,
          reviewsPromise,
          chaptersPromise,
          activityPromise,
        ]);
        if (cancelled) return;

        setCompletionSummary({ sessionCounts, chapterProgress, reviews, activity });
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
    cardWidth,
    cardHeight,
  } = {}) => {
    const cardId = card?.card_id;
    const gradientColors = getCategoryColors(colors, categorySortOrder);
    const isPlaceholder = !card || !card.cards;

    return (
      <View
        ref={isActive ? cardTutorialTargetRef : undefined}
        collapsable={false}
        style={styles.swiperRenderCardWrapper}
      >
        <SwipeFlipCard
          card={card}
          cardId={cardId}
          isPlaceholder={isPlaceholder}
          isActive={Boolean(isActive)}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          gradientColors={gradientColors}
          cardBackground={colors.cardBackground}
          textColor={colors.text}
          swipeX={swipeX}
          flipProgress={flipProgress}
          entranceProgress={entranceProgress}
          entranceOpacity={entranceOpacity}
          leftSwipeAccentColor={leftActiveColor}
          rightSwipeAccentColor={rightActiveColor}
          onBackOverflowChange={handleBackOverflowChange}
          reversed={isReversed}
        />
      </View>
    );
  }, [categorySortOrder, colors.cardBackground, colors.categoryColors, colors.text, handleBackOverflowChange, isReversed, leftActiveColor, rightActiveColor]);

  const renderSwipeCardActions = useCallback((card, params = {}) => {
    const {
      isActive,
      swipeX,
      flipProgress,
      entranceProgress,
      entranceOpacity,
      cardWidth,
    } = params;

    if (!isActive || !card?.card_id) return null;

    return (
      <SwipeCardActions
        cardId={card.card_id}
        cardWidth={cardWidth}
        isFavorite={favoriteIds.has(card.card_id)}
        favoriteColor={colors.buttonColor}
        onFavoritePress={toggleFavorite}
        swipeX={swipeX}
        flipProgress={flipProgress}
        entranceProgress={entranceProgress}
        entranceOpacity={entranceOpacity}
        showMore={backOverflowIds.has(card.card_id)}
        showMoreLabel={t('swipeDeck.showMore', 'Devamını gör')}
        onShowMorePress={handleShowMore}
        showMoreTextColor={colors.buttonColor}
        onSpeakPress={isSpeechAvailable ? handleSpeak : undefined}
        isSpeaking={speakingCardId === card.card_id}
        speakLabel={t('swipeDeck.speak', 'Sesli oku')}
        stopSpeakingLabel={t('swipeDeck.stopSpeaking', 'Okumayı durdur')}
      />
    );
  }, [backOverflowIds, colors.buttonColor, favoriteIds, handleShowMore, handleSpeak, speakingCardId, t, toggleFavorite]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContent}>
          <LottieView
            source={require('../../assets/animations/cards.json')}
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
    return (
      <SwipeCompletionView
        isEmptyChapter={Boolean(chapter?.id) && sessionTargetCount === 0 && cards.length === 0}
        sessionLearned={rightCount}
        sessionTargetCount={sessionTargetCount}
        totalSwipeCount={totalSwipeCount}
        completionSummary={completionSummary}
        nextChapter={nextChapter}
        onBack={() => navigation.goBack()}
        onNextChapter={() => nextChapter && navigation.replace('SwipeDeck', { deck, chapter: nextChapter })}
        colors={colors}
      />
    );
  }

  return (
    <View
      ref={tutorialOverlayRootRef}
      collapsable={false}
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
          backgroundColor: colors.background,
          // The header is transparent; the screen starts right below it.
          marginTop: headerHeight,
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
          <View style={{ position: 'relative', minWidth: 18, minHeight: 20, alignItems: 'center', justifyContent: 'center' }}>
            <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={[styles.counterText, animatedLeftCount]}>
              {leftCount}
            </Reanimated.Text>
            <Reanimated.View pointerEvents="none" style={[styles.counterIconOverlay, animatedLeftIcon]}>
              <PhosphorIcon icon={ICONS.time} size={18} color="#fff" />
            </Reanimated.View>
          </View>
        </Reanimated.View>

        <View style={[styles.deckProgressBox, { flexDirection: 'row' }]}>
          {(() => {
            // Header position remains 1-based for the currently visible card,
            // while sessionProgressCount remains the real 0..N completion count.
            const activeProgressKey = getSessionProgressCardKey(cards[currentIndex]);
            const activeCardAlreadyCounted = activeProgressKey
              ? sessionCountedCardKeysRef.current.has(activeProgressKey)
              : true;
            const currentCardNumber = sessionTargetCount > 0
              ? Math.min(
                sessionTargetCount,
                sessionProgressCount + (activeCardAlreadyCounted ? 0 : 1),
              )
              : sessionProgressCount;

            const allOriginalCardsCompleted =
              sessionTargetCount > 0 && sessionProgressCount >= sessionTargetCount;

            const activeCardIsReinserted =
              Boolean(cards[currentIndex]?.card_id) &&
              leftCountedCardIds.current.has(cards[currentIndex].card_id);

            const hasReinsertToShow =
              activeCardIsReinserted ||
              cards
                .slice(currentIndex + 1)
                .some((c) => c?.card_id && leftCountedCardIds.current.has(c.card_id));

            const showVaktiGeldi =
              sessionTargetCount > 0 &&
              allOriginalCardsCompleted &&
              activeCardIsReinserted;
            const iconWrapStyle = {
              borderRadius: 10,
              padding: 6,
              backgroundColor: colors.cardBackground || 'rgba(128,128,128,0.15)',
              marginRight: 10,
            };
            if (showVaktiGeldi) {
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={iconWrapStyle}>
                    <PhosphorIcon icon={ICONS.repeat} size={22} color={colors.text} />
                  </View>
                  <Text style={[styles.deckProgressText, { color: colors.text }]}>{t('swipeDeck.vaktiGeldi', 'Vakti Geldi')}</Text>
                </View>
              );
            }
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {activeCardIsReinserted && (
                  <View style={iconWrapStyle}>
                    <PhosphorIcon icon={ICONS.repeat} size={18} color={colors.text} />
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
          <View style={{ position: 'relative', minWidth: 18, minHeight: 20, alignItems: 'center', justifyContent: 'center' }}>
            <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={[styles.counterText, animatedRightCount]}>
              {rightCount}
            </Reanimated.Text>
            <Reanimated.View pointerEvents="none" style={[styles.counterIconOverlay, animatedRightIcon]}>
              <PhosphorIcon icon={ICONS.check} size={16} color="#fff" />
            </Reanimated.View>
          </View>
        </Reanimated.View>
      </View>

      {/* 2. Orta kart alanı */}
      <SwipeCardStage
        ref={swipeDeckRef}
        style={styles.cardStage}
        showDeck={cards.length > 0 && currentIndex < cards.length && !originalFlowComplete}
        cardWidthValue={cardWidthValue}
        cards={cards}
        currentIndex={currentIndex}
        disabled={showSwipeTutorial || loading}
        renderCard={renderSwipeCard}
        renderCardActions={renderSwipeCardActions}
        activeSwipeX={activeSwipeX}
        onSwipeStart={handleSwipeStart}
        onSwiped={handleSwipeCommitted}
        onSwipeCancelled={handleSwipeCancelled}
        onCardFlip={handleCardFlip}
        velocityThreshold={900}
        swipeAnimationDuration={SWIPE_ANIMATION_MS}
        maxRotation={9}
      />

      {/* 3. Alt Kontroller */}
      <View style={{ width: '100%', zIndex: 10, elevation: 10, backgroundColor: 'transparent', gap: 16 }}>
        <View
          ref={intervalTutorialTargetRef}
          collapsable={false}
          onLayout={() => measureTutorialTarget(intervalTutorialTargetRef, setIntervalTargetLayout)}
          style={[styles.horizontalButtonRow, { backgroundColor: colors.buttonColor }]}
        >
          <AnimatedTimeButton
            onPress={() => handleSkip(10)}
            label={t('swipeDeck.levelHard', 'Zor')}
            time={t('swipeDeck.minutes', '10dk+')}
            buttonStyle={[styles.horizontalButton, { borderRightWidth: 1, borderRightColor: '#e0e0e0' }]}
            textColor={colors.buttonText}
          />

          <AnimatedTimeButton
            onPress={() => handleSkip(60)}
            label={t('swipeDeck.levelOkay', 'Orta')}
            time={t('swipeDeck.hours', '1sa+')}
            buttonStyle={[styles.horizontalButton, { borderRightWidth: 1, borderRightColor: '#e0e0e0' }]}
            textColor={colors.buttonText}
          />

          <AnimatedTimeButton
            onPress={() => handleSkip(24 * 60)}
            label={t('swipeDeck.levelGood', 'İyi')}
            time={t('swipeDeck.days', '1g+')}
            buttonStyle={[styles.horizontalButton, { borderRightWidth: 1, borderRightColor: '#e0e0e0' }]}
            textColor={colors.buttonText}
          />

          <AnimatedTimeButton
            onPress={() => handleSkip(7 * 24 * 60)}
            label={t('swipeDeck.levelEasy', 'Kolay')}
            time={t('swipeDeck.sevenDays', '1hf+')}
            buttonStyle={styles.horizontalButton}
            textColor={colors.buttonText}
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <PhosphorIcon icon={ICONS.undo} size={28} color={colors.orWhite} />
          </TouchableOpacity>
          <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={[animatedStyle, {
            color: '#8A8A8A', ...typography.styles.footnote, textAlign: 'center', fontFamily: fonts.medium
          }]}>
            {texts[textIndex]}
          </Reanimated.Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              if (showSwipeTutorial) return;
              setAutoPlay((prev) => !prev);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {autoPlay ? (
              <PhosphorIcon icon={ICONS.pause} size={30} color={colors.orWhite} />
            ) : (
              <PhosphorIcon icon={ICONS.play} size={22} color={colors.orWhite} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {showSwipeTutorial ? (
        <SwipeTutorialOverlay
          steps={swipeTutorialSteps}
          stepIndex={swipeTutorialStep}
          onStepChange={setSwipeTutorialStep}
          onComplete={completeSwipeTutorial}
          cardTargetLayout={cardTargetLayout}
          intervalTargetLayout={intervalTargetLayout}
          colors={colors}
        />
      ) : null}
      <ReportModal
        visible={reportModalVisible}
        onClose={() => { setReportModalVisible(false); setReportCardId(null); }}
        reportType="card"
        alreadyReportedCodes={reportModalAlreadyCodes}
        onSubmit={handleReportModalSubmit}
      />

      {/* "See more": the card's full content in the cards pages' detail sheet,
          without actions, learning status or speech. Deck order is kept
          (question first) even in reverse mode. */}
      <CardDetailSheet
        card={expandedSheetCard}
        deck={expandedSheetDeck}
        visible={expandedVisible}
        onDismiss={() => {
          setExpandedVisible(false);
          setExpandedCard(null);
        }}
        showLearningStatus={false}
        enableSpeech={false}
      />

      {/* Voice settings: reading speed and a voice per deck language. */}
      <VoiceSettingsSheet
        {...voiceSheetProps}
        colors={colors}
        isDarkMode={isDarkMode}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 40,
    zIndex: 1,
    elevation: 1,
    overflow: 'visible',
  },
  swiperRenderCardWrapper: {
    width: '100%',
    height: '100%',
  },
  // Dedicated action row. It stays outside the scrollable card content.
  reverseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
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
  counterRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: 16,
    height: 36,
  },
  counterBoxLeft: {
    position: 'absolute',
    left: -30,
    top: 0,
    minWidth: 80,
    paddingLeft: 30,
    paddingRight: 12,
    paddingVertical: 8,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  counterBoxRight: {
    position: 'absolute',
    right: -30,
    top: 0,
    minWidth: 80,
    paddingLeft: 12,
    paddingRight: 30,
    paddingVertical: 8,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  counterIconOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    ...typography.styles.headline,
    color: '#fff',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  horizontalButtonRow: {
    flexDirection: 'row',
    width: '93%',
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  horizontalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    // 9.5 + 18 + 14 + 9.5 = 51: the same height as before the 16/12 text bump.
    paddingVertical: 9.5,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
    borderRightWidth: 0,
    borderColor: '#e0e0e0',
  },
  horizontalButtonText: {
    ...typography.styles.headline,
  },
  timeButtonTextColumn: {
    flexShrink: 1,
    alignItems: 'center',
  },
  timeButtonLabel: {
    ...typography.styles.headline,
    fontSize: 16, // between the body (15) and bodyLarge (17) steps, by request
    lineHeight: 18,
    textAlign: 'center',
  },
  timeButtonTime: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.caption,
    lineHeight: 14,
    opacity: 0.85,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    // The 48px touch targets hold ~28px icons: pull the row up by that empty
    // space so the gap above the icons looks the same as the one above the bar.
    marginTop: -10,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 30,
  },
  deckProgressBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 36,
  },
  deckProgressText: {
    ...typography.styles.bodyLarge,
    fontFamily: fonts.bold,
  },
  progressBarContainer: {
    width: '91%',
    alignSelf: 'center',
    height: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
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
    width: 300,
    height: 300,
  },
  loadingText: {
    ...typography.styles.bodyLarge,
    textAlign: 'center',
  },
});