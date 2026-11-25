import React, { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable, Platform, BackHandler, ScrollView, Image, Modal, useWindowDimensions } from 'react-native';
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
import { getDeckById, getDeckSpeechLanguages } from '../../services/DeckService';
// expo-speech / expo-audio are native modules. Builds made before they were
// added (and OTA updates landing on them) don't have the native side, and the
// module throws on import, so load them defensively: no Speech = no speaker
// button; no audio module = speech still works, just muted in silent mode.
let Speech = null;
try { Speech = require('expo-speech'); } catch { Speech = null; }
let ExpoAudio = null;
try { ExpoAudio = require('expo-audio'); } catch { ExpoAudio = null; }
import { invalidateCache, hasSeenSwipeTutorial, markSwipeTutorialSeen } from '../../services/CacheService';
import { getActivitySummary, invalidateActivitySummary } from '../../services/ProfileService';
import { listChapters, mergeChapterProgressIntoCache } from '../../services/ChapterService';
import { useAuth } from '../../contexts/AuthContext';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { addFavoriteCard, removeFavoriteCard, getFavoriteCardIds } from '../../services/FavoriteService';
import LottieView from 'lottie-react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import * as BlockService from '../../services/BlockService';
import ReportModal from '../../components/modals/ReportModal';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import SwipeFlipCard, { Pill, SectionDivider, SwipeCardActions } from '../../components/layout/SwipeFlipCard';
import { SwipeCardStage } from '../../components/layout/SwipeCardDeck';
import VoiceSettingsSheet from '../../components/modals/VoiceSettingsSheet';
import {
  LANGUAGE_SORT_ORDER,
  LEGACY_RATE_INDEX_TO_RATE,
  SPEECH_RATE,
  SPEECH_RATES,
  TTS_PREFS_KEY,
  VOICE_SAMPLES,
  pickBestVoice,
  stripForSpeech,
  toSpeechLocale,
  voicesForLocale,
} from '../../lib/speech';
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
  const { t, i18n } = useTranslation();
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
  const closeExpanded = useCallback(() => {
    setExpandedVisible(false);
    // iOS clears it in the Modal's onDismiss; Android has no such callback.
    if (Platform.OS !== 'ios') setExpandedCard(null);
  }, []);
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

  // Text-to-speech: only on an explicit tap of the card's speaker button.
  // Each face reads in its own deck language (decks_languages.side); the back
  // falls back to the front language, a deck with no language to the app's.
  const [speechLangs, setSpeechLangs] = useState({ front: null, back: null });
  const [speakingCardId, setSpeakingCardId] = useState(null);
  useEffect(() => {
    if (!deck?.id) return;
    let cancelled = false;
    getDeckSpeechLanguages(deck.id, i18n.language)
      .then((langs) => { if (!cancelled) setSpeechLangs(langs); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [deck?.id, i18n.language]);

  // Installed voices. Loaded on mount and again when the voice sheet opens
  // (Android's TTS engine can return an empty list while it starts up).
  const voicesRef = useRef([]);
  const [voices, setVoices] = useState([]);
  const loadVoices = useCallback(() => {
    if (!Speech) return;
    Speech.getAvailableVoicesAsync()
      .then((list) => {
        const next = list || [];
        // Skip the update (and the re-render) when nothing changed.
        const sameList = next.length === voicesRef.current.length
          && next.every((v, i) => v.identifier === voicesRef.current[i]?.identifier);
        if (sameList) return;
        voicesRef.current = next;
        setVoices(next);
      })
      .catch(() => {});
  }, []);
  useEffect(() => { loadVoices(); }, [loadVoices]);

  // Voice settings (rate + chosen voice per language), device-wide. The ref
  // lets handleSpeak read them without being recreated on every change.
  const [ttsPrefs, setTtsPrefs] = useState({ rate: SPEECH_RATE, voices: {} });
  const ttsPrefsRef = useRef(ttsPrefs);
  ttsPrefsRef.current = ttsPrefs;
  useEffect(() => {
    AsyncStorage.getItem(TTS_PREFS_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        let rate = SPEECH_RATE;
        if (SPEECH_RATES.includes(saved?.rate)) rate = saved.rate;
        else if (LEGACY_RATE_INDEX_TO_RATE[saved?.rateIndex] != null) rate = LEGACY_RATE_INDEX_TO_RATE[saved.rateIndex];
        setTtsPrefs({
          rate,
          voices: saved?.voices && typeof saved.voices === 'object' ? saved.voices : {},
        });
      })
      .catch(() => {});
  }, []);
  const updateTtsPrefs = useCallback((change) => {
    setTtsPrefs((prev) => {
      const next = {
        rate: change.rate ?? prev.rate,
        voices: { ...prev.voices, ...(change.voices || {}) },
      };
      AsyncStorage.setItem(TTS_PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  // The user's voice for this language if it is still installed, else the best.
  const resolveVoice = useCallback((locale) => {
    const base = (locale || '').slice(0, 2).toLowerCase();
    const chosen = ttsPrefsRef.current.voices[base];
    if (chosen && voicesRef.current.some((v) => v.identifier === chosen)) return chosen;
    return pickBestVoice(voicesRef.current, locale);
  }, []);
  const currentRate = useCallback(() => ttsPrefsRef.current.rate ?? SPEECH_RATE, []);

  // Audio session: speak even with the ring/silent switch on (user-started
  // playback), and only duck other apps' audio (e.g. music) while speaking.
  // The session is released after each utterance so their volume comes back.
  const audioModeReadyRef = useRef(false);
  const activateSpeechAudio = useCallback(async () => {
    if (!ExpoAudio) return;
    try {
      if (!audioModeReadyRef.current) {
        await ExpoAudio.setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
        audioModeReadyRef.current = true;
      }
      await ExpoAudio.setIsAudioActiveAsync(true);
    } catch {
      // Without the session the system default applies (muted in silent mode).
    }
  }, []);
  const releaseSpeechAudio = useCallback(() => {
    ExpoAudio?.setIsAudioActiveAsync(false).catch(() => {});
  }, []);

  const speakingCardIdRef = useRef(null);
  speakingCardIdRef.current = speakingCardId;
  const stopSpeaking = useCallback(() => {
    if (speakingCardIdRef.current == null) return;
    Speech?.stop();
    setSpeakingCardId(null);
  }, []);

  // A new card, a reverse-mode toggle or leaving the screen ends speech
  // (a flip ends it too, in handleCardFlip).
  useEffect(() => { stopSpeaking(); }, [currentIndex, isReversed, stopSpeaking]);

  // Called by the deck once per flip (the flip animation itself runs on the
  // UI thread). Only refs change here unless speech has to stop.
  const handleCardFlip = useCallback((index, flipped) => {
    const id = cardsRef.current[index]?.card_id ?? null;
    flippedCardIdRef.current = flipped ? id : null;
    stopSpeaking();
  }, [stopSpeaking]);
  useEffect(() => () => {
    Speech?.stop();
    ExpoAudio?.setIsAudioActiveAsync(false).catch(() => {});
  }, []);

  const handleSpeak = useCallback((id) => {
    if (!Speech) return;
    if (speakingCardId === id) {
      stopSpeaking();
      return;
    }
    const card = cardsRef.current.find((c) => c?.card_id === id)?.cards;
    if (!card) return;

    // Which face is showing, and which deck side it holds (reverse mode
    // puts the answer, i.e. the back-side content, on the front face).
    const showingBack = flippedCardIdRef.current === id;
    const isBackContent = showingBack !== isReversed;
    const text = stripForSpeech(isBackContent ? card.answer : card.question);
    if (!text) return;
    const code = (isBackContent ? speechLangs.back : speechLangs.front) || i18n.language;
    const locale = toSpeechLocale(code);

    Speech.stop();
    setSpeakingCardId(id);
    const done = () => {
      setSpeakingCardId((prev) => (prev === id ? null : prev));
      releaseSpeechAudio();
    };
    activateSpeechAudio().then(() => {
      Speech.speak(text, {
        language: locale,
        voice: resolveVoice(locale),
        rate: currentRate(),
        onDone: done,
        onStopped: done,
        onError: done,
      });
    });
  }, [activateSpeechAudio, currentRate, i18n.language, isReversed, releaseSpeechAudio, resolveVoice, speakingCardId, speechLangs, stopSpeaking]);

  // Voice sheet: one section per deck language (front first; one section when
  // both sides share a language).
  const voiceSections = useMemo(() => {
    const front = speechLangs.front || i18n.language;
    const back = speechLangs.back || front;
    const sideLabel = {
      front: t('swipeDeck.voice.front', 'Ön yüz'),
      back: t('swipeDeck.voice.back', 'Arka yüz'),
      both: t('swipeDeck.voice.bothSides', 'Ön ve arka yüz'),
    };
    const make = (code, side) => {
      const base = (code || '').slice(0, 2).toLowerCase();
      const locale = toSpeechLocale(code);
      const order = LANGUAGE_SORT_ORDER[base];
      return {
        base,
        locale,
        title: order ? t(`languages.${order}`) : base.toUpperCase(),
        sideLabel: sideLabel[side],
        voices: voicesForLocale(voices, locale),
      };
    };
    const frontBase = (front || '').slice(0, 2).toLowerCase();
    const backBase = (back || '').slice(0, 2).toLowerCase();
    if (frontBase === backBase) return [make(front, 'both')];
    return [make(front, 'front'), make(back, 'back')];
  }, [i18n.language, speechLangs, t, voices]);

  // Plays a short sample in the section's language with the given voice
  // (null = automatic) at the current rate, or at `rate` when given.
  const previewVoice = useCallback((identifier, locale, rate) => {
    if (!Speech) return;
    const base = (locale || '').slice(0, 2).toLowerCase();
    Speech.stop();
    setSpeakingCardId(null);
    activateSpeechAudio().then(() => {
      Speech.speak(VOICE_SAMPLES[base] || VOICE_SAMPLES.en, {
        language: locale,
        voice: identifier || pickBestVoice(voicesRef.current, locale),
        rate: rate ?? currentRate(),
        onDone: releaseSpeechAudio,
        onStopped: releaseSpeechAudio,
        onError: releaseSpeechAudio,
      });
    });
  }, [activateSpeechAudio, currentRate, releaseSpeechAudio]);

  const selectVoice = useCallback((base, identifier, locale) => {
    triggerHaptic('selection');
    updateTtsPrefs({ voices: { [base]: identifier } });
    previewVoice(identifier, locale);
  }, [previewVoice, updateTtsPrefs]);

  // A new speed is saved and heard right away, in the deck's front language.
  const handleRateChange = useCallback((rate) => {
    if (!SPEECH_RATES.includes(rate)) return;
    updateTtsPrefs({ rate });
    const locale = voiceSections[0]?.locale;
    if (locale) previewVoice(resolveVoice(locale), locale, rate);
  }, [previewVoice, resolveVoice, updateTtsPrefs, voiceSections]);

  const voiceSheetRef = useRef(null);
  const openVoiceSheet = useCallback(() => {
    voiceSheetRef.current?.present();
    // Refresh the voice list once the sheet has settled, so a changed list
    // never re-renders anything during the opening animation.
    setTimeout(loadVoices, 450);
  }, [loadVoices]);
  // The sheet opens only after the kebab menu has fully closed: two
  // animations at once (the menu's native fade + the sheet sliding up) were
  // what made the opening stutter.
  const openVoiceSheetAfterMenuRef = useRef(false);
  const handleMoreMenuDismiss = useCallback(() => {
    if (!openVoiceSheetAfterMenuRef.current) return;
    openVoiceSheetAfterMenuRef.current = false;
    openVoiceSheet();
  }, [openVoiceSheet]);
  const handleVoiceSheetDismiss = useCallback(() => {
    Speech?.stop();
  }, []);

  // App bar overflow (kebab) menu.
  const moreMenuRef = useRef(null);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [moreMenuPos, setMoreMenuPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const openMoreMenu = useCallback(() => {
    if (moreMenuRef.current?.measureInWindow) {
      moreMenuRef.current.measureInWindow((x, y, w, h) => {
        setMoreMenuPos({ x, y, width: w, height: h });
        setMoreMenuVisible(true);
      });
    } else {
      setMoreMenuVisible(true);
    }
  }, []);

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
  const seenCardIdsRef = useRef(new Set());
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
                <Iconify icon="material-symbols:swap-vert-rounded" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              ref={moreMenuRef}
              collapsable={false}
              onPress={() => {
                triggerHaptic('selection');
                requestAnimationFrame(openMoreMenu);
              }}
              activeOpacity={0.7}
              hitSlop={{
                top: 15,
                bottom: 15,
                left: 8,
                right: 8,
              }}
              accessibilityRole="button"
            >
              <Iconify
                icon="iconamoon:menu-kebab-horizontal-bold"
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        );
      },
    });
  }, [
    navigation,
    cards,
    currentIndex,
    loading,
    openMoreMenu,
    isReversed,
    toggleReversed,
    t,
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
    const progress = Math.min(1, Math.max(0, -activeSwipeX.value / Math.max(90, cardWidthValue.value * 0.28)));
    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 1],
        [leftInactiveColor, leftActiveColor]
      ),
    };
  }, [cardWidthValue, leftActiveColor, leftInactiveColor]);

  const animatedRightCounter = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, activeSwipeX.value / Math.max(90, cardWidthValue.value * 0.28)));
    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 1],
        [rightInactiveColor, rightActiveColor]
      ),
    };
  }, [cardWidthValue, rightActiveColor, rightInactiveColor]);

  const animatedLeftCount = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, -activeSwipeX.value / Math.max(90, cardWidthValue.value * 0.28)));
    return {
      opacity: interpolate(progress, [0, 0.14, 0.28], [1, 0.5, 0], 'clamp'),
    };
  }, [cardWidthValue]);

  const animatedRightCount = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, activeSwipeX.value / Math.max(90, cardWidthValue.value * 0.28)));
    return {
      opacity: interpolate(progress, [0, 0.14, 0.28], [1, 0.5, 0], 'clamp'),
    };
  }, [cardWidthValue]);

  const animatedLeftIcon = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, -activeSwipeX.value / Math.max(90, cardWidthValue.value * 0.28)));
    return {
      opacity: interpolate(progress, [0, 0.10, 0.30], [0, 0.28, 1], 'clamp'),
      transform: [{ scale: interpolate(progress, [0, 0.16, 0.34], [0.78, 0.94, 1], 'clamp') }],
    };
  }, [cardWidthValue]);

  const animatedRightIcon = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, activeSwipeX.value / Math.max(90, cardWidthValue.value * 0.28)));
    return {
      opacity: interpolate(progress, [0, 0.10, 0.30], [0, 0.28, 1], 'clamp'),
      transform: [{ scale: interpolate(progress, [0, 0.16, 0.34], [0.78, 0.94, 1], 'clamp') }],
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

  const fetchMoreCards = useCallback(async () => {
    if (sessionTargetCount > 0 && sessionProgressCountRef.current >= sessionTargetCount) return;
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
  }, [userId, commitIncomingCards, sessionTargetCount]);

  const checkDueReinserts = useCallback(async () => {
    if (sessionTargetCount > 0 && sessionProgressCountRef.current >= sessionTargetCount) return;
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
  }, [commitIncomingCards, sessionTargetCount]);

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
    if (undoDisabled || history.length === 0 || !sessionIdRef.current) return;
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
    const gradientColors = getCategoryColors(categorySortOrder);
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
  }, [categorySortOrder, colors.cardBackground, colors.text, getCategoryColors, handleBackOverflowChange, isReversed, leftActiveColor, rightActiveColor]);

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
        onSpeakPress={Speech ? handleSpeak : undefined}
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
    // The backend session summary can lag behind the UI write. The right
    // counter is the authoritative in-session "learned" value for the
    // completion screen because it is updated at swipe commit time.
    const sessionLearned = rightCount;
    const sessionPlanned = Math.max(0, sessionTargetCount - sessionLearned);
    const chapterProgress = completionSummary?.chapterProgress;
    const chapterLearned = chapterProgress?.learned || 0;
    const chapterUnfinished = chapterProgress ? chapterProgress.total - chapterLearned : 0;
    const chapterPercent = chapterProgress?.total
      ? Math.round((chapterLearned / chapterProgress.total) * 100)
      : 0;
    const completionActivity = completionSummary?.activity;
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
              <Text style={[styles.completionReviewMetric, { color: colors.text }]}>{nearestReview ? formatFutureReview(nearestReview.at, t) : '—'}</Text>
              <Text style={[typography.styles.caption, styles.completionReviewLabel, { color: colors.muted }]}>{nearestReview ? t('swipeDeck.completion.cardsReady', { count: nearestReview.count, defaultValue: `${nearestReview.count} kart hazır` }) : t('swipeDeck.completion.nearestReview', 'En yakın tekrar')}</Text>
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
      <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom, paddingTop: insets.top + 50 }]}>
        <ScrollView contentContainerStyle={[styles.completionContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.completionHero}>
            <LinearGradient colors={[colors.buttonColor, '#FF6B35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.completionHeroCard}>
              <View style={styles.completionHeroTitleRow}>
                <Iconify icon="material-symbols:trophy" size={36} color="#FFFFFF" />
                <Text style={[typography.styles.h2, styles.completionTitle, { color: '#FFFFFF' }]}>{t('swipeDeck.completion.title', 'Oturum Tamamlandı!')}</Text>
              </View>
              <View style={styles.completionHeroMetricCircle}>
                <Text style={[styles.completionHeroMetric, { color: '#FFFFFF' }]}>{sessionTargetCount}</Text>
                <Text style={[typography.styles.body, styles.completionHeroLabel, { color: 'rgba(255,255,255,0.88)' }]}>{t('swipeDeck.completion.cardsStudied', 'Kart Çalışıldı')}</Text>
              </View>
              <View style={styles.completionHeroSessionStats}>
                <View style={styles.completionHeroSessionStat}>
                  <Text style={styles.completionHeroSessionNumber}>
                    {sessionLearned ?? '—'}
                  </Text>
                  <Text style={styles.completionHeroSessionLabel}>
                    {t('swipeDeck.completion.learned', 'Öğrenildi')}
                  </Text>
                </View>

                <View style={styles.completionHeroSessionDivider} />

                <View style={styles.completionHeroSessionStat}>
                  <Text style={styles.completionHeroSessionNumber}>
                    {sessionPlanned ?? '—'}
                  </Text>
                  <Text style={styles.completionHeroSessionLabel}>
                    {t('swipeDeck.completion.reviewPlanned', 'Tekrar Planlandı')}
                  </Text>
                </View>

                <View style={styles.completionHeroSessionDivider} />

                <View style={styles.completionHeroSessionStat}>
                  <Text style={styles.completionHeroSessionNumber}>
                    {totalSwipeCount ?? '—'}
                  </Text>
                  <Text style={styles.completionHeroSessionLabel}>
                    {t('swipeDeck.completion.totalSwipes', 'Toplam Kaydırma')}
                  </Text>
                </View>
              </View>
              {completionActivity ? (
                <View style={styles.completionGoalRow}>
                  <Iconify
                    icon={completionActivity.today_goal_met ? 'mdi:fire' : 'lets-icons:clock-fill'}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.completionGoalText} numberOfLines={2}>
                    {completionActivity.today_goal_met
                      ? t('swipeDeck.completion.goalDone', {
                        count: completionActivity.current_streak,
                        defaultValue: `Günlük hedef tamam! Seri: ${completionActivity.current_streak} gün`,
                      })
                      : t('swipeDeck.completion.goalLeft', {
                        count: Math.max((completionActivity.daily_goal ?? 0) - (completionActivity.today_swipes ?? 0), 0),
                        defaultValue: `Günlük hedefe ${Math.max((completionActivity.daily_goal ?? 0) - (completionActivity.today_swipes ?? 0), 0)} kart kaldı`,
                      })}
                  </Text>
                </View>
              ) : null}
            </LinearGradient>
          </View>

          <View style={[styles.completionChapterCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <View style={styles.completionChapterHeader}>
              <View style={styles.completionChapterTitleRow}>
                <Iconify icon="streamline-flex:module-puzzle-2" size={20} color={colors.buttonColor} />
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
                <Iconify icon="lets-icons:clock-fill" size={22} color={colors.buttonColor} />
                <View style={styles.completionReviewTextGroup}>
                  <Text style={[styles.completionReviewMetric, { color: colors.text }]}>{nearestReview ? formatFutureReview(nearestReview.at, t) : '—'}</Text>
                  <Text style={[typography.styles.caption, styles.completionReviewLabel, { color: colors.muted }]}>{nearestReview ? t('swipeDeck.completion.cardsReady', { count: nearestReview.count, defaultValue: `${nearestReview.count} kart hazır` }) : t('swipeDeck.completion.nearestReview', 'En yakın tekrar')}</Text>
                </View>
              </View>
              <View style={styles.completionReviewItem}>
                <Iconify icon="solar:calendar-bold" size={22} color={colors.secondary} />
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
    const targetPadding = isCardTarget ? 10 : 6;
    const targetRadius = isCardTarget ? 26 : 12;
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
    const cornerCoverRadius = isCardTarget ? Math.min(spotlightRadius, 10) : spotlightRadius;
    const targetFrameStyle = hasValidTargetLayout ? {
      top: spotlightTop,
      left: spotlightLeft,
      width: spotlightWidth,
      height: spotlightHeight,
      borderRadius: spotlightRadius,
    } : null;
    const coachmarkPositionStyle = isCardTarget
      ? {
        top: targetLayout ? Math.max(54, targetLayout.y - 156) : 74,
        left: 18,
        right: 18,
      }
      : {
        left: 18,
        right: 18,
        bottom: targetFrameStyle
          ? Math.max(24, height - targetFrameStyle.top - 60)
          : 144 + insets.bottom,
      };
    const swipeDirectionHintPositionStyle = activeTutorialStep.showSwipeHint
      ? {
        top: (coachmarkPositionStyle.top ?? 74) + 340,
        left: 24,
        right: 24,
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
              <Iconify icon={activeTutorialStep.icon} size={20} color="#F98A21" />
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
                <Iconify icon="ion:arrow-undo" size={16} color="#FFFFFF" />
                <Text style={styles.swipeTutorialSwipeHintText}>{t('swipeDeck.tutorial.swipeHintLeft', 'Tekrar Et')}</Text>
              </View>
            </View>
            <View style={[styles.swipeTutorialSwipeBadge, styles.swipeTutorialSwipeBadgeRight]}>
              <View style={[styles.swipeTutorialSwipeBadgeGlow, styles.swipeTutorialSwipeBadgeGlowRight]} />
              <View style={[styles.swipeTutorialSwipeBadgeContent, styles.swipeTutorialSwipeBadgeContentRight]}>
                <Text style={styles.swipeTutorialSwipeHintText}>{t('swipeDeck.tutorial.swipeHintRight', 'Öğrendim')}</Text>
                <Iconify icon="ion:arrow-redo" size={16} color="#FFFFFF" />
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
              <Iconify icon="mingcute:time-fill" size={18} color="#fff" />
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
                    <Iconify icon="fluent:arrow-repeat-all-48-regular" size={22} color={colors.text} />
                  </View>
                  <Text style={[styles.deckProgressText, { color: colors.text }]}>{t('swipeDeck.vaktiGeldi', 'Vakti Geldi')}</Text>
                </View>
              );
            }
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {activeCardIsReinserted && (
                  <View style={iconWrapStyle}>
                    <Iconify icon="fluent:arrow-repeat-all-48-regular" size={18} color={colors.text} />
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
              <Iconify icon="streamline:check-solid" size={16} color="#fff" />
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
            onPress={() => handleSkip(15)}
            label={t('swipeDeck.levelHard', 'Zor')}
            time={t('swipeDeck.minutes', '15dk+')}
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
            time={t('swipeDeck.sevenDays', '7g+')}
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
            <Iconify icon="lets-icons:refund-back" size={28} color={colors.orWhite} />
          </TouchableOpacity>
          <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={[animatedStyle, {
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {autoPlay ? (
              <Iconify icon="material-symbols:pause-rounded" size={30} color={colors.orWhite} />
            ) : (
              <Iconify icon="streamline:button-play-solid" size={22} color={colors.orWhite} />
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

      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="fade"
        onDismiss={handleMoreMenuDismiss}
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setMoreMenuVisible(false)}>
          <View
            style={[
              styles.moreMenu,
              {
                // Right under the nav bar. Measuring the header button is unreliable (iOS 26 bar items).
                top: headerHeight + 6,
                backgroundColor: colors.cardBackground,
                borderColor: colors.cardBorder || colors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.moreMenuItem}
              activeOpacity={0.6}
              onPress={() => {
                triggerHaptic('selection');
                setMoreMenuVisible(false);
                toggleReversed();
              }}
            >
              <Iconify icon="material-symbols:swap-vert-rounded" size={20} color={colors.text} style={{ marginRight: 12 }} />
              <Text style={[typography.styles.body, { color: colors.text }]}>
                {isReversed ? t('swipeDeck.reverseOff', 'Normal çalış') : t('swipeDeck.reverseOn', 'Ters çevir')}
              </Text>
            </TouchableOpacity>

            {Speech ? (
              <>
                <View style={[styles.moreMenuDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  style={styles.moreMenuItem}
                  activeOpacity={0.6}
                  onPress={() => {
                    triggerHaptic('selection');
                    setMoreMenuVisible(false);
                    if (Platform.OS === 'ios') {
                      // Opened from the menu Modal's onDismiss.
                      openVoiceSheetAfterMenuRef.current = true;
                    } else {
                      // Android Modal has no onDismiss; its fade is ~200ms.
                      setTimeout(openVoiceSheet, 220);
                    }
                  }}
                >
                  <Iconify icon="solar:volume-loud-bold" size={20} color={colors.text} style={{ marginRight: 12 }} />
                  <Text style={[typography.styles.body, { color: colors.text }]}>
                    {t('swipeDeck.voice.settings', 'Ses ayarları')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            {!isOwner ? (
              <>
                <View style={[styles.moreMenuDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  style={styles.moreMenuItem}
                  activeOpacity={0.6}
                  onPress={() => {
                    triggerHaptic('light');
                    setMoreMenuVisible(false);
                    requestAnimationFrame(openReportCardModal);
                  }}
                >
                  <Iconify icon="ic:round-report-problem" size={20} color={colors.text} style={{ marginRight: 12 }} />
                  <Text style={[typography.styles.body, { color: colors.text }]}>
                    {t('moderation.reportCard', 'Kartı şikayet et')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={expandedVisible}
        onDismiss={() => setExpandedCard(null)}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={closeExpanded}
      >
        <View style={[styles.expandedSheet, { backgroundColor: colors.background }]}>
          <View style={[styles.expandedHeader, { paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 12 }]}>
            <Pressable
              onPress={closeExpanded}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('cardDetail.close', 'Kapat')}
              style={[styles.expandedCloseButton, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            >
              <Iconify icon="material-symbols:close-rounded" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={[styles.expandedContent, { paddingBottom: insets.bottom + 40 }]}>
            {/* Same look as the card's back face: category gradient, centred
                pill headings and dividers. Deck order is kept (question first)
                even in reverse mode. */}
            <View style={styles.expandedCard}>
              <LinearGradient
                colors={getCategoryColors(categorySortOrder)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {expandedCard?.cards?.question || expandedCard?.cards?.image ? (
                <>
                  <View style={styles.expandedSection}>
                    <Pill
                      label={t('cardDetail.question', 'Soru')}
                      icon={<Iconify icon="uil:comment-alt-question" size={18} color="#fff" />}
                    />
                    {expandedCard?.cards?.image ? (
                      <Image
                        source={{ uri: expandedCard.cards.image }}
                        style={styles.expandedImage}
                        fadeDuration={0}
                      />
                    ) : null}
                    {expandedCard?.cards?.question ? (
                      <Text style={[typography.styles.h2, styles.expandedPrimaryText]}>{expandedCard.cards.question}</Text>
                    ) : null}
                  </View>
                  <SectionDivider />
                </>
              ) : null}

              <View style={styles.expandedSection}>
                <Pill
                  label={t('swipeDeck.answer', 'Cevap')}
                  icon={<Iconify icon="uil:comment-alt-check" size={18} color="#fff" />}
                />
                <Text style={[typography.styles.h2, styles.expandedPrimaryText]}>{expandedCard?.cards?.answer}</Text>
              </View>

              {expandedCard?.cards?.example ? (
                <>
                  <SectionDivider />
                  <View style={styles.expandedSection}>
                    <Pill
                      label={t('swipeDeck.example', 'Örnek')}
                      icon={<Iconify icon="lucide:lightbulb" size={18} color="#fff" />}
                    />
                    <Text style={[typography.styles.subtitle, styles.expandedSubText]}>{expandedCard.cards.example}</Text>
                  </View>
                </>
              ) : null}

              {expandedCard?.cards?.note ? (
                <>
                  <SectionDivider />
                  <View style={styles.expandedSection}>
                    <Pill
                      label={t('swipeDeck.note', 'Not')}
                      icon={<Iconify icon="material-symbols-light:stylus-note" size={18} color="#fff" />}
                    />
                    <Text style={[typography.styles.subtitle, styles.expandedSubText, styles.expandedNoteText]}>{expandedCard.cards.note}</Text>
                  </View>
                </>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Voice settings: reading speed and a voice per deck language. */}
      <VoiceSettingsSheet
        sheetRef={voiceSheetRef}
        sections={voiceSections}
        rate={ttsPrefs.rate}
        chosenVoices={ttsPrefs.voices}
        onSelectVoice={selectVoice}
        onRateChange={handleRateChange}
        onDismiss={handleVoiceSheetDismiss}
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
    borderWidth: 2,
    borderColor: '#F98A21',
    backgroundColor: 'transparent',
    shadowColor: '#F98A21',
    shadowOpacity: 0.5,
    shadowRadius: 10,
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
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 2,
    elevation: 10001,
  },
  swipeTutorialCardInGroup: {
    position: 'relative',
  },
  swipeTutorialStepPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(249,138,33,0.14)',
    marginBottom: 10,
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
    gap: 8,
    marginBottom: 6,
  },
  swipeTutorialDescription: {
    ...typography.styles.body,
    lineHeight: 21,
  },
  swipeTutorialSwipeHint: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: 10,
    zIndex: 2,
    elevation: 10001,
  },
  swipeTutorialSwipeBadge: {
    width: 148,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F98A21',
    overflow: 'hidden',
    shadowColor: '#F98A21',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  swipeTutorialSwipeBadgeLeft: {
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 26,
    transform: [{ skewX: '-5deg' }],
  },
  swipeTutorialSwipeBadgeRight: {
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 26,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 10,
    transform: [{ skewX: '5deg' }],
  },
  swipeTutorialSwipeBadgeGlow: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  swipeTutorialSwipeBadgeGlowLeft: {
    left: -12,
    top: -8,
  },
  swipeTutorialSwipeBadgeGlowRight: {
    right: -12,
    top: -8,
  },
  swipeTutorialSwipeBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
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
    bottom: -10,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#F98A21',
  },
  swipeTutorialArrowUp: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#F98A21',
    transform: [{ rotate: '45deg' }],
  },
  swipeTutorialActions: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  swipeTutorialGhostButton: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  swipeTutorialGhostText: {
    ...typography.styles.button,
    fontWeight: '700',
  },
  swipeTutorialNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swipeTutorialBackButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  swipeTutorialDisabledButton: {
    opacity: 0.42,
  },
  swipeTutorialBackText: {
    ...typography.styles.button,
    fontWeight: '700',
  },
  swipeTutorialNextButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F98A21',
  },
  swipeTutorialNextText: {
    ...typography.styles.button,
    color: '#FFFFFF',
    fontWeight: '800',
  },


  // Dedicated action row. It stays outside the scrollable card content.
  reverseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  moreMenu: {
    position: 'absolute',
    right: 16,
    minWidth: 180,
    borderRadius: 14,
    paddingVertical: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  moreMenuDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  expandedSheet: {
    flex: 1,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  expandedCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 40,
  },
  // "Show more" sheet card, mirroring SwipeFlipCard's back face.
  expandedCard: {
    borderRadius: 26,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 8,
  },
  expandedSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  expandedImage: {
    width: '100%',
    height: 180,
    resizeMode: 'contain',
    borderRadius: 24,
    marginBottom: 8,
  },
  expandedPrimaryText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 28,
    fontWeight: '600',
  },
  expandedSubText: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    fontSize: 16,
  },
  expandedNoteText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 15,
    fontStyle: 'italic',
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
    borderRadius: 12,
    overflow: 'hidden',
  },
  horizontalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
    borderRightWidth: 0,
    borderColor: '#e0e0e0',
  },
  horizontalButtonText: {
    ...typography.styles.button,
  },
  timeButtonTextColumn: {
    flexShrink: 1,
    alignItems: 'center',
  },
  timeButtonLabel: {
    ...typography.styles.button,
    fontSize: 14,
    lineHeight: 17,
    textAlign: 'center',
  },
  timeButtonTime: {
    fontFamily: 'Inter',
    fontSize: 11,
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
    ...typography.styles.subtitle,
    fontWeight: '700',
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
    ...typography.styles.subtitle,
    textAlign: 'center',
  },
  completionContent: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  completionHero: {
    width: '100%',
    alignItems: 'center',
    zIndex: 1,
    marginBottom: 22,
  },
  completionGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  completionGoalText: {
    ...typography.styles.button,
    fontSize: 14,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  completionHeroCard: {
    width: '100%',
    alignItems: 'center',
    borderRadius: 30,
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 20,
    overflow: 'hidden',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  completionHeroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  completionHeroMetricCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  completionTitle: {
    textAlign: 'center',
    marginBottom: 0,
  },
  completionHeroMetric: {
    fontSize: 52,
    fontWeight: '800',
    lineHeight: 56,
  },
  completionHeroLabel: {
    fontWeight: '700',
  },
  completionHeroSessionStats: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  completionHeroSessionStat: {
    flex: 1,
    alignItems: 'center',
  },
  completionHeroSessionNumber: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  completionHeroSessionLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  completionHeroSessionDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },






  emptyCompletionContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyCompletionIcon: {
    fontSize: 44,
    marginBottom: 16,
  },
  emptyCompletionTitle: {
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyCompletionInfo: {
    width: '100%',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
  },
  emptyCompletionTime: {
    marginTop: 6,
    textAlign: 'center',
  },
  completionChapterCard: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
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
    gap: 8,
  },
  completionChapterProgressValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  completionChapterProgressTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 16,
  },
  completionChapterProgressFill: {
    height: '100%',
    borderRadius: 6,
  },

  completionChapterMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  completionChapterDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 18,
  },
  completionReviewGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  completionReviewItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  completionReviewTextGroup: {
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },

  completionReviewMetric: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  completionReviewLabel: {
    marginTop: 1,
    textAlign: 'center',
  },












  completionButton: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  completionCtaArea: {
    width: '100%',
    marginTop: 4,
    marginBottom: 28,
  },
  completionButtonRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
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
    marginTop: 6,
  },
  completionNextMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  completionNextMetaSpacer: {
    flex: 1,
  },
});