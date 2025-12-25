import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Platform, Modal, FlatList, TextInput, Pressable, Image, Switch, Animated, Dimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import CircularProgress from '../../components/ui/CircularProgress';
import { useAuth } from '../../contexts/AuthContext';
import { listChapters, getChaptersProgress } from '../../services/ChapterService';

const AnimatedFabContainer = Animated.createAnimatedComponent(View);

export default function DeckDetailScreen({ route, navigation }) {
  const { deck } = route.params;
  const { colors } = useTheme();
  const { session } = useAuth();
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
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [cardSort, setCardSort] = useState('original'); // 'original', 'az', 'fav'
  const [originalCards, setOriginalCards] = useState([]);
  const filterIconRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [moreMenuPos, setMoreMenuPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const moreMenuRef = useRef(null);
  const [cardDetailModalVisible, setCardDetailModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  // Session'dan user ID'yi al (eğer varsa)
  const initialUserId = session?.user?.id || null;
  const [currentUserId, setCurrentUserId] = useState(initialUserId);
  // Başlangıçta session varsa ve kullanıcı deste sahibi ise true yap
  const [shareComponentVisible, setShareComponentVisible] = useState(
    initialUserId ? deck.user_id === initialUserId : false
  );
  const [cardsModalVisible, setCardsModalVisible] = useState(false);
  const [searchBarShouldFocus, setSearchBarShouldFocus] = useState(false);
  const [isShared, setIsShared] = useState(deck.is_shared || false);
  const [shareLoading, setShareLoading] = useState(false);
  const [categoryInfo, setCategoryInfo] = useState(deck.categories || null);
  const { t } = useTranslation();

  // Header scroll affordance states
  // Uzun metinlerde baştan gradient göster (karakter sayısına göre tahmin)
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
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const fabMenuAnimation = useRef(new Animated.Value(0)).current;
  const [chapters, setChapters] = useState([]);
  const [chapterProgressMap, setChapterProgressMap] = useState(new Map());
  // "Aksiyon" özel bölümü - tüm kartları gösterir
  const ACTION_CHAPTER = { id: 'action', name: 'Aksiyon', ordinal: null };
  const [selectedChapter, setSelectedChapter] = useState(ACTION_CHAPTER);
  const [inlineChapterListVisible, setInlineChapterListVisible] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  // 120+ karakter genelde 3 satırı aşar (tahmin)
  const [descriptionNeedsExpand, setDescriptionNeedsExpand] = useState(deck?.description?.length > 120);
  const descriptionLayoutDone = useRef(false);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const fabRightPosition = 20; // FAB butonunun sağdan mesafesi
  const fabButtonWidth = 56;
  const fabGap = 12;
  const fabTotalWidth = fabButtonWidth + fabGap + fabButtonWidth; // İki buton + gap
  const panelMaxWidth = screenWidth - fabRightPosition - fabTotalWidth - 20; // Sol padding için 20
  const fabExpandedWidth = fabMenuAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [fabButtonWidth, fabButtonWidth + panelMaxWidth],
  });
  const fabContentPadding = fabMenuAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16],
  });
  const fabContentTranslate = fabMenuAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const fabContentOpacity = fabMenuAnimation.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  // Animation values for entrance effects
  const heroAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animation
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
  }, []);

  useEffect(() => {
    if (!fabMenuOpen && inlineChapterListVisible) {
      setInlineChapterListVisible(false);
    }
  }, [fabMenuOpen, inlineChapterListVisible]);

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
    const scrollDistance = Math.min(80, contentWidth - containerWidth);
    
    // Kısa bir gecikme sonra hint animasyonu
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: scrollDistance, animated: true });
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: 0, animated: true });
      }, 400);
    }, 800);
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

  const fetchProgressFromAPI = async (showLoading = true) => {
    if (showLoading) {
      setProgressLoading(true);
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Bu destedeki toplam kart sayısını çek
      const { data: totalCards, error: totalError } = await supabase
        .from('cards')
        .select('id')
        .eq('deck_id', deck.id);
      
      if (totalError) throw totalError;
      const total = totalCards ? totalCards.length : 0;
      
      // Bu destedeki kart ID'lerini al
      const cardIds = totalCards.map(card => card.id);
      
      // Kullanıcının bu destedeki tüm progress bilgilerini çek
      const { data: progressData, error } = await supabase
        .from('user_card_progress')
        .select('card_id, status')
        .eq('user_id', user.id)
        .in('card_id', cardIds);
      
      if (error) throw error;
      
      // Status'lere göre sayıları hesapla
      const learned = (progressData || []).filter(p => p.status === 'learned').length;
      const learning = (progressData || []).filter(p => p.status === 'learning').length;
      const newCount = total - learned - learning;
      
      const calculatedProgress = total > 0 ? learned / total : 0;
      setProgress(calculatedProgress);
      setLearnedCardsCount(learned);
      const stats = { total, learned, learning, new: newCount };
      setDeckStats(stats);
      
      // Progress'i cache'le (gelecek kullanımlar için)
      try {
        const storageKey = `deck_progress_${deck.id}_${user.id}`;
        await AsyncStorage.setItem(storageKey, JSON.stringify({
          progress: calculatedProgress,
          learned,
          stats,
          timestamp: Date.now()
        }));
      } catch (cacheError) {
        console.error('Error caching progress:', cacheError);
      }
      
      // Progress değeri geldiğinde loading'i hemen false yap (progress hemen gösterilsin)
      if (showLoading) {
        setProgressLoading(false);
      }
    } catch (e) {
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
      // Eğer route.params'da is_favorite yoksa, fallback olarak çek
      const fetchFavoriteStatus = async () => {
        try {
          const { data, error } = await supabase
            .from('favorite_decks')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('deck_id', deck.id)
            .single();
          setIsFavorite(!!data);
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

  // Sayfa focus olduğunda progress ve deck verisini güncelle
  // ÖNEMLİ: SwipeDeckScreen'den döndüğünde learned değeri değişmiş olabilir,
  // bu yüzden cache kullanmadan direkt güncel veriyi çekiyoruz
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      // Progress'i güncelle (cache kullanma, direkt güncel veriyi çek)
      // Bu sayede SwipeDeckScreen'den döndüğünde yeni learned değeri hemen görünür
      fetchProgressFromAPI(true);
      
      // Chapter progress bilgisini güncelle
      if (currentUserId && chapters.length > 0) {
        try {
          const progress = await getChaptersProgress(chapters, deck.id, currentUserId);
          setChapterProgressMap(progress);
        } catch (e) {
          console.error('Error fetching chapter progress:', e);
        }
      }
      
      // Deck verisini ve favori durumunu paralel olarak güncelle
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Deck verisini ve favori durumunu paralel çek
        const [deckResult, favoriteResult] = await Promise.all([
          supabase
            .from('decks')
            .select('*, profiles:profiles(username, image_url), categories:categories(id, name, sort_order)')
            .eq('id', deck.id)
            .single(),
          user ? supabase
            .from('favorite_decks')
            .select('id')
            .eq('user_id', user.id)
            .eq('deck_id', deck.id)
            .single() : Promise.resolve({ data: null, error: null })
        ]);
        
        if (deckResult.error) throw deckResult.error;
        
        // Deck verisini güncelle
        if (deckResult.data) {
          // Favori durumunu deck objesine ekle
          deckResult.data.is_favorite = !!favoriteResult.data;
          // Route params'ı güncelle
          route.params.deck = deckResult.data;
          // Category info'yu güncelle
          setCategoryInfo(deckResult.data.categories);
          // is_shared değerini güncelle
          setIsShared(deckResult.data.is_shared || false);
          // Favori durumunu güncelle
          setIsFavorite(!!favoriteResult.data);
        } else {
          // Favori durumunu güncelle (deck verisi yoksa bile)
          setIsFavorite(!!favoriteResult.data);
        }
      } catch (e) {
        console.error('Deck verisi güncellenemedi:', e);
      }
    });

    return unsubscribe;
  }, [navigation, deck.id, currentUserId, chapters]);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const { data, error } = await supabase
          .from('cards')
          .select('id, question, answer, image, example, note, created_at')
          .eq('deck_id', deck.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setCards(data || []);
        setOriginalCards(data || []);
      } catch (e) {
        setCards([]);
        setOriginalCards([]);
      }
    };
    fetchCards();
  }, [deck.id]);

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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('favorite_cards')
          .select('card_id')
          .eq('user_id', user.id);
        if (error) throw error;
        setFavoriteCards((data || []).map(f => f.card_id));
      } catch (e) {
        setFavoriteCards([]);
      }
    };
    fetchFavoriteCards();
  }, [deck.id]);

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

  useEffect(() => {
    if (cardsModalVisible) {
      setSearchBarShouldFocus(true);
    } else {
      setSearchBarShouldFocus(false);
    }
  }, [cardsModalVisible]);

  // Son seçilen chapter'ı AsyncStorage'dan yükle
  const loadLastSelectedChapter = async (availableChapters) => {
    try {
      const storageKey = `last_selected_chapter_${deck.id}`;
      const savedChapterId = await AsyncStorage.getItem(storageKey);
      
      if (savedChapterId) {
        // Eğer "action" seçiliyse
        if (savedChapterId === 'action') {
          setSelectedChapter(ACTION_CHAPTER);
          return;
        }
        
        // Kaydedilmiş chapter'ı bul
        const savedChapter = availableChapters.find(ch => ch.id === savedChapterId);
        if (savedChapter) {
          setSelectedChapter(savedChapter);
          return;
        }
      }
      
      // Eğer kayıtlı chapter bulunamazsa veya yoksa, default olarak ACTION_CHAPTER seç
      setSelectedChapter(ACTION_CHAPTER);
    } catch (e) {
      console.error('Error loading last selected chapter:', e);
      // Hata durumunda default olarak ACTION_CHAPTER seç
      setSelectedChapter(ACTION_CHAPTER);
    }
  };

  // Seçilen chapter'ı AsyncStorage'a kaydet
  const saveLastSelectedChapter = async (chapter) => {
    try {
      const storageKey = `last_selected_chapter_${deck.id}`;
      const chapterId = chapter?.id || 'action';
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

  // Chapter'ları çek
  useEffect(() => {
    const fetchChapters = async () => {
      try {
        const data = await listChapters(deck.id);
        const availableChapters = data || [];
        setChapters(availableChapters);
        
        // Son seçilen chapter'ı yükle
        await loadLastSelectedChapter(availableChapters);
        
        // Progress bilgisini çek
        if (currentUserId && availableChapters.length > 0) {
          try {
            const progress = await getChaptersProgress(availableChapters, deck.id, currentUserId);
            setChapterProgressMap(progress);
          } catch (e) {
            console.error('Error fetching chapter progress:', e);
          }
        }
      } catch (e) {
        console.error('Error fetching chapters:', e);
        setChapters([]);
        // Hata durumunda default olarak ACTION_CHAPTER seç
        setSelectedChapter(ACTION_CHAPTER);
      }
    };
    if (deck?.id) {
      fetchChapters();
    }
  }, [deck.id, currentUserId]);

  // FAB menü animasyonu
  useEffect(() => {
    Animated.spring(fabMenuAnimation, {
      toValue: fabMenuOpen ? 1 : 0,
      useNativeDriver: false, // width animasyonu için false
      tension: 80,
      friction: 8,
    }).start();
  }, [fabMenuOpen]);

  // Favori kontrolü ve ekleme - Deck bilgileriyle birlikte çekiliyor
  const checkFavorite = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsFavorite(false);
        return;
      }
      const { data, error } = await supabase
        .from('favorite_decks')
        .select('id')
        .eq('user_id', user.id)
        .eq('deck_id', deck.id)
        .single();
      setIsFavorite(!!data);
    } catch (e) {
      setIsFavorite(false);
    }
  };

  const handleAddFavorite = async () => {
    setFavLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Önceden favori mi kontrol et
      const { data: existing } = await supabase
        .from('favorite_decks')
        .select('id')
        .eq('user_id', user.id)
        .eq('deck_id', deck.id)
        .single();
      if (existing) {
        // Favoriden çıkar
        await handleRemoveFavorite();
        return;
      }
      const { error } = await supabase
        .from('favorite_decks')
        .insert({ user_id: user.id, deck_id: deck.id });
      if (error) throw error;
      setIsFavorite(true);
    } catch (e) {
      // Alert kaldırıldı
    } finally {
      setFavLoading(false);
    }
  };

  const handleRemoveFavorite = async () => {
    setFavLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('favorite_decks')
        .delete()
        .eq('user_id', user.id)
        .eq('deck_id', deck.id);
      if (error) throw error;
      setIsFavorite(false);
    } catch (e) {
      // Alert kaldırıldı
    } finally {
      setFavLoading(false);
    }
  };

  const handleToggleFavoriteCard = async (cardId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (favoriteCards.includes(cardId)) {
        // Favoriden çıkar
        await supabase
          .from('favorite_cards')
          .delete()
          .eq('user_id', user.id)
          .eq('card_id', cardId);
        setFavoriteCards(favoriteCards.filter(id => id !== cardId));
      } else {
        // Favoriye ekle
        await supabase
          .from('favorite_cards')
          .insert({ user_id: user.id, card_id: cardId });
        setFavoriteCards([...favoriteCards, cardId]);
      }
    } catch (e) {
      // Alert kaldırıldı
    }
  };

  const updateShareSetting = async (newValue) => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('decks')
        .update({ is_shared: newValue })
        .eq('id', deck.id)
        .eq('user_id', user.id);

      if (error) throw error;

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
    if (nextValue) {
      Alert.alert(
        t('common.warning', 'Uyarı'),
        t(
          'deckDetail.shareConfirmMessage',
          'Desteyi toplulukta paylaştıktan sonra bölümlerde herhangi bir değisiklik yapamayacaksın. Onaylıyor musun?'
        ),
        [
          { text: t('common.no', 'Hayır'), style: 'cancel' },
          { text: t('common.yes', 'Evet'), onPress: () => updateShareSetting(true) },
        ],
        { cancelable: true }
      );
    } else {
      updateShareSetting(false);
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
              const { data: { user } } = await supabase.auth.getUser();
              const { error } = await supabase
                .from('decks')
                .delete()
                .eq('id', deck.id)
                .eq('user_id', user.id);

              if (error) throw error;
              
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

  // Header'a ikonları ekle
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 8 }}>
          {/* Favori ikonu - Her zaman görünür */}
          <TouchableOpacity
            onPress={handleAddFavorite}
            disabled={favLoading}
            activeOpacity={0.7}
          >
            <Iconify
              icon={isFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={24}
              color={isFavorite ? '#F98A21' : colors.text}
            />
          </TouchableOpacity>

          {/* More menüsü - Sadece deste sahibi ise görünür */}
          {currentUserId && deck.user_id === currentUserId && (
            <TouchableOpacity
              ref={moreMenuRef}
              onPress={openMoreMenu}
              activeOpacity={0.7}
            >
              <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, colors.text, isFavorite, favLoading, currentUserId, deck.user_id]);

  const sortCards = (type, cardsList) => {
    if (type === 'az') {
      return [...cardsList].sort((a, b) => (a.question || '').localeCompare(b.question || '', 'tr'));
    } else if (type === 'fav') {
      return [...cardsList].filter(card => favoriteCards.includes(card.id));
    } else {
      return [...originalCards];
    }
  };

  const handleBackFromDetail = () => {
    setSelectedCard(null);
    setSearchBarShouldFocus(false);
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
    return icons[sortOrder] || "material-symbols:category";
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    
      <ScrollView 
        contentContainerStyle={{ paddingBottom: screenHeight * 0.12 }} 
        showsVerticalScrollIndicator={false}
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
              <Iconify icon={getCategoryIcon(categoryInfo?.sort_order)} size={18} color="#fff" />
              <Text style={styles.gfCategoryText}>
                {t(`categories.${categoryInfo?.sort_order}`) || categoryInfo?.name || t('common.category', 'Kategori')}
              </Text>
            </View>
            
            {/* Title - Scrollable if overflows */}
            <View style={styles.gfTitleContainer}>
              <ScrollView
                ref={nameScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEnabled={nameHasOverflow}
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
              {nameHasOverflow && (
                <LinearGradient
                  colors={['transparent', getCategoryGradient(categoryInfo?.sort_order)[0]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gfTitleFade}
                  pointerEvents="none"
                />
              )}
            </View>
            
            {/* Subtitle - Scrollable if overflows */}
            {deck.to_name && (
              <View style={styles.gfTitleContainer}>
                <ScrollView
                  ref={toNameScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  scrollEnabled={toNameHasOverflow}
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
                {toNameHasOverflow && (
                  <LinearGradient
                    colors={['transparent', getCategoryGradient(categoryInfo?.sort_order)[0]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gfTitleFade}
                    pointerEvents="none"
                  />
                )}
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
                      setDescriptionNeedsExpand(e.nativeEvent.lines.length > 3);
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
            
            {/* Creator Chip */}
            {deck.profiles && (
              <View style={styles.gfCreatorChip}>
                <Image
                  source={deck.profiles?.image_url ? { uri: deck.profiles.image_url } : require('../../assets/avatar-default.png')}
                  style={styles.gfCreatorAvatar}
                />
                <Text style={styles.gfCreatorName}>
                  {deck.profiles?.username || t('common.user', 'Kullanıcı')}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Progress & Stats Card - Side by Side Layout */}
        <Animated.View 
          style={[
            styles.gfProgressCard,
            { 
              backgroundColor: colors.cardBackground,
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
                size={170} 
                strokeWidth={17}
                showText={!progressLoading || progress > 0}
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
        </Animated.View>

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
              <Iconify icon="streamline-flex:module-puzzle-2" size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.gfActionTextWrap}>
              <Text style={[styles.gfActionTitle, { color: colors.cardQuestionText }]}>{t('deckDetail.chapters', 'Bölümler')}</Text>
              <Text style={[styles.gfActionDesc, { color: colors.muted }]}>{chapters.length} {t('deckDetail.chaptersCount', 'bölüm')}</Text>
            </View>
            <Iconify icon="ion:chevron-forward" size={22} color={colors.muted} />
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
          </Animated.View>
        )}
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={[styles.fabContainer, { backgroundColor: 'transparent' }]}>
        <View style={styles.fabLeftColumn}>
          {fabMenuOpen && inlineChapterListVisible && (
            <Animated.View
              style={[
                styles.fabInlineDropdown,
                {
                  width: fabExpandedWidth,
                  opacity: fabContentOpacity,
                  transform: [{ translateX: fabContentTranslate }],
                  backgroundColor: colors.buttonColor,
                },
              ]}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.fabChapterListVertical}
              >
                {/* Aksiyon Bölümü - Her zaman en üstte */}
                <TouchableOpacity
                  style={[
                    styles.fabChapterItemVertical,
                    {
                      backgroundColor: selectedChapter?.id === 'action'
                        ? colors.cardBackground
                        : 'rgba(255,255,255,0.15)',
                      borderColor: selectedChapter?.id === 'action'
                        ? colors.cardBackground
                        : 'rgba(255,255,255,0.35)',
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    handleChapterSelect(ACTION_CHAPTER);
                    setInlineChapterListVisible(false);
                  }}
                >
                  <View style={styles.fabChapterItemBadge}>
                    <Iconify 
                      icon="streamline:startup-solid" 
                      size={18} 
                      color={selectedChapter?.id === 'action' ? colors.buttonColor : '#fff'} 
                    />
                  </View>
                  <View style={styles.fabChapterItemContent}>
                    <View style={styles.fabChapterItemTitleRow}>
                      <Text
                        style={[
                          styles.fabChapterItemVerticalText,
                          {
                            color: '#fff',
                            fontWeight: selectedChapter?.id === 'action' ? '700' : '500',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {t('deckDetail.action', 'Aksiyon')}
                      </Text>
                    </View>
                    <View style={styles.fabChapterItemStats}>
                      <View style={styles.fabChapterStatRow}>
                        <Iconify icon="ri:stack-fill" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                        <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                          {deckStats.total}
                        </Text>
                      </View>
                      <View style={styles.fabChapterStatRow}>
                        <Iconify icon="basil:eye-closed-outline" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                        <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                          {deckStats.new || 0}
                        </Text>
                      </View>
                      <View style={styles.fabChapterStatRow}>
                        <Iconify icon="mdi:fire" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                        <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                          {deckStats.learning || 0}
                        </Text>
                      </View>
                      <View style={styles.fabChapterStatRow}>
                        <Iconify icon="dashicons:welcome-learn-more" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                        <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                          {deckStats.learned}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Diğer Bölümler */}
                {chapters.length > 0 && chapters.map((chapter) => {
                  const isSelected = selectedChapter?.id === chapter.id;
                  const chapterProgress = chapterProgressMap.get(chapter.id) || { total: 0, learned: 0, learning: 0, new: 0 };
                  return (
                    <TouchableOpacity
                      key={chapter.id}
                      style={[
                        styles.fabChapterItemVertical,
                        {
                          backgroundColor: isSelected
                            ? colors.cardBackground
                            : 'rgba(255,255,255,0.15)',
                          borderColor: isSelected
                            ? colors.cardBackground
                            : 'rgba(255,255,255,0.35)',
                        },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        handleChapterSelect(chapter);
                        setInlineChapterListVisible(false);
                      }}
                    >
                      <View style={styles.fabChapterItemBadge}>
                        <CircularProgress
                          progress={chapterProgress.total > 0 ? chapterProgress.learned / chapterProgress.total : 0}
                          size={36}
                          strokeWidth={4}
                          showText={false}
                          shouldAnimate={false}
                          fullCircle={true}
                        />
                        <View style={styles.fabChapterProgressTextContainer}>
                          <Text style={[styles.fabChapterProgressText, { color: isSelected ? colors.buttonColor : '#fff' }]}>
                            {Math.round(chapterProgress.total > 0 ? (chapterProgress.learned / chapterProgress.total) * 100 : 0)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.fabChapterItemContent}>
                        <View style={styles.fabChapterItemTitleRow}>
                          <Iconify icon="streamline-freehand:plugin-jigsaw-puzzle" size={16} color="#fff" style={{ marginRight: 6 }} />
                          <Text
                            style={[
                              styles.fabChapterItemVerticalText,
                              {
                                color: '#fff',
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {`${t('chapters.chapter', 'Bölüm')} ${chapter.ordinal}`}
                          </Text>
                        </View>
                        <View style={styles.fabChapterItemStats}>
                          <View style={styles.fabChapterStatRow}>
                            <Iconify icon="ri:stack-fill" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                            <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                              {chapterProgress.total}
                            </Text>
                          </View>
                          <View style={styles.fabChapterStatRow}>
                            <Iconify icon="basil:eye-closed-outline" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                            <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                              {chapterProgress.new || 0}
                            </Text>
                          </View>
                          <View style={styles.fabChapterStatRow}>
                            <Iconify icon="mdi:fire" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                            <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                              {chapterProgress.learning || 0}
                            </Text>
                          </View>
                          <View style={styles.fabChapterStatRow}>
                            <Iconify icon="dashicons:welcome-learn-more" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                            <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                              {chapterProgress.learned}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}

          {/* Ana FAB Butonu */}
          <AnimatedFabContainer
            style={[
              styles.fabButton,
              styles.fabButtonLeft,
              {
                backgroundColor: colors.buttonColor,
                borderColor: colors.buttonColor,
                width: fabExpandedWidth,
                paddingLeft: fabContentPadding,
                justifyContent: fabMenuOpen ? 'flex-end' : 'center',
              },
            ]}
          >
            <Pressable
              style={styles.fabMorphTouchableArea}
              android_ripple={null}
              onPress={() => {
                if (!fabMenuOpen) {
                  setFabMenuOpen(true);
                  return;
                }
                setInlineChapterListVisible(!inlineChapterListVisible);
              }}
            >
              <Animated.View
                style={[
                  styles.fabMorphContent,
                  {
                    opacity: fabContentOpacity,
                    transform: [{ translateX: fabContentTranslate }],
                  },
                ]}
                pointerEvents={fabMenuOpen ? 'auto' : 'none'}
              >
                <View style={styles.fabSelectedChapterPreview}>
                  {selectedChapter?.id === 'action' ? (
                    <View style={styles.fabChapterInfoRow}>
                      <View style={styles.fabChapterItemBadge}>
                        <Iconify 
                          icon="streamline:startup-solid" 
                          size={22} 
                          color="#fff" 
                        />
                      </View>
                      <View style={styles.fabChapterItemContent}>
                        <View style={styles.fabChapterItemTitleRow}>
                          <Text
                            style={[
                              styles.fabChapterItemVerticalText,
                              {
                                color: '#fff',
                                fontWeight: '700',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {t('deckDetail.action', 'Aksiyon')}
                          </Text>
                        </View>
                        <View style={styles.fabChapterItemStats}>
                          <View style={styles.fabChapterStatRow}>
                            <Iconify icon="ri:stack-fill" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                            <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                              {deckStats.total}
                            </Text>
                          </View>
                          <View style={styles.fabChapterStatRow}>
                            <Iconify icon="basil:eye-closed-outline" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                            <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                              {deckStats.new || 0}
                            </Text>
                          </View>
                          <View style={styles.fabChapterStatRow}>
                            <Iconify icon="mdi:fire" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                            <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                              {deckStats.learning || 0}
                            </Text>
                          </View>
                          <View style={styles.fabChapterStatRow}>
                            <Iconify icon="dashicons:welcome-learn-more" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                            <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                              {deckStats.learned}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ) : selectedChapter?.id ? (() => {
                    const chapterProgress = chapterProgressMap.get(selectedChapter.id) || { total: 0, learned: 0, learning: 0, new: 0 };
                    return (
                      <View style={styles.fabChapterInfoRow}>
                        <View style={styles.fabChapterItemBadge}>
                          <CircularProgress
                            progress={chapterProgress.total > 0 ? chapterProgress.learned / chapterProgress.total : 0}
                            size={36}
                            strokeWidth={4}
                            showText={false}
                            shouldAnimate={false}
                            fullCircle={true}
                          />
                          <View style={styles.fabChapterProgressTextContainer}>
                            <Text style={[styles.fabChapterProgressText, { color: '#fff' }]}>
                              {Math.round(chapterProgress.total > 0 ? (chapterProgress.learned / chapterProgress.total) * 100 : 0)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.fabChapterItemContent}>
                          <View style={styles.fabChapterItemTitleRow}>
                            <Iconify icon="streamline-freehand:plugin-jigsaw-puzzle" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text
                              style={[
                                styles.fabChapterItemVerticalText,
                                {
                                  color: '#fff',
                                  fontWeight: '700',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {`${t('chapters.chapter', 'Bölüm')} ${selectedChapter.ordinal}`}
                            </Text>
                          </View>
                          <View style={styles.fabChapterItemStats}>
                            <View style={styles.fabChapterStatRow}>
                              <Iconify icon="ri:stack-fill" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                              <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                                {chapterProgress.total}
                              </Text>
                            </View>
                            <View style={styles.fabChapterStatRow}>
                              <Iconify icon="basil:eye-closed-outline" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                              <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                                {chapterProgress.new || 0}
                              </Text>
                            </View>
                            <View style={styles.fabChapterStatRow}>
                              <Iconify icon="mdi:fire" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                              <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                                {chapterProgress.learning || 0}
                              </Text>
                            </View>
                            <View style={styles.fabChapterStatRow}>
                              <Iconify icon="dashicons:welcome-learn-more" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                              <Text style={[styles.fabChapterStatText, { color: 'rgba(255,255,255,0.7)' }]}>
                                {chapterProgress.learned}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })() : (
                    <View style={styles.fabChapterInfoRow}>
                      <Text style={[styles.fabChapterInfoTitle, { color: '#fff' }]}>
                        {t('deckDetail.unassignedShort', 'Seçilmedi')}
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            </Pressable>
            <TouchableOpacity
              style={styles.fabIconWrapper}
              activeOpacity={0.8}
              onPress={() => {
                setFabMenuOpen(!fabMenuOpen);
                if (fabMenuOpen) {
                  setInlineChapterListVisible(false);
                }
              }}
            >
              <Animated.View style={{ opacity: fabMenuAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }) }}>
                {selectedChapter?.id === 'action' ? (
                  <Iconify 
                    icon="streamline:startup-solid" 
                    size={22} 
                    color="#fff" 
                  />
                ) : (
                  <View style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 99,
                    borderWidth: 1.5,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    minWidth: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{ 
                      color: '#fff', 
                      fontSize: 20, 
                      fontWeight: '700',
                      textShadowColor: 'rgba(0, 0, 0, 0.25)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2,
                    }}>
                      {selectedChapter?.ordinal ?? '-'}
                    </Text>
                  </View>
                )}
              </Animated.View>
            </TouchableOpacity>
          </AnimatedFabContainer>
        </View>

        <TouchableOpacity
          style={[styles.fabButton, styles.fabButtonRight, { 
            borderColor: 'transparent',
            overflow: 'hidden',
          }]}
          activeOpacity={0.95}
          onPress={async () => {
            if (!selectedChapter) {
              Alert.alert(
                t('deckDetail.selectChapter', 'Bölüm Seç'),
                t('deckDetail.selectChapterMessage', 'Lütfen önce bir bölüm seçin.')
              );
              return;
            }
            
            // Deck başlatma kaydı oluştur (decks_stats tablosuna)
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user?.id) {
                await supabase
                  .from('decks_stats')
                  .insert({
                    deck_id: deck.id,
                    user_id: user.id,
                    started_at: new Date().toISOString()
                  });
              }
            } catch (error) {
              // Hata olsa bile devam et (kritik değil)
              console.log('Deck stats log error:', error);
            }
            
            // Aksiyon seçiliyse chapter parametresi gönderme (tüm kartlar gösterilecek)
            const chapterParam = selectedChapter.id === 'action' ? undefined : selectedChapter;
            navigation.navigate('SwipeDeck', { deck, chapter: chapterParam });
          }}
        >
          <LinearGradient
            colors={['#F98A21', '#FF6B35']}
            locations={[0, 0.99]}
            style={styles.fabButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Iconify icon="streamline:button-play-solid" size={22} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* More Menüsü Modal */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setMoreMenuVisible(false)}
        >
          <View
            style={{
              position: 'absolute',
              right: 20,
              top: Platform.OS === 'android' ? moreMenuPos.y + moreMenuPos.height + 4 : moreMenuPos.y + moreMenuPos.height + 8,
              minWidth: 160,
              backgroundColor: colors.cardBackground,
              borderRadius: 14,
              paddingVertical: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 8,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setMoreMenuVisible(false);
                // Kategori bilgisini deck objesine ekle (eğer varsa)
                const deckWithCategory = {
                  ...deck,
                  categories: categoryInfo || deck.categories || null
                };
                navigation.navigate('DeckEdit', { deck: deckWithCategory });
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
              activeOpacity={0.7}
            >
              <Iconify icon="lucide:edit" size={20} color={colors.text} style={{ marginRight: 12 }} />
              <Text style={[typography.styles.body, { color: colors.text, fontSize: 16 }]}>
                {t('deckDetail.edit', 'Desteyi Düzenle')}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <TouchableOpacity
              onPress={() => {
                setMoreMenuVisible(false);
                handleDeleteDeck();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
              activeOpacity={0.7}
            >
              <Iconify icon="mdi:garbage" size={20} color="#E74C3C" style={{ marginRight: 12 }} />
              <Text style={[typography.styles.body, { color: '#E74C3C', fontSize: 16 }]}>
                {t('deckDetail.deleteDeck', 'Desteyi Sil')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FAB Menü Overlay - Dışarı tıklandığında kapat */}
      {fabMenuOpen && (
        <TouchableOpacity
          style={styles.fabMenuOverlay}
          activeOpacity={1}
          onPress={() => setFabMenuOpen(false)}
        />
      )}

      </View>
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
  
  // GRADIENT FLOW STYLES - Modern & Eye-catching
  gfHeroBanner: {
    marginBottom: -50,
  },
  gfHeroGradient: {
    paddingTop: 20,
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
  gfDecorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  gfDecorCircle1: {
    width: 200,
    height: 200,
    top: -60,
    right: -40,
  },
  gfDecorCircle2: {
    width: 120,
    height: 120,
    bottom: 20,
    left: -30,
  },
  gfDecorCircle3: {
    width: 80,
    height: 80,
    top: 60,
    right: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  gfCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
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
  gfTitleFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
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
    marginHorizontal: 16,
    borderRadius: 44,
    paddingVertical: 28,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 20,
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
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
  },

  // Actions
  actionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  actionCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  actionCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  actionIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Share Section
  shareSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  shareContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  shareTextContainer: {
    flex: 1,
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  shareSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  shareInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  shareInfoText: {
    fontSize: 13,
    marginLeft: 6,
  },

  // FAB Styles
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
    zIndex: 1000,
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 99,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabButtonLeft: {
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fabButtonRight: {
    borderWidth: 0,
  },
  fabButtonGradient: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 99,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabMorphContent: {
    flex: 1,
    height: '100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 12,
    marginRight: 12,
    paddingVertical: 12,
  },
  fabMorphTouchableArea: {
    flex: 1,
    height: '100%',
    borderRadius: 28,
    overflow: 'hidden',
  },
  fabSelectedChapterPreview: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingRight: 12,
  },
  fabIconWrapper: {
    width: 56,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabChapterInfo: {
    flex: 1,
    minWidth: 150,
  },
  fabChapterInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  fabChapterInfoContent: {
    flex: 1,
    flexDirection: 'column',
  },
  fabChapterInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  fabChapterInfoStats: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  fabChapterInfoStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabChapterInfoStatText: {
    fontSize: 12,
    fontWeight: '500',
  },
  fabChapterInfoSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  fabLeftColumn: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  fabInlineDropdown: {
    marginBottom: 8,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    maxHeight: 200,
  },
  fabChapterListVertical: {
    gap: 8,
    paddingRight: 8,
  },
  fabChapterItemVertical: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  fabChapterItemBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
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
  fabChapterItemBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  fabChapterItemContent: {
    flex: 1,
    flexDirection: 'column',
  },
  fabChapterItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  fabChapterItemVerticalText: {
    fontSize: 14,
  },
  fabChapterItemStats: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  fabChapterStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabChapterStatText: {
    fontSize: 12,
    fontWeight: '500',
  },
  fabChapterEmptyText: {
    color: '#fff',
    opacity: 0.8,
    fontSize: 13,
    paddingHorizontal: 4,
  },
  fabMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 998,
  },
});
