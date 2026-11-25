import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Pressable, Image, Switch, Animated, RefreshControl } from 'react-native';
import { Text } from '../../components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Alert, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getDeckById, getDeckLanguages } from '../../services/DeckService';
import { getAllCardsForDeck } from '../../services/CardService';
import { getFavoriteDeckIds, getFavoriteCardIds } from '../../services/FavoriteService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import CircularProgress from '../../components/ui/CircularProgress';
import { useAuth } from '../../contexts/AuthContext';
import { listChapters, getDeckChaptersProgressRpc } from '../../services/ChapterService';
import { deleteDeck, updateDeckShare, insertDeckStats } from '../../services/DeckService';
import { getDeckProgressCounts } from '../../services/CardService';
import { addFavoriteDeck, removeFavoriteDeck } from '../../services/FavoriteService';
import * as BlockService from '../../services/BlockService';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import ReportModal from '../../components/modals/ReportModal';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { MenuView } from '@expo/ui/community/menu';
import { triggerHaptic } from '../../lib/hapticManager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal, BottomSheetFlatList } from '@expo/ui/community/bottom-sheet';
// Lists open at half height and drag up to full (iOS medium/large detents,
// Android partial/expanded).
const LIST_SNAP_POINTS = ['50%', '100%'];
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import HeroPullBackdrop from '../../components/layout/HeroPullBackdrop';
import { useListBottomInset } from '../../components/ui/CustomTabBar';

// Hero gradient direction (colours come from the deck's category).
const HERO_GRADIENT_START = { x: 0, y: 0 };
const HERO_GRADIENT_END = { x: 1, y: 1 };
// Category watermark size in the hero.
const HERO_ICON_SIZE = 240;

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

/** Çıkış animasyonunda opacity/transform sabitlenir; bileşen tipi değişmez (ScrollView remount flash'ı önlenir) */
function EntranceBlock({ anim, style, children, scaleFrom, translateYFrom = 0, opacityOnly = false }) {
  const isFocused = useIsFocused();

  if (!isFocused) {
    return (
      <Animated.View style={[style, { opacity: 1 }]}>
        {children}
      </Animated.View>
    );
  }

  const animatedStyle = { opacity: anim };
  if (!opacityOnly) {
    const transform = [];
    if (scaleFrom != null) {
      transform.push({
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [scaleFrom, 1] }),
      });
    }
    if (translateYFrom) {
      transform.push({
        translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [translateYFrom, 0] }),
      });
    }
    if (transform.length > 0) {
      animatedStyle.transform = transform;
    }
  }
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export default function DeckDetailScreen({ route, navigation }) {

  const insets = useSafeAreaInsets();
  const listBottomInset = useListBottomInset();
  const [deck, setDeck] = useState(() => route.params?.deck);
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const isFocused = useIsFocused();
  // Favori durumunu route.params'dan al (eğer varsa), yoksa false
  const [isFavorite, setIsFavorite] = useState(deck?.is_favorite || false);
  const [favLoading, setFavLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLoading, setProgressLoading] = useState(true);
  const [learnedCardsCount, setLearnedCardsCount] = useState(0);
  const [deckStats, setDeckStats] = useState({ total: 0, learned: 0, learning: 0, new: 0 });
  const [cards, setCards] = useState([]);
  const [showAddCardHint, setShowAddCardHint] = useState(false);
  const [search, setSearch] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [cardSort, setCardSort] = useState('original'); // 'original', 'az', 'fav'
  const [originalCards, setOriginalCards] = useState([]);
  // Header kebab menu actions, read through a ref from the setOptions closure.
  const moreMenuActionsRef = useRef({});
  // The creator chip's size, so the native menu trigger laid over it matches.
  const [creatorChipSize, setCreatorChipSize] = useState({ width: 0, height: 0 });
  const onCreatorChipLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    setCreatorChipSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportModalType, setReportModalType] = useState('user');
  const [reportModalTargetId, setReportModalTargetId] = useState(null);
  const [reportModalAlreadyCodes, setReportModalAlreadyCodes] = useState([]);
  const chaptersFetchedRef = useRef(false);
  /** Aynı anda birden fazla fetchChapters; eski cevap state'i güncellemesin */
  const chaptersFetchGenRef = useRef(0);
  /** Ekran unmount olduysa (stack'ten çıkıldıysa) setState yapılmasın */
  const deckDetailMountedRef = useRef(true);
  /** Blur sonrası (pop animasyonu dahil) async cevaplar state güncellemesin */
  const detailScreenActiveRef = useRef(true);

  const canApplyDetailState = useCallback(
    () => deckDetailMountedRef.current && detailScreenActiveRef.current,
    []
  );

  useEffect(() => {
    deckDetailMountedRef.current = true;
    return () => {
      deckDetailMountedRef.current = false;
    };
  }, []);

  // Session'dan user ID'yi al (eğer varsa)
  const initialUserId = session?.user?.id || null;
  const [currentUserId, setCurrentUserId] = useState(initialUserId);
  // Başlangıçta session varsa ve kullanıcı deste sahibi ise true yap
  const [shareComponentVisible, setShareComponentVisible] = useState(
    initialUserId ? deck?.user_id === initialUserId : false
  );
  const [isShared, setIsShared] = useState(deck?.is_shared || false);
  const [shareLoading, setShareLoading] = useState(false);
  const [categoryInfo, setCategoryInfo] = useState(deck?.categories || null);
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbarHelpers();
  const nameScrollRef = useRef(null);
  const toNameScrollRef = useRef(null);
  const [nameHasOverflow, setNameHasOverflow] = useState(deck?.name?.length > 21);
  const [toNameHasOverflow, setToNameHasOverflow] = useState(deck?.to_name?.length > 21);
  const [nameContainerWidth, setNameContainerWidth] = useState(0);
  const [nameContentWidth, setNameContentWidth] = useState(0);
  const [toNameContainerWidth, setToNameContainerWidth] = useState(0);
  const [toNameContentWidth, setToNameContentWidth] = useState(0);
  const nameScrollHintDone = useRef(false);
  const toNameScrollHintDone = useRef(false);
  const nameLayoutDone = useRef(false);
  const toNameLayoutDone = useRef(false);
  const [chapters, setChapters] = useState([]);
  const [chapterProgressMap, setChapterProgressMap] = useState(new Map());
  const [decksLanguages, setDecksLanguages] = useState([]);
  // "Aksiyon" özel bölümü - tüm kartları gösterir
  const ACTION_CHAPTER = { id: 'action', name: 'Aksiyon', ordinal: null };
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [chapterSheetVisible, setChapterSheetVisible] = useState(false);
  const [chapterProgressLoading, setChapterProgressLoading] = useState(false);
  const [chapterProgressLoadedCount, setChapterProgressLoadedCount] = useState(0);
  const chapterProgressLoadedRef = useRef(false);
  const chapterProgressJobRef = useRef(0);
  /** Aynı anda iki fetch (prefetch + sheet açılışı) çakışmasın */
  const chapterProgressPromiseRef = useRef(null);
  /** onRefresh gibi üstte tanımlı callback'ler güncel fetchChapterProgress'e erişsin */
  const fetchChapterProgressRef = useRef(async () => { });
  const chapterSheetModalRef = useRef(null);
  /** Başlat’a basıldığında bölüm yoksa sheet açılır; ilk seçimde doğrudan çalışmaya git */
  const autoStartAfterChapterPickRef = useRef(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  // 120+ karakter genelde 3 satırı aşar (tahmin)
  const [descriptionNeedsExpand, setDescriptionNeedsExpand] = useState(deck?.description?.length > 120);
  const descriptionLayoutDone = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const { height: screenHeight } = useWindowDimensions();

  // Animation values for entrance effects (Android: giriş animasyonu kapalı — çıkışta opacity flash riski)
  const entranceStart = Platform.OS === 'android' ? 1 : 0;
  const heroAnim = useRef(new Animated.Value(entranceStart)).current;
  const statsAnim = useRef(new Animated.Value(entranceStart)).current;
  const cardsAnim = useRef(new Animated.Value(entranceStart)).current;

  // Pull-to-refresh backdrop (see HeroPullBackdrop): measured hero size + a
  // native scroll offset.
  const [heroSize, setHeroSize] = useState(null);
  const onHeroLayout = useCallback((e) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setHeroSize((prev) => (prev && Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }));
  }, []);
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY]
  );
  const addCardFabPressed = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      detailScreenActiveRef.current = true;
      return () => {
        detailScreenActiveRef.current = false;
      };
    }, [])
  );

  useEffect(() => {
    const lockExitUi = () => {
      detailScreenActiveRef.current = false;
      chapterProgressJobRef.current += 1;
      chaptersFetchGenRef.current += 1;
      heroAnim.setValue(1);
      statsAnim.setValue(1);
      cardsAnim.setValue(1);
      chapterSheetModalRef.current?.dismiss();
    };
    const beforeRemoveSub = navigation.addListener('beforeRemove', lockExitUi);
    const blurSub = navigation.addListener('blur', lockExitUi);
    return () => {
      beforeRemoveSub();
      blurSub();
    };
  }, [navigation, heroAnim, statsAnim, cardsAnim]);

  const addCardFabAnimatedStyle = useAnimatedStyle(() => {
    const springConfig = { mass: 0.5, damping: 30, stiffness: 400 };
    return {
      transform: [{ scale: withSpring(addCardFabPressed.value ? 0.92 : 1, springConfig) }],
      opacity: withSpring(addCardFabPressed.value ? 0.85 : 1, springConfig),
    };
  });

  useEffect(() => {
    const loadDecksLanguages = async () => {
      try {
        const ids = await getDeckLanguages(deck.id);
        if (!canApplyDetailState()) return;
        setDecksLanguages(ids);
      } catch (e) {
        console.error('Deste dilleri yüklenemedi:', e);
      }
    };
    loadDecksLanguages();
  }, [deck.id, canApplyDetailState]);

  useEffect(() => {
    if (Platform.OS === 'android') return;
    Animated.stagger(120, [
      Animated.spring(heroAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(statsAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(cardsAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroAnim, statsAnim, cardsAnim]);

  // Initial deck verisi için is_admin_created kontrolü
  useEffect(() => {
    if (deck?.is_admin_created && deck?.profiles) {
      setDeck((prev) => {
        if (!prev?.profiles) return prev;
        return {
          ...prev,
          profiles: { ...prev.profiles, username: 'Knowia', image_url: null },
        };
      });
    }
  }, []); // Sadece mount'ta çalış

  if (!deck) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, typography.styles.body, { color: colors.error }]}>{t('deckDetail.errorMessage', 'Deste bilgisi bulunamadı.')}</Text>
      </SafeAreaView>
    );
  }

  // Scroll hint animation - kaydırılabilir olduğunu kullanıcıya göstermek için
  const triggerScrollHint = (scrollRef, contentWidth, containerWidth, hintDoneRef) => {
    if (hintDoneRef.current || !scrollRef.current) return;
    if (contentWidth <= containerWidth) return;

    hintDoneRef.current = true;
    // Sadece taşan kadar scroll yap
    const scrollDistance = contentWidth - containerWidth;

    // Daha hızlı başlasın
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: scrollDistance, animated: true });
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: 0, animated: true });
      }, 600);
    }, 300);
  };

  // Cache'den progress'i yükle (hızlı gösterim için)
  const loadCachedProgress = async () => {
    try {
      const storageKey = `deck_progress_${deck.id}_${session?.user?.id || 'guest'}`;
      const cached = await AsyncStorage.getItem(storageKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        // Cache'deki veri çok eski değilse (1 saat içindeyse) kullan
        const cacheAge = Date.now() - (cachedData.timestamp || 0);
        if (cacheAge < 3600000) { // 1 saat
          if (!canApplyDetailState()) return false;
          setProgress(cachedData.progress || 0);
          setLearnedCardsCount(cachedData.learned || 0);
          setDeckStats(cachedData.stats || { total: deck.card_count || 0, learned: 0, learning: 0, new: deck.card_count || 0 });
          setProgressLoading(false); // Cache'den geldi, loading'i kapat
          return true; // Cache kullanıldı
        }
      }
    } catch (e) {
      console.error('Error loading cached progress:', e);
    }
    return false; // Cache kullanılmadı
  };

  const fetchProgress = async (useCache = true) => {
    // Önce cache'den yükle (eğer isteniyorsa)
    if (useCache) {
      const cacheUsed = await loadCachedProgress();
      if (cacheUsed) {
        // Cache kullanıldı, arka planda güncel veriyi çek (loading gösterme)
        // setTimeout ile biraz geciktir ki cache önce görünsün
        setTimeout(() => {
          if (canApplyDetailState()) {
            fetchProgressFromAPI(false);
          }
        }, 100);
        return;
      }
    }

    // Cache yoksa veya kullanılmıyorsa direkt API'den çek
    await fetchProgressFromAPI(true);
  };

  const fetchProgressFromAPI = async (showLoading = true) => {
    if (!canApplyDetailState()) return;
    if (showLoading) {
      setProgressLoading(true);
    }
    try {
      const stats = await getDeckProgressCounts(userId, deck.id);
      if (!canApplyDetailState()) {
        if (showLoading) setProgressLoading(false);
        return;
      }

      const calculatedProgress = stats.total > 0 ? stats.learned / stats.total : 0;

      setProgress(calculatedProgress);
      setLearnedCardsCount(stats.learned);
      setDeckStats(stats);

      try {
        const storageKey = `deck_progress_${deck.id}_${userId}`;
        await AsyncStorage.setItem(storageKey, JSON.stringify({
          progress: calculatedProgress,
          learned: stats.learned,
          stats,
          timestamp: Date.now()
        }));
      } catch (cacheError) {
        console.error('Error caching progress:', cacheError);
      }

      if (showLoading) {
        setProgressLoading(false);
      }
    } catch (e) {
      if (!canApplyDetailState()) {
        if (showLoading) setProgressLoading(false);
        return;
      }
      console.error('Progress fetch error:', e);
      setProgress(0);
      if (showLoading) {
        setProgressLoading(false);
      }
    }
  };

  // Favori durumunu route.params'dan güncelle (eğer deck.is_favorite varsa)
  useEffect(() => {
    if (deck?.is_favorite !== undefined) {
      setIsFavorite(deck.is_favorite);
    } else if (deck?.id && session?.user?.id) {
      const fetchFavoriteStatus = async () => {
        try {
          const favIds = await getFavoriteDeckIds(session.user.id);
          if (!canApplyDetailState()) return;
          setIsFavorite(favIds.includes(deck.id));
        } catch (e) {
          if (!canApplyDetailState()) return;
          setIsFavorite(false);
        }
      };
      fetchFavoriteStatus();
    }
  }, [deck?.is_favorite, deck?.id, session?.user?.id]);

  // Progress'i hemen yüklemeye başla (deck varsa) - Cache'den önce yükle
  useEffect(() => {
    if (deck?.id) {
      // Cache'den hızlıca yükle, sonra API'den güncelle
      fetchProgress(true); // useCache = true
    }
  }, [deck?.id, session?.user?.id]); // deck.id ve session değiştiğinde tekrar yükle

  // Sayfa focus olduğunda progress ve deck verisini güncelle (useFocusEffect + isActive:
  // geri tuşuyla çıkış sırasında tamamlanan API cevapları setState / params mutasyonu yapmasın;
  // ara ara DeckDetail'in bir anlığına yeniden görünmesine yol açabiliyordu.)
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const run = async () => {
        await fetchProgressFromAPI(false);
        if (!isActive || !canApplyDetailState()) return;

        try {
          const [freshDeck, favIds] = await Promise.all([
            getDeckById(deck.id),
            userId ? getFavoriteDeckIds(userId) : Promise.resolve([]),
          ]);
          if (!isActive || !canApplyDetailState()) return;
          const isFav = userId ? favIds.includes(deck.id) : false;
          if (freshDeck) {
            if (freshDeck.is_admin_created && freshDeck.profiles) {
              freshDeck.profiles = { ...freshDeck.profiles, username: 'Knowia', image_url: null };
            }
            freshDeck.is_favorite = isFav;
            setDeck(freshDeck);
            setCategoryInfo(freshDeck.categories);
            setIsShared(freshDeck.is_shared || false);
          }
          setIsFavorite(isFav);
        } catch (e) {
          console.error('Deck verisi güncellenemedi:', e);
        }
      };

      run();
      return () => {
        isActive = false;
      };
    }, [deck.id, userId, canApplyDetailState])
  );

  const onRefresh = useCallback(async () => {
    if (!deck?.id) return;
    setRefreshing(true);
    try {
      const uid = userId;

      // 1. ADIM: Sadece temel bilgileri çek (Hafif istekler)
      const [deckData, favDeckIds, langIds] = await Promise.all([
        getDeckById(deck.id, true),
        uid ? getFavoriteDeckIds(uid, true) : Promise.resolve([]),
        getDeckLanguages(deck.id),
      ]);

      if (deckData) {
        if (deckData.is_admin_created && deckData.profiles) {
          deckData.profiles = { ...deckData.profiles, username: 'Knowia', image_url: null };
        }
        if (canApplyDetailState()) {
          setDeck(deckData);
          setCategoryInfo(deckData.categories);
          setIsFavorite(uid ? favDeckIds.includes(deck.id) : false);
        }
      }

      // 2. ADIM: İstatistikleri (Toplam, Learned, Learning) güncelle
      // Bu fonksiyon getDeckProgressCounts'u çağırır ve hafiftir.
      await fetchProgressFromAPI(false);

      // 3. ADIM: Bölüm progress özetini tazele (sheet + seçili bölüm %)
      if (uid && chapters.length > 0) {
        await fetchChapterProgressRef.current(true);
      }

      // DİKKAT: getAllCardsForDeck silindi. 2800 kartlık yük kalktı!

    } catch (e) {
      console.error('DeckDetail refresh error:', e);
    } finally {
      if (canApplyDetailState()) {
        setRefreshing(false);
      }
    }
  }, [deck?.id, userId, chapters.length, canApplyDetailState]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredCards(cards);
    } else {
      const s = search.trim().toLowerCase();
      setFilteredCards(
        cards.filter(
          c => (c.question && c.question.toLowerCase().includes(s)) || (c.answer && c.answer.toLowerCase().includes(s))
        )
      );
    }
  }, [search, cards]);

  useEffect(() => {
    const fetchFavoriteCards = async () => {
      if (!userId) {
        if (canApplyDetailState()) setFavoriteCards([]);
        return;
      }
      try {
        const ids = await getFavoriteCardIds(userId);
        if (!canApplyDetailState()) return;
        setFavoriteCards(ids);
      } catch (e) {
        if (!canApplyDetailState()) return;
        setFavoriteCards([]);
      }
    };
    fetchFavoriteCards();
  }, [deck.id, userId, canApplyDetailState]);

  useEffect(() => {
    setFilteredCards(sortCards(cardSort, cards));
  }, [cardSort, cards, originalCards, favoriteCards]);

  // Session değiştiğinde kontrol et (AuthContext'ten gelen session)
  useEffect(() => {
    const userId = session?.user?.id || null;
    setCurrentUserId(userId);

    // Eğer kullanıcı deste sahibi ise share component'i göster, değilse gizle
    if (userId && deck?.user_id === userId) {
      setShareComponentVisible(true);
    } else {
      setShareComponentVisible(false);
    }
  }, [session, deck?.user_id]);


  // Son seçilen chapter'ı AsyncStorage'dan yükle
  const loadLastSelectedChapter = async (availableChapters) => {
    try {
      const storageKey = `last_selected_chapter_${deck.id}`;
      const savedChapterId = await AsyncStorage.getItem(storageKey);
      if (!canApplyDetailState()) return;

      if (savedChapterId) {
        // Eğer "action" seçiliyse
        if (savedChapterId === 'action') {
          if (!canApplyDetailState()) return;
          setSelectedChapter(ACTION_CHAPTER);
          return;
        }

        // Kaydedilmiş chapter'ı bul
        const savedChapter = availableChapters.find(ch => ch.id === savedChapterId);
        if (savedChapter) {
          if (!canApplyDetailState()) return;
          setSelectedChapter(savedChapter);
          return;
        }
      }

      // Eğer kayıtlı chapter bulunamazsa veya yoksa: hiçbir seçim yapma (kullanıcı seçsin)
      if (!canApplyDetailState()) return;
      setSelectedChapter(null);
    } catch (e) {
      console.error('Error loading last selected chapter:', e);
      if (!canApplyDetailState()) return;
      setSelectedChapter(null);
    }
  };

  // Seçilen chapter'ı AsyncStorage'a kaydet
  const saveLastSelectedChapter = async (chapter) => {
    try {
      const storageKey = `last_selected_chapter_${deck.id}`;
      const chapterId = chapter?.id;
      if (!chapterId) {
        await AsyncStorage.removeItem(storageKey);
        return;
      }
      await AsyncStorage.setItem(storageKey, chapterId);
    } catch (e) {
      console.error('Error saving last selected chapter:', e);
      // Hata durumunda sessizce geç
    }
  };

  // Chapter seçimini yap ve kaydet (wrapper fonksiyon)
  const handleChapterSelect = (chapter) => {
    setSelectedChapter(chapter);
    saveLastSelectedChapter(chapter);
  };

  // Chapter'ları çek (mount ve focus'ta sessiz yenileme için kullanılır)
  const fetchChapters = useCallback(async () => {
    if (!deck?.id) return;
    const gen = ++chaptersFetchGenRef.current;
    try {
      const data = await listChapters(deck.id);
      if (gen !== chaptersFetchGenRef.current || !canApplyDetailState()) return;
      const availableChapters = data || [];
      setChapters(availableChapters);
      chaptersFetchedRef.current = true;

      // Son seçilen chapter'ı yükle
      await loadLastSelectedChapter(availableChapters);
      if (gen !== chaptersFetchGenRef.current || !canApplyDetailState()) return;

    } catch (e) {
      console.error('Error fetching chapters:', e);
      if (gen !== chaptersFetchGenRef.current || !canApplyDetailState()) return;
      setChapters([]);
      setSelectedChapter(null);
    }
  }, [deck?.id, currentUserId, canApplyDetailState]);

  useEffect(() => {
    chaptersFetchedRef.current = false;
    chapterProgressLoadedRef.current = false;
    setChapterProgressMap(new Map());
    setChapterProgressLoadedCount(0);
    if (deck?.id) {
      fetchChapters();
    }
  }, [deck?.id, currentUserId, fetchChapters]);

  useFocusEffect(
    useCallback(() => {
      if (chaptersFetchedRef.current) {
        fetchChapters();
      }
      chapterProgressLoadedRef.current = false;
      const raf = requestAnimationFrame(() => {
        fetchChapterProgressRef.current?.(false, { silent: true });
      });
      return () => cancelAnimationFrame(raf);
    }, [fetchChapters])
  );

  const fetchChapterProgress = useCallback(async (force = false, options = {}) => {
    const { silent = false } = options;
    if (!currentUserId || chapters.length === 0) return;
    if (!force && chapterProgressLoadedRef.current) return;
    if (!force && chapterProgressPromiseRef.current) {
      return chapterProgressPromiseRef.current;
    }
    if (force) {
      chapterProgressPromiseRef.current = null;
    }

    const jobId = ++chapterProgressJobRef.current;
    if (!silent && canApplyDetailState()) {
      setChapterProgressLoading(true);
    }
    if (force && canApplyDetailState()) {
      setChapterProgressMap(new Map());
      setChapterProgressLoadedCount(0);
      chapterProgressLoadedRef.current = false;
    }

    let p;
    p = (async () => {
      try {
        const progressMap = await getDeckChaptersProgressRpc(deck.id, currentUserId, force);
        if (!canApplyDetailState() || chapterProgressJobRef.current !== jobId) return;
        setChapterProgressMap(progressMap);
        setChapterProgressLoadedCount(chapters.length);
        chapterProgressLoadedRef.current = true;
      } catch (e) {
        console.error('Error fetching chapter progress:', e);
      } finally {
        if (!silent && canApplyDetailState() && chapterProgressJobRef.current === jobId) {
          setChapterProgressLoading(false);
        }
        if (chapterProgressPromiseRef.current === p) {
          chapterProgressPromiseRef.current = null;
        }
      }
    })();

    chapterProgressPromiseRef.current = p;
    return p;
  }, [chapters, currentUserId, deck.id, canApplyDetailState]);

  fetchChapterProgressRef.current = fetchChapterProgress;

  // İlk frame'lerden sonra bölüm progress'ini sessizce önden yükle (sheet açılınca hazır olsun; InteractionManager kaldırıldı)
  useEffect(() => {
    if (!currentUserId || chapters.length === 0) return undefined;
    let cancelled = false;
    let raf2 = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) fetchChapterProgress(false);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      if (raf2 != null) cancelAnimationFrame(raf2);
    };
  }, [chapters, currentUserId, deck.id, fetchChapterProgress]);

  const openChapterSheet = useCallback(async () => {
    triggerHaptic('light');
    autoStartAfterChapterPickRef.current = false;
    setChapterSheetVisible(true);
    // Open sheet immediately; fetch progress in background for faster perceived opening.
    fetchChapterProgress(false);
  }, [fetchChapterProgress]);

  useEffect(() => {
    if (chapterSheetVisible) {
      chapterSheetModalRef.current?.present();
      return;
    }
    chapterSheetModalRef.current?.dismiss();
  }, [chapterSheetVisible]);

  const navigateToSwipeDeck = useCallback(
    async (chapter) => {
      try {
        if (userId) {
          await insertDeckStats(deck.id, userId);
        }
      } catch (error) {
        console.log('Deck stats log error:', error);
      }
      const chapterParam = chapter?.id === 'action' ? undefined : chapter;
      navigation.navigate('SwipeDeck', { deck, chapter: chapterParam });
    },
    [userId, deck, navigation]
  );

  const handleStartDeck = useCallback(async () => {
    triggerHaptic('heavy');

    if (!selectedChapter?.id) {
      autoStartAfterChapterPickRef.current = true;
      setChapterSheetVisible(true);
      // Do not block sheet opening on network.
      fetchChapterProgress(false);
      return;
    }

    await navigateToSwipeDeck(selectedChapter);
  }, [selectedChapter, fetchChapterProgress, navigateToSwipeDeck]);

  const selectedChapterProgress = selectedChapter?.id === 'action'
    ? deckStats
    : (selectedChapter?.id ? chapterProgressMap.get(selectedChapter.id) : null);
  const selectedChapterLearnedPct = selectedChapterProgress?.total > 0
    ? Math.round((selectedChapterProgress.learned / selectedChapterProgress.total) * 100)
    : null;

  const handleToggleFavorite = async () => {
    // 1. KULLANICIYI BEKLETME: Kalbi anında doldur/boşalt ve titret
    const previousState = isFavorite;
    setIsFavorite(!previousState);
    triggerHaptic('medium');

    // 2. ARKA PLAN: Kullanıcı kalbi değişmiş görürken biz sessizce veritabanını güncelliyoruz
    try {
      if (!userId) return;

      if (previousState) {
        // Önceden favoriydi, demek ki butona basıp ÇIKARDI
        await removeFavoriteDeck(userId, deck.id);
      } else {
        // Önceden favori değildi, demek ki butona basıp EKLEDİ
        await addFavoriteDeck(userId, deck.id);
      }
    } catch (e) {
      // 3. HATA DURUMU: İnternet koptuysa kalbi çaktırmadan eski haline geri çevir (Rollback)
      setIsFavorite(previousState);
    }
  };

  const updateShareSetting = async (newValue) => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      await updateDeckShare(deck.id, userId, newValue);

      setIsShared(newValue);
      setDeck((prev) => (prev ? { ...prev, is_shared: newValue } : prev));
      Alert.alert(t('common.success', 'Success'), t('deckDetail.shareUpdated', 'Sharing settings updated'));
    } catch (e) {
      Alert.alert(t('common.error', 'Error'), t('deckDetail.shareUpdateError', 'Sharing settings could not be updated'));
    } finally {
      setShareLoading(false);
    }
  };

  const handleToggleShare = (nextValue) => {
    if (shareLoading) return;
    triggerHaptic('medium');
    if (nextValue) {
      // Açarken: switch hemen açılır, onay iste
      setIsShared(true);
      Alert.alert(
        t('common.warning', 'Uyarı'),
        t(
          'deckDetail.shareConfirmMessage',
          'Desteyi toplulukta paylaştıktan sonra bölümlerde herhangi bir değişiklik yapamayacaksın. Onaylıyor musun?'
        ),
        [
          {
            text: t('common.no', 'Hayır'),
            style: 'cancel',
            onPress: () => setIsShared(false),
          },
          { text: t('common.yes', 'Evet'), onPress: () => updateShareSetting(true) },
        ],
        { cancelable: true }
      );
    } else {
      // Kapatırken: switch hemen kapanır, onay iste; Evet derse false yap
      setIsShared(false);
      Alert.alert(
        t('common.warning', 'Uyarı'),
        t(
          'deckDetail.shareUnshareConfirmMessage',
          'Desteyi topluluktan kaldırmak istediğine emin misin? Artık diğer kullanıcılar bu desteyi göremeyecek.'
        ),
        [
          {
            text: t('common.no', 'Hayır'),
            style: 'cancel',
            onPress: () => setIsShared(true), // iptal ederse tekrar aç
          },
          { text: t('common.yes', 'Evet'), onPress: () => updateShareSetting(false) },
        ],
        { cancelable: true }
      );
    }
  };

  const handleShowShareDetails = () => {
    Alert.alert(
      t('deckDetail.shareDetails', 'Community Sharing Details'),
      t('deckDetail.shareDetailsText', 'When this deck is shared with the community, it can be viewed and used by other users. You can disable sharing at any time.')
    );
  };

  // Delete deck fonksiyonu
  const handleDeleteDeck = async () => {
    Alert.alert(
      t('deckDetail.deleteDeck', 'Desteyi Sil'),
      t('deckDetail.deleteConfirmMessage', 'Bu desteyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('common.delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDeck(deck.id);

              Alert.alert(
                t('common.success', 'Başarılı'),
                t('deckDetail.deleteSuccess', 'Deste başarıyla silindi.'),
                [{ text: t('common.ok', 'Tamam'), onPress: () => navigation.goBack() }]
              );
            } catch (e) {
              Alert.alert(
                t('common.error', 'Hata'),
                t('deckDetail.deleteError', 'Deste silinirken bir hata oluştu.')
              );
            }
          },
        },
      ],
      { cancelable: true }
    );
  };



  const openReportUserModal = async () => {
    if (!deck?.user_id) return;
    if (!userId) { showError(t('common.error')); return; }
    try {
      const codes = await BlockService.getMyReportReasonCodesForTarget(userId, 'user', deck.user_id);
      setReportModalAlreadyCodes(codes);
      setReportModalType('user');
      setReportModalTargetId(deck.user_id);
      setReportModalVisible(true);
    } catch (e) {
      showError(e?.message || t('common.error'));
    }
  };

  const handleBlockUser = () => {
    if (!deck?.user_id) return;
    Alert.alert(
      t('moderation.blockUser'),
      t('moderation.confirmBlock'),
      [
        { text: t('moderation.cancel'), style: 'cancel' },
        {
          text: t('common.ok'),
          onPress: async () => {
            try {
              if (!userId) { showError(t('common.error')); return; }
              await BlockService.blockUser(userId, deck.user_id);
              showSuccess(t('moderation.blocked'));
              navigation.goBack();
            } catch (err) {
              showError(err?.message || t('common.error'));
            }
          },
        },
      ]
    );
  };

  const handleHideDeck = async () => {
    if (!deck?.id) return;
    try {
      if (!userId) { showError(t('common.error')); return; }
      await BlockService.hideDeck(userId, deck.id);
      showSuccess(t('moderation.deckHidden'));
      navigation.goBack();
    } catch (e) {
      showError(e?.message || t('common.error'));
    }
  };

  const openReportDeckModal = async () => {
    if (!deck?.id) return;
    if (!userId) { showError(t('common.error')); return; }
    try {
      const codes = await BlockService.getMyReportReasonCodesForTarget(userId, 'deck', deck.id);
      setReportModalAlreadyCodes(codes);
      setReportModalType('deck');
      setReportModalTargetId(deck.id);
      setReportModalVisible(true);
    } catch (e) {
      showError(e?.message || t('common.error'));
    }
  };

  const handleReportModalSubmit = async (reasonCode, reasonText) => {
    if (!userId || !reportModalTargetId) return;
    try {
      if (reportModalType === 'user') {
        await BlockService.reportUser(userId, reportModalTargetId, reasonCode, reasonText);
      } else if (reportModalType === 'deck') {
        await BlockService.reportDeck(userId, reportModalTargetId, reasonCode, reasonText);
      }
      showSuccess(t('moderation.reportReceived'));
    } catch (e) {
      if (e?.code === '23505') showError(t('moderation.alreadyReported'));
      else showError(e?.message || t('common.error'));
      throw e;
    }
  };

  // A native menu runs its action as it closes; wait for that before
  // presenting a sheet so the two animations don't overlap.
  moreMenuActionsRef.current = {
    edit: () => navigation.navigate('DeckEdit', {
      deck,
      categoryInfo: categoryInfo || deck.categories || null,
      selectedLanguageIds: decksLanguages,
    }),
    delete: handleDeleteDeck,
    report: () => setTimeout(openReportDeckModal, 250),
    hide: handleHideDeck,
  };

  // Header'a ikonları ekle
  React.useLayoutEffect(() => {
    if (!isFocused) return;
    navigation.setOptions({
      headerTransparent: true,
      headerStyle: { backgroundColor: 'transparent' },
      // iOS 26 draws a soft scroll-edge shadow under a transparent nav bar.
      // The hero already starts under the bar, so the band would split the
      // hero from the pull-to-refresh backdrop. Hide it at the top only.
      scrollEdgeEffects: { top: 'hidden', bottom: 'automatic', left: 'automatic', right: 'automatic' },
      headerTintColor: '#FFFFFF',
      title: '',
      headerRight: () => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            paddingHorizontal: 8,
            minWidth: 72,
          }}
        >
          <TouchableOpacity
            onPress={handleToggleFavorite}
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 8, right: 8 }}
          >
            <Iconify
              icon={isFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={24}
              color={isFavorite ? '#F98A21' : colors.text}
            />
          </TouchableOpacity>

          <View style={{ width: 24, alignItems: 'center' }}>
            {currentUserId ? (
              <MenuView
                actions={
                  deck?.user_id === currentUserId
                    ? [
                        { id: 'edit', title: t('deckDetail.edit', 'Desteyi Düzenle'), image: 'pencil' },
                        { id: 'delete', title: t('deckDetail.deleteDeck', 'Desteyi Sil'), image: 'trash', attributes: { destructive: true } },
                      ]
                    : [
                        { id: 'report', title: t('moderation.reportDeck'), image: 'exclamationmark.bubble' },
                        { id: 'hide', title: t('moderation.hideDeck'), image: 'eye.slash', attributes: { destructive: true } },
                      ]
                }
                onOpenMenu={() => triggerHaptic('selection')}
                onPressAction={({ nativeEvent }) => moreMenuActionsRef.current[nativeEvent.event]?.()}
                style={styles.headerMenuHost}
              >
                <View style={styles.headerMenuTrigger}>
                  <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={24} color={colors.text} />
                </View>
              </MenuView>
            ) : null}
          </View>
        </View>
      ),
    });
  }, [navigation, colors.text, isFavorite, currentUserId, deck?.user_id, isFocused, t]);

  const sortCards = (type, cardsList) => {
    if (type === 'az') {
      return [...cardsList].sort((a, b) => (a.question || '').localeCompare(b.question || '', 'tr'));
    } else if (type === 'fav') {
      return [...cardsList].filter(card => favoriteCards.includes(card.id));
    } else {
      return [...originalCards];
    }
  };

  // Kategori ikonunu sort_order değerine göre al
  const getCategoryIcon = (sortOrder) => {
    const icons = {
      1: "hugeicons:language-skill", // Dil
      2: "clarity:atom-solid", // Bilim
      3: "mdi:math-compass", // Matematik
      4: "game-icons:tied-scroll", // Tarih
      5: "arcticons:world-geography-alt", // Coğrafya
      6: "map:museum", // Sanat ve Kültür
      7: "ic:outline-self-improvement", // Kişisel Gelişim
      8: "streamline-ultimate:module-puzzle-2-bold" // Genel Kültür
    };
    return icons[sortOrder] || "hugeicons:language-skill";
  };



  // Kategori rengine göre renk belirle (colors.js'deki categoryColors'dan ilk rengi al)
  const getCategoryColor = (sortOrder) => {
    if (colors.categoryColors && colors.categoryColors[sortOrder]) {
      return colors.categoryColors[sortOrder][0]; // Gradient'in ilk rengi
    }
    // Varsayılan renk
    return colors.buttonColor;
  };

  // Kategori gradient'i al
  const getCategoryGradient = (sortOrder) => {
    if (colors.categoryColors && colors.categoryColors[sortOrder]) {
      return colors.categoryColors[sortOrder];
    }
    return ['#F98A21', '#FF6B35'];
  };

  const showAddCardFab =
    currentUserId &&
    deck.user_id === currentUserId &&
    !isShared;

  useEffect(() => {
    // Kartlar bu ekranda performans için tek tek yüklenmiyor; güncel toplam deckStats'tan geliyor.
    if (deckStats.total > 0) {
      setShowAddCardHint(false);
      return;
    }

    // İlk yükleme tamamlanmadan gösterme; aksi halde dolu destelerde kısa bir flash oluşabilir.
    if (progressLoading || !showAddCardFab) return;

    let isActive = true;
    const loadAddCardHint = async () => {
      try {
        const seenHint = await AsyncStorage.getItem('knowia_seen_add_card_hint');
        if (isActive && !seenHint) {
          setShowAddCardHint(true);
        }
      } catch (e) {
        // Storage okunamasa da yönlendirme uygulama akışını etkilemesin.
        if (isActive) setShowAddCardHint(false);
      }
    };

    loadAddCardHint();
    return () => {
      isActive = false;
    };
  }, [deckStats.total, progressLoading, showAddCardFab]);

  const handleDismissAddCardHint = async () => {
    setShowAddCardHint(false);
    try {
      await AsyncStorage.setItem('knowia_seen_add_card_hint', 'true');
    } catch (e) {
      console.error('Add card hint could not be saved:', e);
    }
  };

  const handleAddCard = () => {
    // 1. İpucu varsa arka planda kapatmayı başlat (await ETMEDEN)
    if (showAddCardHint) {
      handleDismissAddCardHint();
    }

    // 2. Buton animasyon durumunu sıfırla
    addCardFabPressed.value = 0;

    // 3. Anında geri bildirim ver ve sayfaya geç
    triggerHaptic('light');
    requestAnimationFrame(() => {
      navigation.navigate('AddCard', { deck });
    });
  };
  
  // The add-card FAB (~56 tall) sits at the bottom; leave room for it.
  const scrollContentPaddingBottom = listBottomInset + (showAddCardFab ? 76 : 0);

  const heroGradientColors = getCategoryGradient(categoryInfo?.sort_order);
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <HeroPullBackdrop
        scrollY={scrollY}
        heroSize={heroSize}
        colors={heroGradientColors}
        start={HERO_GRADIENT_START}
        end={HERO_GRADIENT_END}
      />

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: scrollContentPaddingBottom }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          isFocused ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
              colors={[colors.buttonColor]}
              // The hero starts under the status bar; keep the spinner below it.
              progressViewOffset={insets.top}
            />
          ) : undefined
        }
      >
        {/* GRADIENT FLOW DESIGN - Modern & Eye-catching */}

        {/* Hero Gradient Banner */}
        <EntranceBlock
          anim={heroAnim}
          scaleFrom={1.05}
          style={styles.gfHeroBanner}
        >
          <LinearGradient
            colors={heroGradientColors}
            start={HERO_GRADIENT_START}
            end={HERO_GRADIENT_END}
            style={[styles.gfHeroGradient, { paddingTop: insets.top + 60 }]}
            onLayout={onHeroLayout}
          >
            {/* Decorative Elements. Nothing touches the hero's top edge, so the
                pull-to-refresh stretch never reveals a clipped shape: the
                category watermark bleeds off the right edge only, balanced by a
                circle bleeding off the bottom-left. */}
            <View style={styles.gfHeroDecor} pointerEvents="none">
              <View style={styles.gfDecorIcon}>
                <Iconify icon={getCategoryIcon(categoryInfo?.sort_order)} size={HERO_ICON_SIZE} color="rgba(255,255,255,0.08)" style={{
                  transform: categoryInfo?.sort_order === 4 ? [{ scaleX: -1 }] : []
                }} />
              </View>
              <View style={[styles.gfDecorCircle, styles.gfDecorCircle3]} />
              <View style={[styles.gfDecorCircle, styles.gfDecorCircle2]} />
            </View>

            {/* Category Badge */}


            {/* Title - Scrollable if overflows */}
            <View style={styles.gfTitleContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Iconify icon="ion:book" size={28} color="#fff" />
                <ScrollView
                  ref={nameScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  scrollEnabled={nameHasOverflow}
                  style={{ flex: 1 }}
                  onContentSizeChange={(w) => {
                    setNameContentWidth(w);
                    if (nameContainerWidth > 0 && !nameLayoutDone.current) {
                      nameLayoutDone.current = true;
                      const hasOverflow = w > nameContainerWidth;
                      setNameHasOverflow(hasOverflow);
                      if (hasOverflow) {
                        triggerScrollHint(nameScrollRef, w, nameContainerWidth, nameScrollHintDone);
                      }
                    }
                  }}
                  onLayout={(e) => {
                    const containerW = e.nativeEvent.layout.width;
                    setNameContainerWidth(containerW);
                    if (nameContentWidth > 0 && !nameLayoutDone.current) {
                      nameLayoutDone.current = true;
                      const hasOverflow = nameContentWidth > containerW;
                      setNameHasOverflow(hasOverflow);
                      if (hasOverflow) {
                        triggerScrollHint(nameScrollRef, nameContentWidth, containerW, nameScrollHintDone);
                      }
                    }
                  }}
                >
                  <Text style={styles.gfHeroTitle}>{deck.name}</Text>
                </ScrollView>
              </View>
            </View>

            {/* Subtitle - Scrollable if overflows */}
            {deck.to_name && (
              <View style={styles.gfTitleContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Iconify icon="icon-park-outline:translation" size={28} color="#fff" />
                  <ScrollView
                    ref={toNameScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled={toNameHasOverflow}
                    style={{ flex: 1 }}
                    onContentSizeChange={(w) => {
                      setToNameContentWidth(w);
                      if (toNameContainerWidth > 0 && !toNameLayoutDone.current) {
                        toNameLayoutDone.current = true;
                        const hasOverflow = w > toNameContainerWidth;
                        setToNameHasOverflow(hasOverflow);
                        if (hasOverflow) {
                          triggerScrollHint(toNameScrollRef, w, toNameContainerWidth, toNameScrollHintDone);
                        }
                      }
                    }}
                    onLayout={(e) => {
                      const containerW = e.nativeEvent.layout.width;
                      setToNameContainerWidth(containerW);
                      if (toNameContentWidth > 0 && !toNameLayoutDone.current) {
                        toNameLayoutDone.current = true;
                        const hasOverflow = toNameContentWidth > containerW;
                        setToNameHasOverflow(hasOverflow);
                        if (hasOverflow) {
                          triggerScrollHint(toNameScrollRef, toNameContentWidth, containerW, toNameScrollHintDone);
                        }
                      }
                    }}
                  >
                    <Text style={styles.gfHeroSubtitle}>{deck.to_name}</Text>
                  </ScrollView>
                </View>
              </View>
            )}

            {/* Description - Expandable */}
            {deck.description && deck.description.trim().length > 0 && (
              <View>
                {/* Hidden text for measuring actual lines */}
                <Text
                  style={[styles.gfHeroDesc, { position: 'absolute', opacity: 0 }]}
                  onTextLayout={(e) => {
                    if (!descriptionLayoutDone.current) {
                      descriptionLayoutDone.current = true;
                      setDescriptionNeedsExpand(e.nativeEvent.lines.length > 2);
                    }
                  }}
                >
                  {deck.description}
                </Text>
                {/* Visible text */}
                <Text
                  style={styles.gfHeroDesc}
                  numberOfLines={descriptionExpanded ? undefined : 2}
                >
                  {deck.description}
                </Text>
                {descriptionNeedsExpand && (
                  <TouchableOpacity
                    onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                    activeOpacity={0.7}
                    style={styles.gfExpandButton}
                  >
                    <Text style={styles.gfExpandButtonText}>
                      {descriptionExpanded ? t('common.showLess', 'Daha az göster') : t('common.showMore', 'Daha fazla göster')}
                    </Text>
                    <View style={{ marginTop: 1 }}>
                      <Iconify
                        icon="flowbite:caret-down-solid"
                        size={14}
                        color="rgba(255,255,255,0.9)"
                        style={{ transform: [{ rotate: descriptionExpanded ? '180deg' : '0deg' }] }}
                      />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Creator Chip - admin veya user_id varsa göster; başkasının destesinde tıklanabilir (şikayet/engelle) */}
            {(deck.is_admin_created || deck.user_id) && (
              (currentUserId && deck.user_id !== currentUserId && !deck.is_admin_created) ? (
                <View style={styles.gfCreatorChipSlot}>
                <View style={[styles.gfCreatorChip, styles.gfCreatorChipInSlot]} onLayout={onCreatorChipLayout} pointerEvents="none">
                  <Image
                    source={
                      deck.profiles?.image_url
                        ? { uri: deck.profiles.image_url }
                        : require('../../assets/avatar_default.webp')
                    }
                    style={styles.gfCreatorAvatar}
                  />
                  <Text style={styles.gfCreatorName}>
                    {deck.profiles?.username || t('common.user', 'Kullanıcı')}
                  </Text>
                  <Iconify icon="flowbite:caret-down-solid" size={18} color="#fff" style={{ marginLeft: 2 }} />
                </View>
                <MenuView
                  actions={[
                    { id: 'reportUser', title: t('moderation.reportUser'), image: 'exclamationmark.bubble' },
                    { id: 'blockUser', title: t('moderation.blockUser'), image: 'hand.raised', attributes: { destructive: true } },
                  ]}
                  onOpenMenu={() => triggerHaptic('selection')}
                  onPressAction={({ nativeEvent }) => {
                    if (nativeEvent.event === 'reportUser') setTimeout(openReportUserModal, 250);
                    else if (nativeEvent.event === 'blockUser') handleBlockUser();
                  }}
                  style={StyleSheet.absoluteFill}
                >
                  <View style={creatorChipSize} />
                </MenuView>
                </View>
              ) : (
                <View style={styles.gfCreatorChip}>
                  <Image
                    source={
                      deck.is_admin_created
                        ? require('../../assets/app_icon.png')
                        : deck.profiles?.image_url
                          ? { uri: deck.profiles.image_url }
                          : require('../../assets/avatar_default.webp')
                    }
                    style={styles.gfCreatorAvatar}
                  />
                  <Text style={styles.gfCreatorName}>
                    {deck.profiles?.username || t('common.user', 'Kullanıcı')}
                  </Text>
                </View>
              )
            )}
          </LinearGradient>
        </EntranceBlock>

        <View style={[styles.gfLearningFlowCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBackground }]}>
          {/* Progress & Stats Card - Side by Side Layout */}
          <EntranceBlock
            anim={statsAnim}
            translateYFrom={40}
            style={[
              styles.gfProgressCard,
              {
                backgroundColor: 'transparent',
                shadowOpacity: 0,
                elevation: 0,
              },
            ]}
          >
            <View style={styles.gfCardContent}>
              {/* Left Side - Progress Ring */}
              <View style={styles.gfProgressSide}>
                <View style={[styles.gfProgressGlow, { backgroundColor: getCategoryColor(categoryInfo?.sort_order) + '15' }]} />
                <CircularProgress
                  progress={progress}
                  size={170}
                  strokeWidth={17}
                  showText={true}
                  shouldAnimate={!progressLoading}
                  fullCircle={true}
                />
              </View>

              {/* Right Side - Stats */}
              <View style={styles.gfStatsSide}>
                {/* Total Cards - Top Badge with Gradient */}
                <LinearGradient
                  colors={getCategoryGradient(categoryInfo?.sort_order)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gfTotalBadgeGradient}
                >
                  <Iconify icon="ri:stack-fill" size={18} color="#fff" />
                  <View style={styles.gfTotalBadgeTextWrap}>
                    <Text style={styles.gfTotalBadgeNumber}>{deckStats.total}</Text>
                    <Text style={styles.gfTotalBadgeLabel}>{t('deckDetail.cards', 'Kart')}</Text>
                  </View>
                </LinearGradient>

                {/* Stats List */}
                <View style={styles.gfStatsListVertical}>
                  <View style={styles.gfStatRowItem}>
                    <LinearGradient
                      colors={['#27AE60', '#2ECC71']}
                      style={styles.gfStatRowIcon}
                    >
                      <Iconify icon="dashicons:welcome-learn-more" size={18} color="#fff" />
                    </LinearGradient>
                    <View style={styles.gfStatRowText}>
                      <Text style={[styles.gfStatRowValue, { color: colors.cardQuestionText }]}>{deckStats.learned}</Text>
                      <Text style={[styles.gfStatRowLabel, { color: colors.muted }]}>{t('deckDetail.learned', 'Öğrenildi')}</Text>
                    </View>
                  </View>

                  <View style={styles.gfStatRowItem}>
                    <LinearGradient
                      colors={['#F98A21', '#FF6B35']}
                      style={styles.gfStatRowIcon}
                    >
                      <Iconify icon="mdi:fire" size={18} color="#fff" />
                    </LinearGradient>
                    <View style={styles.gfStatRowText}>
                      <Text style={[styles.gfStatRowValue, { color: colors.cardQuestionText }]}>{deckStats.learning}</Text>
                      <Text style={[styles.gfStatRowLabel, { color: colors.muted }]}>{t('deckDetail.learning', 'Öğreniliyor')}</Text>
                    </View>
                  </View>

                  <View style={styles.gfStatRowItem}>
                    <LinearGradient
                      colors={[colors.secondary, colors.secondary + 'CC']}
                      style={styles.gfStatRowIcon}
                    >
                      <Iconify icon="basil:eye-closed-outline" size={18} color="#fff" />
                    </LinearGradient>
                    <View style={styles.gfStatRowText}>
                      <Text style={[styles.gfStatRowValue, { color: colors.cardQuestionText }]}>{deckStats.new}</Text>
                      <Text style={[styles.gfStatRowLabel, { color: colors.muted }]}>{t('deckDetail.new', 'Yeni')}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </EntranceBlock>

          <View style={styles.gfLearningFlowDividerWrap}>
            <View style={[styles.gfLearningFlowDivider, { backgroundColor: colors.border }]} />
          </View>

          <EntranceBlock
            anim={cardsAnim}
            translateYFrom={24}
            style={[
              styles.gfStudyCard,
              {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                marginHorizontal: 0,
                marginBottom: 0,
                padding: 0,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.gfStudyChapterButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={openChapterSheet}
              activeOpacity={0.75}
            >
              <LinearGradient
                colors={[colors.secondary, colors.secondary + 'CC']}
                style={styles.gfStudyChapterIcon}
              >
                <Iconify icon="streamline-flex:module-puzzle-2" size={22} color="#fff" />
              </LinearGradient>
              <View style={styles.gfStudyTextWrap}>
                <Text style={[styles.gfStudyPrimaryText, { color: colors.cardQuestionText }]}>
                  {selectedChapter?.id === 'action'
                    ? t('deckDetail.action', 'Aksiyon')
                    : selectedChapter?.id
                      ? `${t('chapters.chapter', 'Bölüm')} ${selectedChapter.ordinal}`
                      : t('deckDetail.selectChapterCtaShort', 'Bölüm seç')}
                </Text>
                {!!selectedChapter?.id && (
                  <Text style={[styles.gfStudyMetaText, { color: colors.muted }]}>
                    %{selectedChapterLearnedPct ?? 0} {t('deckDetail.learned', 'öğrenildi')}
                  </Text>
                )}
              </View>
              <Iconify icon="flowbite:caret-down-solid" size={18} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.gfStartButton,
                { opacity: selectedChapter?.id ? 1 : 0.92 },
              ]}
              activeOpacity={0.85}
              onPress={handleStartDeck}
            >
              <LinearGradient
                colors={['#F98A21', '#FF6B35']}
                locations={[0, 0.99]}
                style={styles.gfStartButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.gfStartMain}>
                  <Iconify icon="streamline:button-play-solid" size={20} color="#fff" />
                  <Text style={styles.gfStartButtonText}>{t('deckDetail.start', 'Başla')}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </EntranceBlock>
        </View>

        {/* Action Buttons - Combined Card */}
        <EntranceBlock
          anim={cardsAnim}
          translateYFrom={30}
          style={[
            styles.gfActionsCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          {/* Cards Button */}
          <TouchableOpacity
            style={styles.gfActionRow}
            onPress={() => navigation.navigate('DeckCards', { deck })}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.buttonColor, colors.buttonColor + 'DD']}
              style={styles.gfActionIconBox}
            >
              <Iconify icon="ph:cards-fill" size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.gfActionTextWrap}>
              <Text style={[styles.gfActionTitle, { color: colors.cardQuestionText }]}>{t('deckDetail.cards', 'Kartlar')}</Text>
              <Text style={[styles.gfActionDesc, { color: colors.muted }]}>{t('deckDetail.browseCards', 'Tüm kartları görüntüle')}</Text>
            </View>
            <Iconify icon="ion:chevron-forward" size={22} color={colors.muted} />
          </TouchableOpacity>

          {/* Divider */}
          <View style={[styles.gfActionDivider, { backgroundColor: colors.border }]} />

          {/* Chapters Button */}
          <TouchableOpacity
            style={styles.gfActionRow}
            onPress={() => navigation.navigate('Chapters', { deck })}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.secondary, colors.secondary + 'DD']}
              style={styles.gfActionIconBox}
            >
              <Iconify icon="streamline-freehand:plugin-jigsaw-puzzle" size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.gfActionTextWrap}>
              <Text style={[styles.gfActionTitle, { color: colors.cardQuestionText }]}>{t('deckDetail.chapters', 'Bölümler')}</Text>
              <Text style={[styles.gfActionDesc, { color: colors.muted }]}>{chapters.length} {t('deckDetail.chaptersCount', 'bölüm')}</Text>
            </View>
            <Iconify icon="ion:chevron-forward" size={22} color={colors.muted} />
          </TouchableOpacity>
        </EntranceBlock>


        {/* Share Card - Modern Toggle */}
        {shareComponentVisible && (
          <EntranceBlock
            anim={cardsAnim}
            opacityOnly
            style={[
              styles.gfShareCard,
              { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.gfShareMainRow}>
              <LinearGradient
                colors={isShared ? ['#27AE60', '#2ECC71'] : [colors.muted + '30', colors.muted + '20']}
                style={styles.gfShareIconBg}
              >
                <Iconify icon="fluent:people-community-20-filled" size={22} color={isShared ? '#fff' : colors.muted} />
              </LinearGradient>
              <View style={styles.gfShareContent}>
                <Text style={[styles.gfShareTitle, { color: colors.cardQuestionText }]}>
                  {t('deckDetail.shareWithCommunity', 'Toplulukla Paylaş')}
                </Text>
                <Text style={[styles.gfShareStatus, { color: isShared ? '#27AE60' : colors.muted }]}>
                  {isShared ? t('deckDetail.sharedStatus', 'Herkes görebilir') : t('deckDetail.notSharedStatus', 'Sadece sen')}
                </Text>
              </View>
              <Switch
                value={isShared}
                onValueChange={handleToggleShare}
                trackColor={{ false: colors.progressBar, true: '#27AE60' + '70' }}
                thumbColor={isShared ? '#27AE60' : '#f4f3f4'}
                disabled={shareLoading}
              />
            </View>
            <TouchableOpacity
              style={[styles.gfShareInfoBtn, { borderTopColor: colors.border }]}
              onPress={handleShowShareDetails}
              activeOpacity={0.7}
            >
              <Iconify icon="material-symbols:info-outline" size={18} color={colors.secondary} />
              <Text style={[styles.gfShareInfoText, { color: colors.secondary }]}>
                {t('deckDetail.moreInfo', 'Daha fazla bilgi')}
              </Text>
            </TouchableOpacity>
          </EntranceBlock>
        )}
      </Animated.ScrollView>

      {isFocused && showAddCardFab && (
        <>
          {showAddCardHint && deckStats.total === 0 && (
            <Pressable
              accessibilityLabel="Kart ekleme yönlendirmesi"
              onPress={() => { }}
              style={styles.addCardHintOverlay}
            />
          )}

          {showAddCardHint && deckStats.total === 0 && (
            <View
              style={[
                styles.addCardCoachmark,
                {
                  bottom: insets.bottom + 102,
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={[styles.addCardCoachmarkArrow, { borderTopColor: colors.cardBackground }]} />
              <Text style={[styles.addCardHintTitle, { color: colors.cardQuestionText || colors.text }]}>
                {t('deckDetail.addCardHintTitle', 'İlk kartını ekle')}
              </Text>
              <Text style={[styles.addCardHintDescription, { color: colors.muted }]}>
                {t('deckDetail.addCardHintDescription', 'Bu butona dokunarak destene ilk kartını ekleyebilirsin.')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('deckDetail.addCardHintDismiss', 'Anladım')}
                onPress={handleDismissAddCardHint}
                style={({ pressed }) => [styles.addCardHintSecondaryButton, { borderColor: '#F98A21', opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={styles.addCardHintSecondaryButtonText}>{t('deckDetail.addCardHintDismiss', 'Anladım')}</Text>
              </Pressable>
            </View>
          )}

          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={t('deckDetail.addCard', 'Kart Ekle')}
            style={[
              styles.addCardFab,
              addCardFabAnimatedStyle,
              {
                bottom: insets.bottom + 24,
                zIndex: showAddCardHint ? 7 : 3,
                borderWidth: showAddCardHint ? 2 : 0,
                borderColor: showAddCardHint ? '#FFE1C2' : 'transparent',
                shadowColor: showAddCardHint ? '#F98A21' : '#000000',
                shadowOpacity: showAddCardHint ? 0.45 : 0.12,
                shadowRadius: showAddCardHint ? 6 : 4,
                elevation: showAddCardHint ? 3 : 2,
              },
            ]}
            onPressIn={() => {
              addCardFabPressed.value = 1;
            }}
            onPressOut={() => {
              addCardFabPressed.value = 0;
            }}
            onPress={handleAddCard}
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
        </>
      )}

      <BottomSheetModal
        ref={chapterSheetModalRef}
        index={0}
        onChange={(idx) => {
          if (idx === -1) {
            autoStartAfterChapterPickRef.current = false;
            if (canApplyDetailState()) {
              setChapterSheetVisible(false);
            }
          }
        }}
        backgroundStyle={{ backgroundColor: colors.background, borderRadius: 40 }}
        snapPoints={LIST_SNAP_POINTS}
        enablePanDownToClose
      >
        <View style={[styles.chapterSheetHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.chapterSheetTitle, { color: colors.cardQuestionText }]}>
            {t('deckDetail.selectChapterTitle', 'Bölüm seç')}
          </Text>
          <Text style={[styles.chapterSheetHeaderMeta, { color: colors.muted }]}>
            {chapterProgressLoading
              ? `${chapterProgressLoadedCount}/${chapters.length} ${t('common.loading', 'yükleniyor')}`
              : `${chapters.length} ${t('deckDetail.chaptersCount', 'bölüm')}`}
          </Text>
          <TouchableOpacity
            onPress={() => {
              autoStartAfterChapterPickRef.current = false;
              setChapterSheetVisible(false);
            }}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            style={styles.chapterSheetCloseBtn}
          >
            <Iconify icon="material-symbols:close-rounded" size={22} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <BottomSheetFlatList
          data={[ACTION_CHAPTER, ...chapters]}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={true}
          contentContainerStyle={[
            styles.chapterSheetList,
            { paddingBottom: 24 },
          ]}
          style={{ flex: 1 }}
            renderItem={({ item }) => {
            const isAction = item.id === 'action';
            const isSelected = selectedChapter?.id === item.id;
            const chapterProgress = isAction
              ? deckStats
              : (chapterProgressMap.get(item.id) || { total: 0, learned: 0, learning: 0, new: 0 });
            const hasProgress = isAction || chapterProgressMap.has(item.id);
            const chapterPct = chapterProgress.total > 0
              ? Math.round((chapterProgress.learned / chapterProgress.total) * 100)
              : 0;
            return (
              <TouchableOpacity
                style={[
                  styles.chapterSheetItem,
                  {
                    borderColor: isSelected ? colors.buttonColor : colors.border,
                    backgroundColor: isSelected ? colors.buttonColor + '16' : (colors.cardBackground || colors.background),
                  },
                ]}
                activeOpacity={0.78}
                onPress={async () => {
                  const shouldAutoStart = autoStartAfterChapterPickRef.current;
                  autoStartAfterChapterPickRef.current = false;
                  handleChapterSelect(item);
                  setChapterSheetVisible(false);
                  if (shouldAutoStart) {
                    await navigateToSwipeDeck(item);
                  }
                }}
              >
                {isAction ? (
                  <LinearGradient colors={['#F98A21', '#FF6B35']} style={styles.chapterSheetIcon}>
                    <Iconify icon="streamline:startup-solid" size={16} color="#fff" />
                  </LinearGradient>
                ) : (
                  <View style={styles.chapterSheetProgressBadge}>
                    <CircularProgress
                      progress={chapterProgress.total > 0 ? chapterProgress.learned / chapterProgress.total : 0}
                      size={34}
                      strokeWidth={4}
                      showText={false}
                      shouldAnimate={false}
                      fullCircle={true}
                    />
                    <View style={styles.fabChapterProgressTextContainer}>
                      <Text style={[styles.fabChapterProgressText, { color: colors.cardQuestionText }]}>
                        {chapterPct}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={styles.chapterSheetItemTextWrap}>
                  <Text style={[styles.chapterSheetItemTitle, { color: colors.cardQuestionText }]}>
                    {isAction ? t('deckDetail.action', 'Aksiyon') : `${t('chapters.chapter', 'Bölüm')} ${item.ordinal}`}
                  </Text>
                  {!hasProgress && !isAction ? (
                    <Text style={[styles.chapterSheetItemMeta, { color: colors.muted }]}>
                      {t('common.loading', 'Yükleniyor...')}
                    </Text>
                  ) : (
                    <View style={styles.chapterSheetStatRow}>
                      <View style={styles.chapterSheetStatItem}>
                        <Iconify icon="ri:stack-fill" size={13} color={colors.muted} />
                        <Text style={[styles.chapterSheetStatText, { color: colors.muted }]}>{chapterProgress.total || 0}</Text>
                      </View>
                      <View style={styles.chapterSheetStatItem}>
                        <Iconify icon="basil:eye-closed-outline" size={13} color={colors.muted} />
                        <Text style={[styles.chapterSheetStatText, { color: colors.muted }]}>{chapterProgress.new || 0}</Text>
                      </View>
                      <View style={styles.chapterSheetStatItem}>
                        <Iconify icon="mdi:fire" size={13} color={colors.muted} />
                        <Text style={[styles.chapterSheetStatText, { color: colors.muted }]}>{chapterProgress.learning || 0}</Text>
                      </View>
                      <View style={styles.chapterSheetStatItem}>
                        <Iconify icon="dashicons:welcome-learn-more" size={13} color={colors.muted} />
                        <Text style={[styles.chapterSheetStatText, { color: colors.muted }]}>{chapterProgress.learned || 0}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </BottomSheetModal>

      <ReportModal
        visible={reportModalVisible && isFocused}
        onClose={() => setReportModalVisible(false)}
        reportType={reportModalType}
        alreadyReportedCodes={reportModalAlreadyCodes}
        onSubmit={handleReportModalSubmit}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addCardHintOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 4,
  },
  addCardCoachmark: {
    position: 'absolute',
    right: 20,
    width: 280,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  addCardCoachmarkArrow: {
    position: 'absolute',
    right: 42,
    bottom: -9,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  addCardHintTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  addCardHintDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  addCardHintSecondaryButton: {
    alignSelf: 'flex-end',
    marginTop: 14,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addCardHintSecondaryButtonText: {
    color: '#F98A21',
    fontSize: 13,
    fontWeight: '800',
  },
  // GRADIENT FLOW STYLES - Modern & Eye-catching
  gfHeroBanner: {
    marginBottom: -50,

  },
  gfHeroGradient: {
    paddingBottom: 80,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    overflow: 'hidden',
  },
  gfHeroDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Category watermark: ~47% off the right edge, centred on the hero's visible
  // area (its bottom 50px sits under the stats cards, see gfHeroBanner).
  gfDecorIcon: {
    position: 'absolute',
    width: HERO_ICON_SIZE,
    height: HERO_ICON_SIZE,
    right: -HERO_ICON_SIZE * 0.47,
    top: '50%',
    marginTop: -HERO_ICON_SIZE / 2 - 25,
  },
  gfDecorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  // Bottom-left counterweight to the right-edge watermark. It bleeds off the
  // left edge and sits just above the stats-card overlap.
  gfDecorCircle2: {
    width: 110,
    height: 110,
    bottom: 56,
    left: -40,
  },
  // Small partner to gfDecorCircle2, diagonally up-right of it with a clear gap,
  // so the left side reads as one pair and the right side as the watermark.
  gfDecorCircle3: {
    width: 40,
    height: 40,
    bottom: 155,
    left: 75,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  gfCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 10,
    marginBottom: 16,
  },
  gfCategoryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  gfHeroTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 38,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  gfHeroSubtitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 38,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  gfTitleContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  gfHeroDesc: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 8,
  },
  gfExpandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 12,
    paddingVertical: 4,
  },
  gfExpandButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  gfCreatorChipSlot: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  gfCreatorChipInSlot: {
    marginTop: 0,
  },
  headerMenuHost: {
    width: 24,
    height: 32,
  },
  headerMenuTrigger: {
    width: 24,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gfCreatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    paddingRight: 18,
    borderRadius: 32,
    gap: 12,
    marginTop: 8,
  },
  gfCreatorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  gfCreatorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  gfProgressCard: {
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  gfCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gfProgressSide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gfProgressGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  gfStatsSide: {
    width: 130,
    paddingLeft: 12,
  },
  gfTotalBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    gap: 10,
    marginBottom: 14,
  },
  gfTotalBadgeTextWrap: {
    alignItems: 'flex-start',
  },
  gfTotalBadgeNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 24,
    paddingTop: 4,
  },
  gfTotalBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gfStatsListVertical: {
    gap: 8,
  },
  gfStatRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gfStatRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  gfStatRowText: {
    flex: 1,
  },
  gfStatRowValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  gfStatRowLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  gfActionsCard: {
    marginHorizontal: 16,
    borderRadius: 38,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  gfActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  gfActionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  gfActionTextWrap: {
    flex: 1,
  },
  gfActionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  gfActionDesc: {
    fontSize: 13,
    fontWeight: '500',
  },
  gfActionDivider: {
    height: 1,
  },
  gfShareCard: {
    marginHorizontal: 16,
    padding: 20,
    paddingBottom: 0,
    borderRadius: 32,
    borderWidth: 1,
    marginBottom: 20,
  },
  gfShareMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
  },
  gfShareIconBg: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  gfShareContent: {
    flex: 1,
  },
  gfShareTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  gfShareStatus: {
    fontSize: 13,
    fontWeight: '500',
  },
  gfShareInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 6,
  },
  gfShareInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gfLearningFlowCard: {
    marginHorizontal: 16,
    borderRadius: 34,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  gfLearningFlowDividerWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 12,
  },
  gfLearningFlowDivider: {
    width: '78%',
    maxWidth: 280,
    height: StyleSheet.hairlineWidth,
    borderRadius: 1,
  },
  gfStudyCard: {
    marginHorizontal: 0,
    borderRadius: 30,
    borderWidth: 1,
    padding: 0,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  gfStudyChapterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  gfStudyChapterIcon: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  gfStudyTextWrap: {
    flex: 1,
  },
  gfStudyPrimaryText: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  gfStudyMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  gfStartButton: {
    width: 128,
    borderRadius: 26,
    overflow: 'hidden',
  },
  gfStartButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  gfStartMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gfStartButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  chapterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chapterSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  chapterSheetHeaderMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 10,
  },
  chapterSheetCloseBtn: {
    backgroundColor: 'rgba(150,150,150,0.1)',
    padding: 6,
    borderRadius: 99,
  },
  chapterSheetList: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  chapterSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chapterSheetIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chapterSheetProgressBadge: {
    width: 34,
    height: 34,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterSheetItemTextWrap: {
    flex: 1,
  },
  chapterSheetItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 1,
  },
  chapterSheetItemMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  chapterSheetStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  chapterSheetStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chapterSheetStatText: {
    fontSize: 11,
    fontWeight: '600',
  },
  fabChapterProgressTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabChapterProgressText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
