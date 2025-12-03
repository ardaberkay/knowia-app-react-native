import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Platform, Modal, FlatList, TextInput, Pressable, Image, Switch, Animated, Dimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
 
import { Iconify } from 'react-native-iconify';
import { Alert as RNAlert } from 'react-native';
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
  const nameScrollRef = useRef(null);
  const [nameHasOverflow, setNameHasOverflow] = useState(false);
  const [nameContainerWidth, setNameContainerWidth] = useState(0);
  const [nameContentWidth, setNameContentWidth] = useState(0);
  const [showNameScrollbar, setShowNameScrollbar] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const fabMenuAnimation = useRef(new Animated.Value(0)).current;
  const [chapters, setChapters] = useState([]);
  const [chapterProgressMap, setChapterProgressMap] = useState(new Map());
  // "Aksiyon" özel bölümü - tüm kartları gösterir
  const ACTION_CHAPTER = { id: 'action', name: 'Aksiyon', ordinal: null };
  const [selectedChapter, setSelectedChapter] = useState(ACTION_CHAPTER);
  const [inlineChapterListVisible, setInlineChapterListVisible] = useState(false);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: screenHeight * 0.1 }} showsVerticalScrollIndicator={false}>
        {/* Birleşik Deck Info Kartı */}
        <View style={[styles.infoCardGlass, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, shadowColor: colors.shadowColor, shadowOffset: colors.shadowOffset, shadowOpacity: colors.shadowOpacity, shadowRadius: colors.shadowRadius, elevation: colors.elevation, width: '100%', maxWidth: 440, alignSelf: 'center', marginTop: 12, paddingVertical: 20 }]}>
          
          {/* Unified Deck Header Section */}
          <View style={{ width: '100%', alignItems: 'center', marginBottom: 20 }}>
            <View
              style={[styles.unifiedDeckHeader, { 
                backgroundColor: colors.cardBackground,
                borderColor: colors.cardBorder,
                shadowColor: colors.shadowColor,
              }]}
            >
              {/* Left Side - Category Icon */}
              {categoryInfo && (
                <View style={styles.leftSection}>
                  <LinearGradient
                    colors={[getCategoryColor(categoryInfo.sort_order) + '25', getCategoryColor(categoryInfo.sort_order) + '15']}
                    style={[styles.categoryIconSection, { 
                      borderColor: getCategoryColor(categoryInfo.sort_order),
                    }]}
                  >
                    <Iconify 
                      icon={getCategoryIcon(categoryInfo.sort_order)} 
                      size={50} 
                      color={getCategoryColor(categoryInfo.sort_order)} 
                    />
                  </LinearGradient>
                </View>
              )}
              
              {/* Center Divider */}
              <View style={[styles.centerDivider, { backgroundColor: colors.progressBar || '#e0e0e0' }]} />
              
              {/* Right Side - Deck Names (horizontal scroll when overflow) */}
              <View style={styles.rightSection} onLayout={(e) => setNameContainerWidth(e.nativeEvent.layout.width)}>
                <ScrollView
                  horizontal
                  ref={nameScrollRef}
                  scrollEnabled={nameHasOverflow}
                  showsHorizontalScrollIndicator={showNameScrollbar && nameHasOverflow}
                  contentContainerStyle={{ 
                    alignItems: 'flex-start', 
                    justifyContent: nameHasOverflow ? 'flex-start' : 'center',
                    paddingHorizontal: 0,
                    flexGrow: 1,
                  }}
                  style={{ width: '100%' }}
                  onContentSizeChange={(w) => {
                    setNameContentWidth(w);
                    const overflow = w > nameContainerWidth + 2;
                    if (overflow !== nameHasOverflow) {
                      setNameHasOverflow(overflow);
                      if (overflow) {
                        // Show scrollbar briefly, then perform a small nudge
                        setShowNameScrollbar(true);
                        setTimeout(() => setShowNameScrollbar(false), 1800);
                        requestAnimationFrame(() => {
                          if (nameScrollRef.current) {
                            try {
                              nameScrollRef.current.scrollTo({ x: 18, animated: true });
                              setTimeout(() => {
                                nameScrollRef.current && nameScrollRef.current.scrollTo({ x: 0, animated: true });
                              }, 700);
                            } catch {}
                          }
                        });
                      } else {
                        // Overflow yoksa scroll pozisyonunu sıfırla
                        if (nameScrollRef.current) {
                          try {
                            nameScrollRef.current.scrollTo({ x: 0, animated: false });
                          } catch {}
                        }
                      }
                    }
                  }}
                >
                  <View style={{ alignItems: 'flex-start', justifyContent: 'flex-start', paddingHorizontal: 4 }}>
                    <Text style={[styles.deckTitleUnified, { color: colors.cardQuestionText }]} numberOfLines={1}>{deck.name}</Text>
                    {deck.to_name && (
                      <>
                        <View style={[styles.miniDivider, { backgroundColor: colors.cardDivider }]} />
                        <Text style={[styles.deckSubtitleUnified, { color: colors.cardQuestionText }]} numberOfLines={1}>{deck.to_name}</Text>
                      </>
                    )}
                  </View>
                </ScrollView>
                {/* Right-edge hint removed to avoid magnifier effect */}
              </View>
            </View>
          </View>

          {/* Progress Section - Compact */}
          <View style={{ marginBottom: 15, alignItems: 'center', position: 'relative' }}>
            {/* Card Count - Top Right */}
            <View style={[styles.cardCountTopRight, { backgroundColor: colors.buttonColor }]}>
              <Iconify icon="ri:stack-fill" size={17} color="#fff" style={{ marginRight: 3 }} />
              <Text style={[typography.styles.caption, styles.cardCountTextTopRight]}>{deck.card_count || 0}</Text>
            </View>
            
            {/* Learned Cards Count - Top Left */}
            <View style={[styles.learnedCardsTopLeft, { backgroundColor: colors.secondary }]}>
              <Iconify icon="dashicons:welcome-learn-more" size={17} color="#fff" style={{ marginRight: 3 }} />
              <Text style={[typography.styles.caption, styles.learnedCardsTextTopLeft]}>{learnedCardsCount}</Text>
            </View>
            
            <CircularProgress 
              progress={progress} 
              size={185} 
              strokeWidth={22}
              showText={!progressLoading || progress > 0}
              containerStyle={{ marginTop: 25 }}
              shouldAnimate={!progressLoading}
            fullCircle={true}
            />
          </View>

          {/* Details Section - Prominent */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Iconify icon="mage:checklist-note" size={22} color={colors.buttonColor} style={{ marginRight: 8 }} />
              <Text style={[typography.styles.body, styles.sectionTitle, { color: colors.cardQuestionText, fontSize: 18 }]}>{t('deckDetail.details', 'Detaylar')}</Text>
            </View>
            {deck.description && deck.description.trim().length > 0 ? (
              <ScrollView style={{ maxHeight: 70 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                <Text style={[styles.deckDescription, typography.styles.body, { color: colors.cardAnswerText, fontSize: 16, lineHeight: 24 }]}>{deck.description}</Text>
              </ScrollView>
            ) : (
              <View style={{ height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, padding: 16 }}>
                <Text style={[styles.deckDescription, typography.styles.body, { color: colors.muted, textAlign: 'center', fontSize: 16 }]}>
                  {t('deckDetail.noDescription', 'Deste için detay verilmemiş.')}
                </Text>
              </View>
            )}
          </View>

        </View>
        {/* Kartlar ve Bölümler */}
        <View style={[styles.cardsHeaderCard,  { backgroundColor:  colors.cardBackground, borderColor: colors.cardBorder, shadowColor: colors.shadowColor, shadowOffset: colors.shadowOffset, shadowOpacity: colors.shadowOpacity, shadowRadius: colors.shadowRadius, elevation: colors.elevation }]}>
          <TouchableOpacity onPress={() => navigation.navigate('DeckCards', { deck })} activeOpacity={0.8} style={styles.sectionButton}>
            <View style={[styles.cardsHeaderRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Iconify icon="ph:cards-three" size={22} color={colors.buttonColor} style={{ marginRight: 8 }} />
                <Text style={[typography.styles.body, styles.sectionTitle, { color: colors.cardQuestionText }]}>{t('deckDetail.cards', 'Kartlar')}</Text>
              </View>
              <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={23} color={colors.headText} />
            </View>
          </TouchableOpacity>
          
          <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: -5 }]} />
          
          <TouchableOpacity onPress={() => navigation.navigate('Chapters', { deck })} activeOpacity={0.8} style={styles.sectionButton}>
            <View style={[styles.cardsHeaderRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Iconify icon="streamline-flex:module-puzzle-2" size={22} color={colors.buttonColor} style={{ marginRight: 8 }} />
                <Text style={[typography.styles.body, styles.sectionTitle, { color: colors.cardQuestionText }]}>{t('deckDetail.chapters', 'Bölümler')}</Text>
              </View>
              <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={23} color={colors.headText} />
            </View>
          </TouchableOpacity>
        </View>
        <View style={{ height: 12 }} />
        {/* Toplulukla Paylaş Kutusu (Glassmorphism) */}
        {shareComponentVisible && (
          <View 
            style={[
              styles.infoCardGlass, 
              { 
                backgroundColor: colors.cardBackground, 
                borderColor: colors.cardBorder, 
                shadowColor: colors.shadowColor, 
                shadowOffset: colors.shadowOffset, 
                shadowOpacity: colors.shadowOpacity, 
                shadowRadius: colors.shadowRadius, 
                elevation: colors.elevation, 
                width: '100%', 
                maxWidth: 440, 
                alignSelf: 'center', 
                paddingVertical: 10,
              }
            ]}
          >
            <View style={styles.switchRow}>
              <View style={styles.labelRow}>
                <Iconify icon="fluent:people-community-20-filled" size={20} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, { color: colors.cardQuestionText }]}>{t('deckDetail.shareWithCommunity', 'Toplulukla Paylaş')}</Text>
                <TouchableOpacity onPress={handleShowShareDetails} activeOpacity={0.7} style={{ marginLeft: 8, marginTop: 2 }}>
                  <Iconify icon="material-symbols:info-outline" size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <Switch
                value={isShared}
                onValueChange={handleToggleShare}
                trackColor={{ false: '#e0e0e0', true: '#5AA3F0' }}
                thumbColor={isShared ? colors.secondary : '#f4f3f4'}
                disabled={shareLoading}
              />
            </View>
          </View>
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
          activeOpacity={0.8}
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
                navigation.navigate('DeckEdit', { deck });
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  headerCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deckTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  deckDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  bottomButtonContainer: {
    padding: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  startButton: {
    flex: 1,
    backgroundColor: '#007AFF', // override with theme
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  favButton: {
    flex: 1,
    backgroundColor: '#fff', // override with theme
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  favButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonTextDisabled: {
    // color theme ile override edilecek
  },
  // Modern stiller
  headerCardModern: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    shadowColor: '#F98A21',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  deckTitleModern: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F98A21',

    textAlign: 'center',
  },
  statsContainerModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  statBadgeModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statBadgeTextModern: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  statLabelModern: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  infoCardModern: {
    borderRadius: 28,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: '#fff',
    shadowColor: '#F98A21',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
  },
  progressContainerModern: {
    marginTop: 8,
  },
  progressBarModern: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFillModern: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#F98A21',
  },
  bottomButtonContainerModern: {
    padding: 18,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#F98A21',
    shadowOffset: { width: 4, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  favButtonModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    paddingHorizontal: 5,
  },
  favButtonActive: {
    backgroundColor: '#fff8f0',
    borderColor: '#F98A21',
  },
  favButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  startButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Glassmorphism + Floating Card stilleri
  bgGradient: {
    flex: 1,
  },
  scrollContent: {
    padding: 0,
    paddingBottom: 32,
  },
  floatingCardWrapper: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 18,
  },
  floatingCard: {
    width: '88%',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  deckTitleGlass: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  statsRowGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  statBadgeGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
  },
  statBadgeTextGlass: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  statLabelGlass: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  infoCardGlass: {
    borderRadius: 28,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 11,
    borderWidth: 1,
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
  },
  progressContainerGlass: {
    marginTop: 8,
  },
  progressBarGlass: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffe0c3',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFillGlass: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#F98A21',
  },
  favButtonGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  favButtonActiveGlass: {
    backgroundColor: '#fff8f0',
    borderColor: '#F98A21',
  },
  favButtonTextGlass: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  startButtonTextGlass: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  fixedButtonBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  cardsHeaderCard: {
    borderRadius: 28,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderWidth: 1,
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardsSearchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 10,
  },
  cardsSearchBarWrapperModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    paddingHorizontal: 10,
  },
  cardsSearchIcon: {
    marginRight: 6,
  },
  cardsSearchBarModern: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    borderWidth: 0,
  },
  cardsFilterIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffff',
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#F98A21',
    height: 48,
    aspectRatio: 1,
  },
  cardsListContainer: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  cardItemGlass: {
    width: '100%',
    minHeight: 110,
    backgroundColor: '#fff',
    borderRadius: 28,
    marginBottom: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F98A21',
    shadowColor: '#F98A21',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  cardQuestion: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#F98A21',
    marginBottom: 8,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#ffe0c3',
    alignSelf: 'stretch',
    marginVertical: 6,
    borderRadius: 1,
  },
  cardAnswer: {
    fontSize: 15,
    color: '#333',
    marginTop: 2,
  },
  cardsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    width: '100%',
  },
  cardsHeaderIcon: {
    marginRight: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  cardTextCol: {
    width: '80%',
    maxWidth: 320,
  },
  cardFavIconBtn: {
    padding: 2,
  },
  cardDetailContainer: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  cardDetailHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  cardDetailImage: {
    width: 120,
    height: 160,
    maxWidth: '100%',
    borderRadius: 18,
    marginBottom: 14,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  cardDetailTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
    fontSize: 18,
  },
  cardDetailText: {
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 'normal',
  },
  cardDetailBody: {
    marginBottom: 0,
    width: '100%',
  },
  cardDetailDate: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 16,
  },
  cardDetailCloseButton: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  cardDetailCloseButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cardDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    width: '100%',
    justifyContent: 'center',
  },
  cardDetailDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ffe0c3',
    borderRadius: 1,
    marginHorizontal: 14,
  },
  dividerLine: {
    width: '60%',
    height: 1,
    alignSelf: 'center',
    marginVertical: 6,
  },
  sectionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    width: '100%',
  },
  // Share with community styles
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelIcon: {
    marginRight: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  detailsRow: {
    alignSelf: 'flex-end',
    paddingRight: 10,
    marginTop: -10,
  },
  detailsText: {
    textDecorationLine: 'underline',
  },
  // Unified Deck Header Styles
  unifiedDeckHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 28,
    borderWidth: 2,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    minHeight: 120,
  },
  leftSection: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconSection: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDivider: {
    width: 1,
    height: 60,
    borderRadius: 0.5,
    marginHorizontal: 16,
  },
  rightSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  deckTitleUnified: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  deckSubtitleUnified: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4,
  },
  miniDivider: {
    width: '100%',
    height: 1,
    borderRadius: 0.5,
    marginVertical: 4,
    alignSelf: 'center',
  },
  // Card Count Top Right Styles
  cardCountTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 10,
  },
  cardCountTextTopRight: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  // Learned Cards Count Top Left Styles
  learnedCardsTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 10,
  },
  learnedCardsTextTopLeft: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
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
  chapterListModalOverlay: {
    height: 0,
  },
  chapterListModal: {
    height: 0,
  },
  chapterListHeader: {
    height: 0,
  },
  chapterListTitle: {
    height: 0,
  },
  chapterListScroll: {
    height: 0,
  },
  chapterListItem: {
    height: 0,
  },
  chapterListItemText: {
    height: 0,
  },
});