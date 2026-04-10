import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Modal, Pressable, Image, Switch, Animated, RefreshControl, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getDeckById, getDeckLanguages } from '../../services/DeckService';
import { getAllCardsForDeck } from '../../services/CardService';
import { getFavoriteDeckIds, getFavoriteCardIds } from '../../services/FavoriteService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import CircularProgress from '../../components/ui/CircularProgress';
import { useAuth } from '../../contexts/AuthContext';
import { listChapters, getChaptersProgress } from '../../services/ChapterService';
import { deleteDeck, updateDeckShare, insertDeckStats } from '../../services/DeckService';
import { getDeckProgressCounts } from '../../services/CardService';
import { addFavoriteDeck, removeFavoriteDeck } from '../../services/FavoriteService';
import * as BlockService from '../../services/BlockService';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import ReportModal from '../../components/modals/ReportModal';
import { scale, moderateScale, verticalScale, useWindowDimensions } from '../../lib/scaling';
import { useFocusEffect } from '@react-navigation/native';
import { triggerHaptic } from '../../lib/hapticManager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal, BottomSheetFlatList, BottomSheetBackdrop, TouchableOpacity as BSTouchableOpacity } from '@gorhom/bottom-sheet';

export default function DeckDetailScreen({ route, navigation }) {
  
  const insets = useSafeAreaInsets();
  const { deck } = route.params;
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  // Favori durumunu route.params'dan al (eğer varsa), yoksa false
  const [isFavorite, setIsFavorite] = useState(deck?.is_favorite || false);
  const [favLoading, setFavLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLoading, setProgressLoading] = useState(true);
  const [learnedCardsCount, setLearnedCardsCount] = useState(0);
  const [deckStats, setDeckStats] = useState({ total: 0, learned: 0, learning: 0, new: 0 });
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [cardSort, setCardSort] = useState('original'); // 'original', 'az', 'fav'
  const [originalCards, setOriginalCards] = useState([]);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [moreMenuPos, setMoreMenuPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const moreMenuRef = useRef(null);
  const [creatorMenuVisible, setCreatorMenuVisible] = useState(false);
  const [creatorMenuPos, setCreatorMenuPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const creatorChipRef = useRef(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportModalType, setReportModalType] = useState('user');
  const [reportModalTargetId, setReportModalTargetId] = useState(null);
  const [reportModalAlreadyCodes, setReportModalAlreadyCodes] = useState([]);
  const chaptersFetchedRef = useRef(false);
  /** Aynı anda birden fazla fetchChapters; eski cevap state'i güncellemesin */
  const chaptersFetchGenRef = useRef(0);
  /** Ekran unmount olduysa (stack'ten çıkıldıysa) chapter/progress setState yapılmasın — çıkış animasyonunda flash azaltır */
  const deckDetailMountedRef = useRef(true);
  /** useFocusEffect veri yenilemesi: blur sonrası gelen progress cevabı state güncellemesin */
  const detailFocusRefreshActiveRef = useRef(false);

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
    initialUserId ? deck.user_id === initialUserId : false
  );
  const [isShared, setIsShared] = useState(deck.is_shared || false);
  const [shareLoading, setShareLoading] = useState(false);
  const [categoryInfo, setCategoryInfo] = useState(deck.categories || null);
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
  const fetchChapterProgressRef = useRef(async () => {});
  const chapterSheetModalRef = useRef(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  // 120+ karakter genelde 3 satırı aşar (tahmin)
  const [descriptionNeedsExpand, setDescriptionNeedsExpand] = useState(deck?.description?.length > 120);
  const descriptionLayoutDone = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const { height: screenHeight } = useWindowDimensions();
  /** Az bölümde sheet kısa; çok bölümde en fazla ~%68 ekran (önceki sabit snap ile aynı tavan) */
  const chapterSheetMaxContentHeight = useMemo(() => screenHeight * 0.68, [screenHeight]);
  /** Çok az bölümde sheet çökük kalmasın; tavanı aşmasın */
  const chapterSheetMinContentHeight = useMemo(
    () =>
      Math.min(
        chapterSheetMaxContentHeight,
        Math.max(screenHeight * 0.36, verticalScale(300))
      ),
    [chapterSheetMaxContentHeight, screenHeight]
  );
  const chapterSheetHeaderApprox = verticalScale(56);
  const moreMenuScaleAnim = useRef(new Animated.Value(0)).current;

  // Animation values for entrance effects
  const heroAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (creatorMenuVisible) {
      // Menü açıldığında: Anında ve sıçrayarak büyü (Instagram popup'ları gibi)
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 200, // Hız
        friction: 10, // Sekme payı (az sekip hızlı dursun)
        useNativeDriver: true, // GPU'yu kullan, asla kasmaz!
      }).start();
    } else {
      // Menü kapandığında: Bekleme yapmadan anında yok ol
      scaleAnim.setValue(0);
    }
  }, [creatorMenuVisible]);

  useEffect(() => {
    if (moreMenuVisible) {
      // Menü açıldığında: Anında ve sıçrayarak büyü
      Animated.spring(moreMenuScaleAnim, {
        toValue: 1,
        tension: 200,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      moreMenuScaleAnim.setValue(0);
    }
  }, [moreMenuVisible]);

  useEffect(() => {
    const loadDecksLanguages = async () => {
      try {
        const ids = await getDeckLanguages(deck.id);
        setDecksLanguages(ids);
      } catch (e) {
        console.error('Deste dilleri yüklenemedi:', e);
      }
    };
    loadDecksLanguages();
  }, [deck.id]);

  useEffect(() => {
    // Staggered entrance animation
    Animated.stagger(verticalScale(120), [
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
  }, []);

  // Swipe ekranına gidip geri dönünce chapter sheet açık kalmasın
  useEffect(() => {
    const onBlur = navigation.addListener('blur', () => {
      setChapterSheetVisible(false);
    });
    return () => {
      onBlur?.();
    };
  }, [navigation]);

  // Initial deck verisi için is_admin_created kontrolü
  useEffect(() => {
    if (deck?.is_admin_created && deck?.profiles) {
      deck.profiles = {
        ...deck.profiles,
        username: 'Knowia',
        image_url: null, // app_icon.png kullanılacak
      };
      route.params.deck = deck;
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
          fetchProgressFromAPI(false); // useCache = false ile API'den çek
        }, 100);
        return;
      }
    }

    // Cache yoksa veya kullanılmıyorsa direkt API'den çek
    await fetchProgressFromAPI(true);
  };

  const fetchProgressFromAPI = async (showLoading = true, fromFocusRefresh = false) => {
    if (showLoading) {
      setProgressLoading(true);
    }
    try {
      const stats = await getDeckProgressCounts(userId, deck.id);
      if (fromFocusRefresh && !detailFocusRefreshActiveRef.current) {
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
      if (fromFocusRefresh && !detailFocusRefreshActiveRef.current) {
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
          setIsFavorite(favIds.includes(deck.id));
        } catch (e) {
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
      detailFocusRefreshActiveRef.current = true;

      const run = async () => {
        await fetchProgressFromAPI(false, true);
        if (!isActive) return;

        try {
          const [deckData, favIds] = await Promise.all([
            getDeckById(deck.id),
            userId ? getFavoriteDeckIds(userId) : Promise.resolve([]),
          ]);
          if (!isActive) return;
          const isFav = userId ? favIds.includes(deck.id) : false;
          if (deckData) {
            if (deckData.is_admin_created && deckData.profiles) {
              deckData.profiles = { ...deckData.profiles, username: 'Knowia', image_url: null };
            }
            deckData.is_favorite = isFav;
            route.params.deck = deckData;
            setCategoryInfo(deckData.categories);
            setIsShared(deckData.is_shared || false);
          }
          setIsFavorite(isFav);
        } catch (e) {
          console.error('Deck verisi güncellenemedi:', e);
        }
      };

      run();
      return () => {
        isActive = false;
        detailFocusRefreshActiveRef.current = false;
      };
    }, [deck.id, currentUserId, userId])
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
        // Deste adı, açıklaması vb. burada güncelleniyor
        if (deckData.is_admin_created && deckData.profiles) {
          deckData.profiles = { ...deckData.profiles, username: 'Knowia', image_url: null };
        }
        route.params.deck = deckData; // Veriyi navigation'a geri yaz
        setCategoryInfo(deckData.categories);
        setIsFavorite(uid ? favDeckIds.includes(deck.id) : false);
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
      setRefreshing(false);
    }
  }, [deck?.id, userId, chapters.length]);

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
        setFavoriteCards([]);
        return;
      }
      try {
        const ids = await getFavoriteCardIds(userId);
        setFavoriteCards(ids);
      } catch (e) {
        setFavoriteCards([]);
      }
    };
    fetchFavoriteCards();
  }, [deck.id, userId]);

  useEffect(() => {
    setFilteredCards(sortCards(cardSort, cards));
  }, [cardSort, cards, originalCards, favoriteCards]);

  // Session değiştiğinde kontrol et (AuthContext'ten gelen session)
  useEffect(() => {
    const userId = session?.user?.id || null;
    setCurrentUserId(userId);

    // Eğer kullanıcı deste sahibi ise share component'i göster, değilse gizle
    if (userId && deck.user_id === userId) {
      setShareComponentVisible(true);
    } else {
      setShareComponentVisible(false);
    }
  }, [session, deck.user_id]);


  // Son seçilen chapter'ı AsyncStorage'dan yükle
  const loadLastSelectedChapter = async (availableChapters) => {
    try {
      const storageKey = `last_selected_chapter_${deck.id}`;
      const savedChapterId = await AsyncStorage.getItem(storageKey);
      if (!deckDetailMountedRef.current) return;

      if (savedChapterId) {
        // Eğer "action" seçiliyse
        if (savedChapterId === 'action') {
          if (!deckDetailMountedRef.current) return;
          setSelectedChapter(ACTION_CHAPTER);
          return;
        }

        // Kaydedilmiş chapter'ı bul
        const savedChapter = availableChapters.find(ch => ch.id === savedChapterId);
        if (savedChapter) {
          if (!deckDetailMountedRef.current) return;
          setSelectedChapter(savedChapter);
          return;
        }
      }

      // Eğer kayıtlı chapter bulunamazsa veya yoksa: hiçbir seçim yapma (kullanıcı seçsin)
      if (!deckDetailMountedRef.current) return;
      setSelectedChapter(null);
    } catch (e) {
      console.error('Error loading last selected chapter:', e);
      if (!deckDetailMountedRef.current) return;
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
      if (gen !== chaptersFetchGenRef.current || !deckDetailMountedRef.current) return;
      const availableChapters = data || [];
      setChapters(availableChapters);
      chaptersFetchedRef.current = true;

      // Son seçilen chapter'ı yükle
      await loadLastSelectedChapter(availableChapters);
      if (gen !== chaptersFetchGenRef.current || !deckDetailMountedRef.current) return;

    } catch (e) {
      console.error('Error fetching chapters:', e);
      if (gen !== chaptersFetchGenRef.current || !deckDetailMountedRef.current) return;
      setChapters([]);
      setSelectedChapter(null);
    }
  }, [deck?.id, currentUserId]);

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
    if (!silent) {
      setChapterProgressLoading(true);
    }
    if (force) {
      setChapterProgressMap(new Map());
      setChapterProgressLoadedCount(0);
      chapterProgressLoadedRef.current = false;
    }

    let p;
    p = (async () => {
      try {
        const batchSize = 15;
        for (let i = 0; i < chapters.length; i += batchSize) {
          const batch = chapters.slice(i, i + batchSize);
          const progressBatch = await getChaptersProgress(batch, deck.id, currentUserId, force);
          if (!deckDetailMountedRef.current || chapterProgressJobRef.current !== jobId) return;
          setChapterProgressMap(prev => {
            const next = new Map(prev);
            progressBatch.forEach((value, key) => next.set(key, value));
            return next;
          });
          setChapterProgressLoadedCount(Math.min(chapters.length, i + batch.length));
        }
        if (!deckDetailMountedRef.current || chapterProgressJobRef.current !== jobId) return;
        chapterProgressLoadedRef.current = true;
      } catch (e) {
        console.error('Error fetching chapter progress:', e);
      } finally {
        if (!silent && deckDetailMountedRef.current && chapterProgressJobRef.current === jobId) {
          setChapterProgressLoading(false);
        }
        if (chapterProgressPromiseRef.current === p) {
          chapterProgressPromiseRef.current = null;
        }
      }
    })();

    chapterProgressPromiseRef.current = p;
    return p;
  }, [chapters, currentUserId, deck.id]);

  fetchChapterProgressRef.current = fetchChapterProgress;

  // İlk animasyonlar bittikten sonra bölüm progress'ini sessizce önden yükle (sheet açılınca hazır olsun)
  useEffect(() => {
    if (!currentUserId || chapters.length === 0) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      fetchChapterProgress(false);
    });
    return () => {
      if (task && typeof task.cancel === 'function') {
        task.cancel();
      }
    };
  }, [chapters, currentUserId, deck.id, fetchChapterProgress]);

  const openChapterSheet = useCallback(async () => {
    triggerHaptic('light');
    setChapterSheetVisible(true);
    await fetchChapterProgress(false);
  }, [fetchChapterProgress]);

  useEffect(() => {
    if (chapterSheetVisible) {
      chapterSheetModalRef.current?.present();
      return;
    }
    chapterSheetModalRef.current?.dismiss();
  }, [chapterSheetVisible]);

  const renderChapterSheetBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    []
  );

  const handleStartDeck = useCallback(async () => {
    triggerHaptic('heavy');

    if (!selectedChapter?.id) {
      setChapterSheetVisible(true);
      return;
    }

    try {
      if (userId) {
        await insertDeckStats(deck.id, userId);
      }
    } catch (error) {
      console.log('Deck stats log error:', error);
    }

    const chapterParam = selectedChapter.id === 'action' ? undefined : selectedChapter;
    navigation.navigate('SwipeDeck', { deck, chapter: chapterParam });
  }, [selectedChapter, t, userId, deck, navigation]);

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
      deck.is_shared = newValue;
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

  // More menüsünü aç
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

  const openCreatorMenu = () => {
    if (creatorChipRef.current && creatorChipRef.current.measureInWindow) {
      // Ölçüm emrini Native'e anında gönderiyoruz
      creatorChipRef.current.measureInWindow((x, y, width, height) => {
        // Ölçüm sonucu geldiğinde, UI'ı çizmeyi (render) bir frame erteliyoruz ki takılmasın
        requestAnimationFrame(() => {
          setCreatorMenuPos({ x, y, width, height });
          setCreatorMenuVisible(true);
        });
      });
    } else {
      setCreatorMenuVisible(true);
    }
  };


  const openReportUserModal = async () => {
    setCreatorMenuVisible(false);
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
    setCreatorMenuVisible(false);
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
    setMoreMenuVisible(false);
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
    setMoreMenuVisible(false);
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

  // Header'a ikonları ekle
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(16), paddingHorizontal: scale(8) }}>
          
          {/* Favori ikonu - Serbest ve çerçevesiz (hitSlop ile tıklama alanı geniş) */}
          <TouchableOpacity
            onPress={handleToggleFavorite}
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 8, right: 8 }}
          >
            <Iconify
              icon={isFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={moderateScale(24)}
              color={isFavorite ? '#F98A21' : colors.text}
            />
          </TouchableOpacity>

          {/* More menüsü - Etrafı çerçeveli (Border) ve kendi iç boşluğu (Padding) var */}
          {currentUserId && (
            <TouchableOpacity
              ref={moreMenuRef}
              onPress={() => {
                triggerHaptic('selection');
                requestAnimationFrame(() => {
                  openMoreMenu();
                });
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 15, bottom: 15, left: 8, right: 8 }}
            >
              <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={moderateScale(24)} color={colors.text} />
            </TouchableOpacity>
          )}
          
        </View>
      ),
    });
  }, [navigation, colors.text, colors.border, isFavorite, favLoading, currentUserId, deck.user_id]);

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

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background}}>

      <ScrollView
        contentContainerStyle={{ paddingBottom: verticalScale(screenHeight * 0.10) + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} colors={[colors.buttonColor]} />
        }
      >
        {/* GRADIENT FLOW DESIGN - Modern & Eye-catching */}

        {/* Hero Gradient Banner */}
        <Animated.View
          style={[
            styles.gfHeroBanner,
            { opacity: heroAnim, transform: [{ scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1] }) }] }
          ]}
        >
          <LinearGradient
            colors={getCategoryGradient(categoryInfo?.sort_order)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gfHeroGradient}
          >
            {/* Decorative Elements */}
            <View style={styles.gfHeroDecor}>
              <View style={[styles.gfDecorCircle, styles.gfDecorCircle1]} />
              <View style={[styles.gfDecorCircle, styles.gfDecorCircle2]} />
              <View style={[styles.gfDecorCircle, styles.gfDecorCircle3]} />
            </View>

            {/* Category Badge */}
            <View style={styles.gfCategoryBadge}>
              <Iconify icon={getCategoryIcon(categoryInfo?.sort_order)} size={moderateScale(18)} color="#fff" />
              <Text style={styles.gfCategoryText}>
                {t(`categories.${categoryInfo?.sort_order}`) || categoryInfo?.name || t('common.category', 'Kategori')}
              </Text>
            </View>

            {/* Title - Scrollable if overflows */}
            <View style={styles.gfTitleContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10) }}>
                <Iconify icon="ion:book" size={moderateScale(28)} color="#fff" />
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10) }}>
                  <Iconify icon="icon-park-outline:translation" size={moderateScale(28)} color="#fff" />
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
                    <View style={{ marginTop: verticalScale(1) }}>
                      <Iconify
                        icon="flowbite:caret-down-solid"
                        size={moderateScale(14)}
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
                <TouchableOpacity
                  ref={creatorChipRef}
                  onPress={
                    () => {
                      triggerHaptic('selection');
                      openCreatorMenu();
                    }
                  }
                  activeOpacity={0.8}
                  style={styles.gfCreatorChip}
                >
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
                  <Iconify icon="flowbite:caret-down-solid" size={moderateScale(18)} color="#fff" style={{ marginLeft: scale(2) }} />
                </TouchableOpacity>
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
        </Animated.View>

        <View style={[styles.gfLearningFlowCard, { borderColor: colors.cardBorder, backgroundColor: colors.cardBackground }]}>
          {/* Progress & Stats Card - Side by Side Layout */}
          <Animated.View
            style={[
              styles.gfProgressCard,
              {
                backgroundColor: 'transparent',
                shadowOpacity: 0,
                elevation: 0,
                opacity: statsAnim,
                transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }]
              }
            ]}
          >
            <View style={styles.gfCardContent}>
            {/* Left Side - Progress Ring */}
            <View style={styles.gfProgressSide}>
              <View style={[styles.gfProgressGlow, { backgroundColor: getCategoryColor(categoryInfo?.sort_order) + '15' }]} />
              <CircularProgress
                progress={progress}
                size={scale(170)}
                strokeWidth={moderateScale(17)}
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
                <Iconify icon="ri:stack-fill" size={moderateScale(18)} color="#fff" />
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
                    <Iconify icon="mdi:fire" size={moderateScale(18)} color="#fff" />
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
                    <Iconify icon="basil:eye-closed-outline" size={moderateScale(18)} color="#fff" />
                  </LinearGradient>
                  <View style={styles.gfStatRowText}>
                    <Text style={[styles.gfStatRowValue, { color: colors.cardQuestionText }]}>{deckStats.new}</Text>
                    <Text style={[styles.gfStatRowLabel, { color: colors.muted }]}>{t('deckDetail.new', 'Yeni')}</Text>
                  </View>
                </View>
              </View>
            </View>
            </View>
          </Animated.View>

          <View style={styles.gfLearningFlowDividerWrap}>
            <View style={[styles.gfLearningFlowDivider, { backgroundColor: colors.border }]} />
          </View>

          <Animated.View
            style={[
              styles.gfStudyCard,
              {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                marginHorizontal: 0,
                marginBottom: 0,
                padding: 0,
                opacity: cardsAnim,
                transform: [{ translateY: cardsAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
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
                <Iconify icon="streamline-flex:module-puzzle-2" size={moderateScale(22)} color="#fff" />
              </LinearGradient>
              <View style={styles.gfStudyTextWrap}>
                <Text style={[styles.gfStudyPrimaryText, { color: colors.cardQuestionText }]}>
                  {selectedChapter?.id === 'action'
                    ? t('deckDetail.action', 'Aksiyon')
                    : selectedChapter?.id
                      ? `${t('chapters.chapter', 'Bölüm')} ${selectedChapter.ordinal}`
                      : t('deckDetail.selectChapterCtaShort', 'Bir bölüm seç')}
                </Text>
                {!!selectedChapter?.id && (
                  <Text style={[styles.gfStudyMetaText, { color: colors.muted }]}>
                    %{selectedChapterLearnedPct ?? 0} {t('deckDetail.learned', 'öğrenildi')}
                  </Text>
                )}
              </View>
              <Iconify icon="flowbite:caret-down-solid" size={moderateScale(18)} color={colors.muted} />
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
                  <Iconify icon="streamline:button-play-solid" size={moderateScale(20)} color="#fff" />
                  <Text style={styles.gfStartButtonText}>{t('deckDetail.start', 'Başla')}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Action Buttons - Combined Card */}
        <Animated.View
          style={[
            styles.gfActionsCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.cardBorder,
              opacity: cardsAnim,
              transform: [{ translateY: cardsAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }]
            }
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
            <Iconify icon="ion:chevron-forward" size={moderateScale(22)} color={colors.muted} />
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
              <Iconify icon="streamline-freehand:plugin-jigsaw-puzzle" size={moderateScale(24)} color="#fff" />
            </LinearGradient>
            <View style={styles.gfActionTextWrap}>
              <Text style={[styles.gfActionTitle, { color: colors.cardQuestionText }]}>{t('deckDetail.chapters', 'Bölümler')}</Text>
              <Text style={[styles.gfActionDesc, { color: colors.muted }]}>{chapters.length} {t('deckDetail.chaptersCount', 'bölüm')}</Text>
            </View>
            <Iconify icon="ion:chevron-forward" size={moderateScale(22)} color={colors.muted} />
          </TouchableOpacity>
        </Animated.View>


        {/* Share Card - Modern Toggle */}
        {shareComponentVisible && (
          <Animated.View
            style={[
              styles.gfShareCard,
              { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, opacity: cardsAnim }
            ]}
          >
            <View style={styles.gfShareMainRow}>
              <LinearGradient
                colors={isShared ? ['#27AE60', '#2ECC71'] : [colors.muted + '30', colors.muted + '20']}
                style={styles.gfShareIconBg}
              >
                <Iconify icon="fluent:people-community-20-filled" size={moderateScale(22)} color={isShared ? '#fff' : colors.muted} />
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
              <Iconify icon="material-symbols:info-outline" size={moderateScale(18)} color={colors.secondary} />
              <Text style={[styles.gfShareInfoText, { color: colors.secondary }]}>
                {t('deckDetail.moreInfo', 'Daha fazla bilgi')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      <BottomSheetModal
        ref={chapterSheetModalRef}
        index={0}
        onChange={(idx) => {
          if (idx === -1) {
            setChapterSheetVisible(false);
          }
        }}
        backdropComponent={renderChapterSheetBackdrop}
        backgroundStyle={{ backgroundColor: colors.background, borderRadius: moderateScale(40) }}
        handleIndicatorStyle={{ backgroundColor: colors.muted }}
        enableDynamicSizing
        maxDynamicContentSize={chapterSheetMaxContentHeight}
        bottomInset={insets.bottom}
        enableContentPanningGesture={false}
      >
        <View style={[styles.chapterSheetHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.chapterSheetTitle, { color: colors.cardQuestionText }]}>
            {t('deckDetail.selectChapterTitle', 'Bölüm Seç')}
          </Text>
          <Text style={[styles.chapterSheetHeaderMeta, { color: colors.muted }]}>
            {chapterProgressLoading
              ? `${chapterProgressLoadedCount}/${chapters.length} ${t('common.loading', 'yükleniyor')}`
              : `${chapters.length} ${t('deckDetail.chaptersCount', 'bölüm')}`}
          </Text>
          <TouchableOpacity
            onPress={() => setChapterSheetVisible(false)}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            style={styles.chapterSheetCloseBtn}
          >
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(22)} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <BottomSheetFlatList
          data={[ACTION_CHAPTER, ...chapters]}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.chapterSheetList,
            {
              flexGrow: 1,
              minHeight: Math.max(
                chapterSheetMinContentHeight - chapterSheetHeaderApprox,
                verticalScale(120)
              ),
              paddingBottom: insets.bottom + verticalScale(24),
            },
          ]}
          style={{ flex: 1 }}
          nestedScrollEnabled
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
              <BSTouchableOpacity
                style={[
                  styles.chapterSheetItem,
                  {
                    borderColor: isSelected ? colors.buttonColor : colors.border,
                    backgroundColor: isSelected ? colors.buttonColor + '16' : (colors.cardBackground || colors.background),
                  },
                ]}
                activeOpacity={0.78}
                onPress={() => {
                  handleChapterSelect(item);
                  setChapterSheetVisible(false);
                }}
              >
                {isAction ? (
                  <LinearGradient colors={['#F98A21', '#FF6B35']} style={styles.chapterSheetIcon}>
                    <Iconify icon="streamline:startup-solid" size={moderateScale(16)} color="#fff" />
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
                        <Iconify icon="ri:stack-fill" size={moderateScale(13)} color={colors.muted} />
                        <Text style={[styles.chapterSheetStatText, { color: colors.muted }]}>{chapterProgress.total || 0}</Text>
                      </View>
                      <View style={styles.chapterSheetStatItem}>
                        <Iconify icon="basil:eye-closed-outline" size={moderateScale(13)} color={colors.muted} />
                        <Text style={[styles.chapterSheetStatText, { color: colors.muted }]}>{chapterProgress.new || 0}</Text>
                      </View>
                      <View style={styles.chapterSheetStatItem}>
                        <Iconify icon="mdi:fire" size={moderateScale(13)} color={colors.muted} />
                        <Text style={[styles.chapterSheetStatText, { color: colors.muted }]}>{chapterProgress.learning || 0}</Text>
                      </View>
                      <View style={styles.chapterSheetStatItem}>
                        <Iconify icon="dashicons:welcome-learn-more" size={moderateScale(13)} color={colors.muted} />
                        <Text style={[styles.chapterSheetStatText, { color: colors.muted }]}>{chapterProgress.learned || 0}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </BSTouchableOpacity>
            );
          }}
        />
      </BottomSheetModal>

      {/* More Menüsü Modal - sahibi: Düzenle/Sil; sahibi değil: Gizle/Şikayet et */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="none" // OS'in yavaş animasyonunu kapattık
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setMoreMenuVisible(false)}
        >
          <Animated.View
            style={{
              position: 'absolute',
              right: scale(20),
              // Android'de aradaki farkı tam olarak safe area boşluğu ile kapatıyoruz
              top: Platform.OS === 'android'
                ? moreMenuPos.y + moreMenuPos.height + verticalScale(4) + insets.top
                : moreMenuPos.y + moreMenuPos.height + verticalScale(8),
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

              // Sihirli Animasyonlar
              opacity: moreMenuScaleAnim,
              transform: [
                {
                  scale: moreMenuScaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1], // %85'ten 100'e hızlıca büyüyecek
                  }),
                },
              ],
            }}
          >
            {currentUserId && deck.user_id === currentUserId ? (
              <>
                {/* DÜZENLE BUTONU */}
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('selection'); // Dokunma hissini ekledik
                    setMoreMenuVisible(false); // Önce menüyü kapat
                    requestAnimationFrame(() => { // Geçişi pürüzsüzleştir
                      navigation.navigate('DeckEdit', {
                        deck,
                        categoryInfo: categoryInfo || deck.categories || null,
                        selectedLanguageIds: decksLanguages
                      });
                    });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: verticalScale(12),
                    paddingHorizontal: scale(16),
                  }}
                  activeOpacity={0.6}
                >
                  <Iconify icon="lucide:edit" size={moderateScale(20)} color={colors.text} style={{ marginRight: scale(12) }} />
                  <Text style={[typography.styles.body, { color: colors.text, fontSize: moderateScale(16) }]}>
                    {t('deckDetail.edit', 'Desteyi Düzenle')}
                  </Text>
                </TouchableOpacity>

                <View style={{ height: verticalScale(1), backgroundColor: colors.border, marginVertical: verticalScale(4) }} />

                {/* SİL BUTONU */}
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('heavy');
                    setMoreMenuVisible(false);
                    requestAnimationFrame(() => {
                      handleDeleteDeck();
                    });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: verticalScale(12),
                    paddingHorizontal: scale(16),
                  }}
                  activeOpacity={0.6}
                >
                  <Iconify icon="mdi:garbage" size={moderateScale(20)} color="#E74C3C" style={{ marginRight: scale(12) }} />
                  <Text style={[typography.styles.body, { color: '#E74C3C', fontSize: moderateScale(16) }]}>
                    {t('deckDetail.deleteDeck', 'Desteyi Sil')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* ŞİKAYET ET BUTONU (Kapanma hatası düzeltildi) */}
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('light');
                    setMoreMenuVisible(false);
                    requestAnimationFrame(() => {
                      openReportDeckModal();
                    });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: verticalScale(12),
                    paddingHorizontal: scale(16),
                  }}
                  activeOpacity={0.6}
                >
                  <Iconify icon="ic:round-report-problem" size={moderateScale(20)} color='#FED7AA' style={{ marginRight: scale(12) }} />
                  <Text style={[typography.styles.body, { color: '#FED7AA', fontSize: moderateScale(16) }]}>
                    {t('moderation.reportDeck')}
                  </Text>
                </TouchableOpacity>

                <View style={{ height: verticalScale(1), backgroundColor: colors.border, marginVertical: verticalScale(4) }} />

                {/* GİZLE BUTONU (Kapanma hatası düzeltildi) */}
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('heavy');
                    setMoreMenuVisible(false);
                    requestAnimationFrame(() => {
                      handleHideDeck();
                    });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: verticalScale(12),
                    paddingHorizontal: scale(16),
                  }}
                  activeOpacity={0.6}
                >
                  <Iconify icon="mingcute:user-hide-fill" size={moderateScale(20)} color='#E74C3C' style={{ marginRight: scale(12) }} />
                  <Text style={[typography.styles.body, { color: '#E74C3C', fontSize: moderateScale(16) }]}>
                    {t('moderation.hideDeck')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Creator menüsü (kullanıcıyı şikayet et / engelle) */}
      <Modal
        visible={creatorMenuVisible}
        transparent
        animationType="none" // OS'in yavaş animasyonunu İPTAL ET!
        onRequestClose={() => setCreatorMenuVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setCreatorMenuVisible(false)}
        >
          <Animated.View
            style={{
              position: 'absolute',
              left: creatorMenuPos.x,
              // Yalnızca Android için top değerine insets.top ekliyoruz:
              top: Platform.OS === 'android'
                ? creatorMenuPos.y + creatorMenuPos.height + verticalScale(4) + insets.top
                : creatorMenuPos.y + creatorMenuPos.height + verticalScale(8),
              minWidth: scale(180),
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

              // SİHİR BURADA: Ölçekleme ve Şeffaflık
              opacity: scaleAnim, // Başlangıçta 0, anında 1 olacak
              transform: [
                {
                  scale: scaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1], // %85'ten %100'e pırtlayarak büyüyecek
                  }),
                },
              ],
            }}
          >
            {!deck?.is_admin_created && (
              <>
                {/* ŞİKAYET ET BUTONU */}
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('light');
                    setCreatorMenuVisible(false); // 1. ÖNCE BU MENÜYÜ KAPAT (Anında tepki)
                    requestAnimationFrame(() => {
                      openReportUserModal(); // 2. SONRA DİĞERİNİ AÇ
                    });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: verticalScale(12),
                    paddingHorizontal: scale(16),
                  }}
                  activeOpacity={0.6} // Tıklama hissini netleştir
                >
                  <Iconify icon="ic:round-report-problem" size={moderateScale(20)} color='#FED7AA' style={{ marginRight: scale(12) }} />
                  <Text style={[typography.styles.body, { color: '#FED7AA', fontSize: moderateScale(16) }]}>
                    {t('moderation.reportUser')}
                  </Text>
                </TouchableOpacity>

                <View style={{ height: verticalScale(1), backgroundColor: colors.border, marginVertical: verticalScale(4) }} />

                {/* KULLANICIYI ENGELLE BUTONU */}
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('heavy');
                    setCreatorMenuVisible(false); // 1. ÖNCE BU MENÜYÜ KAPAT
                    requestAnimationFrame(() => {
                      handleBlockUser(); // 2. SONRA İŞLEMİ YAP
                    });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: verticalScale(12),
                    paddingHorizontal: scale(16),
                  }}
                  activeOpacity={0.6}
                >
                  <Iconify icon="basil:user-block-solid" size={moderateScale(22)} color='#E74C3C' style={{ marginRight: scale(12) }} />
                  <Text style={[typography.styles.body, { color: '#E74C3C', fontSize: moderateScale(16) }]}>
                    {t('moderation.blockUser')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      <ReportModal
        visible={reportModalVisible}
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
    fontSize: moderateScale(16),
    textAlign: 'center',
    marginTop: verticalScale(20),
  },

  // GRADIENT FLOW STYLES - Modern & Eye-catching
  gfHeroBanner: {
    marginBottom: verticalScale(-50),
  },
  gfHeroGradient: {
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(80),
    paddingHorizontal: scale(24),
    borderBottomLeftRadius: moderateScale(48),
    borderBottomRightRadius: moderateScale(48),
    overflow: 'hidden',
  },
  gfHeroDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gfDecorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  gfDecorCircle1: {
    width: scale(200),
    height: scale(200),
    top: verticalScale(-60),
    right: scale(-40),
  },
  gfDecorCircle2: {
    width: scale(120),
    height: scale(120),
    bottom: verticalScale(20),
    left: scale(-30),
  },
  gfDecorCircle3: {
    width: scale(80),
    height: scale(80),
    top: verticalScale(60),
    right: scale(80),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  gfCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(24),
    gap: scale(10),
    marginBottom: verticalScale(16),
  },
  gfCategoryText: {
    color: '#fff',
    fontSize: moderateScale(13),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  gfHeroTitle: {
    color: '#fff',
    fontSize: moderateScale(32),
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: verticalScale(38),
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: verticalScale(2) },
    textShadowRadius: moderateScale(4),
  },
  gfHeroSubtitle: {
    color: '#fff',
    fontSize: moderateScale(32),
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: verticalScale(38),
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: verticalScale(2) },
    textShadowRadius: moderateScale(4),
  },
  gfTitleContainer: {
    position: 'relative',
    marginBottom: verticalScale(6),
  },
  gfHeroDesc: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: moderateScale(14),
    fontWeight: '500',
    fontStyle: 'italic',
    lineHeight: verticalScale(20),
    marginBottom: verticalScale(8),
  },
  gfExpandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: scale(4),
    marginBottom: verticalScale(12),
    paddingVertical: verticalScale(4),
  },
  gfExpandButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  gfCreatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(14),
    paddingRight: scale(18),
    borderRadius: moderateScale(32),
    gap: scale(12),
    marginTop: verticalScale(8),
  },
  gfCreatorAvatar: {
    width: scale(28),
    height: scale(28),
    borderRadius: moderateScale(14),
    borderWidth: moderateScale(2),
    borderColor: 'rgba(255,255,255,0.5)',
  },
  gfCreatorName: {
    color: '#fff',
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  gfProgressCard: {
    paddingVertical: verticalScale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(4) },
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(12),
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
    width: scale(200),
    height: scale(200),
    borderRadius: moderateScale(100),
  },
  gfStatsSide: {
    width: scale(130),
    paddingLeft: scale(12),
  },
  gfTotalBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(14),
    borderRadius: moderateScale(18),
    gap: scale(10),
    marginBottom: verticalScale(14),
  },
  gfTotalBadgeTextWrap: {
    alignItems: 'flex-start',
  },
  gfTotalBadgeNumber: {
    fontSize: moderateScale(22),
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: verticalScale(24),
    paddingTop: verticalScale(4),
  },
  gfTotalBadgeLabel: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gfStatsListVertical: {
    gap: verticalScale(8),
  },
  gfStatRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gfStatRowIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(10),
  },
  gfStatRowText: {
    flex: 1,
  },
  gfStatRowValue: {
    fontSize: moderateScale(17),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  gfStatRowLabel: {
    fontSize: moderateScale(9),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginTop: verticalScale(1),
  },
  gfActionsCard: {
    marginHorizontal: scale(16),
    borderRadius: moderateScale(38),
    borderWidth: moderateScale(1),
    overflow: 'hidden',
    marginBottom: verticalScale(20),
  },
  gfActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(18),
  },
  gfActionIconBox: {
    width: scale(48),
    height: scale(48),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(14),
  },
  gfActionTextWrap: {
    flex: 1,
  },
  gfActionTitle: {
    fontSize: moderateScale(17),
    fontWeight: '700',
    marginBottom: verticalScale(2),
  },
  gfActionDesc: {
    fontSize: moderateScale(13),
    fontWeight: '500',
  },
  gfActionDivider: {
    height: verticalScale(1),
  },
  gfShareCard: {
    marginHorizontal: scale(16),
    padding: moderateScale(20),
    paddingBottom: 0,
    borderRadius: moderateScale(32),
    borderWidth: moderateScale(1),
    marginBottom: verticalScale(20),
  },
  gfShareMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: verticalScale(16),
  },
  gfShareIconBg: {
    width: scale(54),
    height: scale(54),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(16),
  },
  gfShareContent: {
    flex: 1,
  },
  gfShareTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginBottom: verticalScale(4),
  },
  gfShareStatus: {
    fontSize: moderateScale(13),
    fontWeight: '500',
  },
  gfShareInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(14),
    borderTopWidth: moderateScale(1),
    gap: scale(6),
  },
  gfShareInfoText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  gfLearningFlowCard: {
    marginHorizontal: scale(16),
    borderRadius: moderateScale(34),
    borderWidth: moderateScale(1),
    padding: moderateScale(14),
    marginBottom: verticalScale(14),
  },
  gfLearningFlowDividerWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: verticalScale(12),
  },
  gfLearningFlowDivider: {
    width: '78%',
    maxWidth: scale(280),
    height: StyleSheet.hairlineWidth,
    borderRadius: moderateScale(1),
  },
  gfStudyCard: {
    marginHorizontal: 0,
    borderRadius: moderateScale(30),
    borderWidth: moderateScale(1),
    padding: 0,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: verticalScale(12),
  },
  gfStudyChapterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(28),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
  },
  gfStudyChapterIcon: {
    width: scale(44),
    height: scale(44),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(10),
  },
  gfStudyTextWrap: {
    flex: 1,
  },
  gfStudyPrimaryText: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    marginBottom: verticalScale(2),
  },
  gfStudyMetaText: {
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  gfStartButton: {
    width: scale(128),
    borderRadius: moderateScale(26),
    overflow: 'hidden',
  },
  gfStartButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    flex: 1,
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(10),
  },
  gfStartMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  gfStartButtonText: {
    color: '#fff',
    fontSize: moderateScale(18),
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  chapterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(12),
  },
  chapterSheetTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    flex: 1,
  },
  chapterSheetHeaderMeta: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginRight: scale(10),
  },
  chapterSheetCloseBtn: {
    backgroundColor: 'rgba(150,150,150,0.1)',
    padding: moderateScale(6),
    borderRadius: moderateScale(99),
  },
  chapterSheetList: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(12),
    gap: verticalScale(8),
  },
  chapterSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(16),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
  },
  chapterSheetIcon: {
    width: scale(34),
    height: scale(34),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(10),
  },
  chapterSheetProgressBadge: {
    width: scale(34),
    height: scale(34),
    marginRight: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterSheetItemTextWrap: {
    flex: 1,
  },
  chapterSheetItemTitle: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    marginBottom: verticalScale(1),
  },
  chapterSheetItemMeta: {
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  chapterSheetStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: scale(10),
    marginTop: verticalScale(2),
  },
  chapterSheetStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  chapterSheetStatText: {
    fontSize: moderateScale(11),
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
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
});
