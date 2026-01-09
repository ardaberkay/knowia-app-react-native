import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, Dimensions, Pressable, Animated, Easing, Image, ScrollView } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { getCardsForLearning, ensureUserCardProgress } from '../../services/CardService';
import { supabase } from '../../lib/supabase';
import { Iconify } from 'react-native-iconify';
import { LinearGradient } from 'expo-linear-gradient';
import logoasil from '../../assets/logoasil.png';
import { useTranslation } from 'react-i18next';
import { addFavoriteCard, removeFavoriteCard, getFavoriteCards } from '../../services/FavoriteService';
import LottieView from 'lottie-react-native';

const { width, height } = Dimensions.get('window');

// Kart boyutlandırma sabitleri
const CARD_WIDTH = width * 0.88; // %92 genişlik
const CARD_ASPECT_RATIO = 1.45; // Daha da uzun oran
const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT_RATIO;

export default function SwipeDeckScreen({ route, navigation }) {
  const { deck, chapter } = route.params || {};
  const { colors } = useTheme();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userId, setUserId] = useState(null);
  const [flipped, setFlipped] = useState({});
  const animatedValues = useRef({});
  const [leftCount, setLeftCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [initialLearnedCount, setInitialLearnedCount] = useState(0);
  const [leftHighlight, setLeftHighlight] = useState(false);
  const [rightHighlight, setRightHighlight] = useState(false);
  const swiperRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [undoDisabled, setUndoDisabled] = useState(false);
  const [historyDirections, setHistoryDirections] = useState([]);
  const [totalCardCount, setTotalCardCount] = useState(0);
  const [remainingCardCount, setRemainingCardCount] = useState(0);
  const [totalLearningCount, setTotalLearningCount] = useState(0);
  const [currentLearnedCount, setCurrentLearnedCount] = useState(null);
  const [currentLearningCount, setCurrentLearningCount] = useState(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayTimeout = useRef(null);
  const autoPlayFlipTimeout = useRef(null);
  const { t } = useTranslation();
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [categorySortOrder, setCategorySortOrder] = useState(null);

  // Header'a favori butonunu ekle
  useEffect(() => {
    const currentCard = cards[currentIndex];
    const isCurrentCardFavorite = currentCard ? favoriteIds.has(currentCard.card_id) : false;
    
    navigation.setOptions({
      headerRight: () => (
        !loading && currentCard ? (
          <TouchableOpacity
            onPress={() => toggleFavorite(currentCard.card_id)}
            style={{ marginRight: 16 }}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Iconify
              icon={isCurrentCardFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={26}
              color={isCurrentCardFavorite ? colors.buttonColor : colors.text}
            />
          </TouchableOpacity>
        ) : null
      ),
    });
  }, [navigation, cards, currentIndex, favoriteIds, colors.buttonColor, colors.text, toggleFavorite, loading]);

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
      // Kullanıcıyı al
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user.id);
      
      // Deck'in kategori bilgisini al
      try {
        const { data: deckData, error: deckError } = await supabase
          .from('decks')
          .select('categories(sort_order)')
          .eq('id', deck.id)
          .single();
        
        if (!deckError && deckData?.categories) {
          setCategorySortOrder(deckData.categories.sort_order);
        }
      } catch (e) {
        console.error('Error fetching deck category:', e);
      }
      
      // Mevcut favori kartları yükle ve UI'ı senkronla
      try {
        const favCards = await getFavoriteCards(user.id);
        const favSet = new Set((favCards || []).map((c) => c.id));
        setFavoriteIds(favSet);
      } catch (e) {
        // sessiz geç
      }
      // Eksik user_card_progress kayıtlarını oluştur
      await ensureUserCardProgress(deck.id, user.id);
      // Kartları user_card_progress üzerinden çek (status: 'new' veya 'learning')
      let learningCardsQuery = supabase
        .from('user_card_progress')
        .select('card_id, status, next_review, cards(question, image, answer, example, note, chapter_id)')
        .eq('user_id', user.id)
        .in('status', ['new', 'learning'])
        .lte('next_review', new Date().toISOString())
        .eq('cards.deck_id', deck.id);
      
      // Bölüm filtresi ekle
      if (chapter?.id) {
        learningCardsQuery = learningCardsQuery.eq('cards.chapter_id', chapter.id);
      } else if (chapter === null) {
        // null chapter = atanmamış kartlar
        learningCardsQuery = learningCardsQuery.is('cards.chapter_id', null);
      }
      
      const { data: learningCards, error } = await learningCardsQuery;
      console.log('learningCards:', learningCards);
      console.log('supabase error:', error);
      setCards((learningCards || []).filter(card => card.cards));
      setFlipped({});
      
      // Toplam kart sayısı (seçilen bölüme ait tüm kartlar)
      let allCardsQuery = supabase
        .from('cards')
        .select('id')
        .eq('deck_id', deck.id);
      
      if (chapter?.id) {
        allCardsQuery = allCardsQuery.eq('chapter_id', chapter.id);
      } else if (chapter === null) {
        allCardsQuery = allCardsQuery.is('chapter_id', null);
      }
      
      const { data: allCards, error: allCardsError } = await allCardsQuery;
      setTotalCardCount(allCards ? allCards.length : 0);
      
      // Kalan kart sayısı (status learned olmayanlar, seçilen bölüm için)
      let notLearnedQuery = supabase
        .from('user_card_progress')
        .select('card_id, cards(deck_id, chapter_id)')
        .eq('user_id', user.id)
        .eq('cards.deck_id', deck.id)
        .neq('status', 'learned');
      
      if (chapter?.id) {
        notLearnedQuery = notLearnedQuery.eq('cards.chapter_id', chapter.id);
      } else if (chapter === null) {
        notLearnedQuery = notLearnedQuery.is('cards.chapter_id', null);
      }
      
      const { data: notLearned, error: notLearnedError } = await notLearnedQuery;
      setRemainingCardCount(notLearned ? notLearned.length : 0);
      
      // Learning kart sayısını al (seçilen bölüm için)
      let learningCardsCountQuery = supabase
        .from('user_card_progress')
        .select('card_id, status, cards(deck_id, chapter_id)')
        .eq('user_id', user.id)
        .eq('status', 'learning')
        .eq('cards.deck_id', deck.id);
      
      if (chapter?.id) {
        learningCardsCountQuery = learningCardsCountQuery.eq('cards.chapter_id', chapter.id);
      } else if (chapter === null) {
        learningCardsCountQuery = learningCardsCountQuery.is('cards.chapter_id', null);
      }
      
      const { data: learningCardsExist, error: learningCardsExistError } = await learningCardsCountQuery;
      setTotalLearningCount(learningCardsExist ? learningCardsExist.length : 0);
      
      // Başlangıçta learned olan kartların sayısını al (seçilen bölüm için)
      let learnedCardsQuery = supabase
        .from('user_card_progress')
        .select('card_id, cards(deck_id, chapter_id)')
        .eq('user_id', user.id)
        .eq('status', 'learned')
        .eq('cards.deck_id', deck.id);
      
      if (chapter?.id) {
        learnedCardsQuery = learnedCardsQuery.eq('cards.chapter_id', chapter.id);
      } else if (chapter === null) {
        learnedCardsQuery = learnedCardsQuery.is('cards.chapter_id', null);
      }
      
      const { data: learnedCards, error: learnedCardsError } = await learnedCardsQuery;
      const filteredLearnedCards = (learnedCards || []).filter(
        c => c.cards && c.cards.deck_id === deck.id
      );
      setInitialLearnedCount(filteredLearnedCards.length);
      setLoading(false);
    };
    fetchCards();
  }, [deck.id, chapter?.id]);

  const handleSwipe = useCallback(async (cardIndex, direction) => {
    setFlipped((prev) => ({ ...prev, [cardIndex]: false }));
    if (!cards[cardIndex]) return;
    const card = cards[cardIndex];
    if (!userId) return;
    setHistory((prev) => [...prev, cardIndex]);
    setHistoryDirections((prev) => [...prev, direction]);
    if (direction === 'right') {
      setRightCount((prev) => prev + 1);
      setRightHighlight(true);
      setTimeout(() => setRightHighlight(false), 400);
      // Öğrendim (artık tekrar gösterilmesin)
      await supabase
        .from('user_card_progress')
        .update({ status: 'learned' })
        .eq('user_id', userId)
        .eq('card_id', card.card_id);
    } else if (direction === 'left') {
      setLeftCount((prev) => prev + 1);
      setLeftHighlight(true);
      setTimeout(() => setLeftHighlight(false), 400);
      // 1 dakika sonra tekrar göster
      await supabase
        .from('user_card_progress')
        .update({ status: 'learning', next_review: new Date(Date.now() + 60 * 1000) })
        .eq('user_id', userId)
        .eq('card_id', card.card_id);
    }
    setCurrentIndex(cardIndex + 1);
  }, [cards, userId]);

  const handleFlip = (cardIndex) => {
    setFlipped((prev) => {
      const newFlipped = { ...prev, [cardIndex]: !prev[cardIndex] };
      if (!animatedValues.current[cardIndex]) {
        animatedValues.current[cardIndex] = new Animated.Value(0);
      }
      Animated.timing(animatedValues.current[cardIndex], {
        toValue: newFlipped[cardIndex] ? 1 : 0,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
      return newFlipped;
    });
  };

  const handleSkip = async (minutes) => {
    if (!cards[currentIndex]) return;
    const card = cards[currentIndex];
    if (!userId) return;
    const nextReview = new Date(Date.now() + minutes * 60 * 1000);
    await supabase
      .from('user_card_progress')
      .update({ status: 'learning', next_review: nextReview })
      .eq('user_id', userId)
      .eq('card_id', card.card_id);
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
      console.log('swipeBack çağrıldı', swiperRef.current);
      swiperRef.current.swipeBack();
      setCurrentIndex(lastIndex);
      setHistory((prev) => prev.slice(0, -1));
      setHistoryDirections((prev) => {
        if (prev.length === 0) return prev;
        const lastDirection = prev[prev.length - 1];
        if (lastDirection === 'right') {
          setRightCount((c) => Math.max(0, c - 1));
        } else if (lastDirection === 'left') {
          setLeftCount((c) => Math.max(0, c - 1));
        }
        return prev.slice(0, -1);
      });
    } else {
      console.log('swipeBack çağrılamadı', swiperRef.current, history);
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
      handleFlip(currentIndex);
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
  }, [autoPlay, currentIndex, cards.length]);

  // Auto play durdurucu (kartlar bittiğinde veya ekran değişirse)
  useEffect(() => {
    return () => {
      if (autoPlayTimeout.current) clearTimeout(autoPlayTimeout.current);
      if (autoPlayFlipTimeout.current) clearTimeout(autoPlayFlipTimeout.current);
    };
  }, []);

  // Kullanıcıya ait learned ve learning sayılarını çek (kartlar bittiğinde veya kart yoksa)
  useEffect(() => {
    const fetchCurrentStats = async () => {
      // Kartlar bittiğinde veya hiç kart yoksa (zamanı gelmemiş kartlar) sayıları çek
      if ((cards.length === 0 || currentIndex >= cards.length) && userId && deck?.id) {
        try {
          // Güncel learned kart sayısı (kullanıcıya ait, deck'teki)
          let learnedQuery = supabase
            .from('user_card_progress')
            .select('card_id, cards(deck_id, chapter_id)')
            .eq('user_id', userId)
            .eq('status', 'learned')
            .eq('cards.deck_id', deck.id);
          
          if (chapter?.id) {
            learnedQuery = learnedQuery.eq('cards.chapter_id', chapter.id);
          } else if (chapter === null) {
            learnedQuery = learnedQuery.is('cards.chapter_id', null);
          }
          
          const { data: learnedCards } = await learnedQuery;
          const filteredLearned = (learnedCards || []).filter(c => c.cards && c.cards.deck_id === deck.id);
          setCurrentLearnedCount(filteredLearned.length);

          // Güncel learning kart sayısı (kullanıcıya ait, deck'teki, sadece status: 'learning')
          let learningQuery = supabase
            .from('user_card_progress')
            .select('card_id, status, cards(deck_id, chapter_id)')
            .eq('user_id', userId)
            .eq('status', 'learning')
            .eq('cards.deck_id', deck.id);
          
          if (chapter?.id) {
            learningQuery = learningQuery.eq('cards.chapter_id', chapter.id);
          } else if (chapter === null) {
            learningQuery = learningQuery.is('cards.chapter_id', null);
          }
          
          const { data: learningCards } = await learningQuery;
          const filteredLearning = (learningCards || []).filter(
            c => c.cards && c.cards.deck_id === deck.id && c.status === 'learning'
          );
          setCurrentLearningCount(filteredLearning.length);
        } catch (error) {
          console.error('Error fetching current stats:', error);
        }
      }
    };

    fetchCurrentStats();
  }, [cards.length, currentIndex, userId, deck?.id, chapter?.id]);

  const FlipCard = ({ card, cardIndex, currentIndex }) => {
    // Modern Pill başlık bileşeni (etiket + ikon)
    const Pill = ({ label, icon, color = colors.buttonColor }) => (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 20,
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1.5,
          borderColor: 'rgba(255, 255, 255, 0.3)',
          marginBottom: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 }}>{label}</Text>
      </View>
    );

    // Bölüm ayırıcı bileşeni
    const SectionDivider = () => (
      <View style={{
        width: '60%',
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginVertical: 20,
        alignSelf: 'center',
      }} />
    );


    // Kategori rengini al
    const gradientColors = getCategoryColors(categorySortOrder);
    
    // Eğer kart yoksa veya stack'teki alttaki kartsa, placeholder göster
    if (!card || !card.cards || cardIndex > currentIndex) {
      return (
        <View style={[styles.card, { opacity: 0.7 }]}> 
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
          />
        </View>
      );
    }
    if (!animatedValues.current[cardIndex]) {
      animatedValues.current[cardIndex] = new Animated.Value(0);
    }
    const frontInterpolate = animatedValues.current[cardIndex].interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });
    const backInterpolate = animatedValues.current[cardIndex].interpolate({
      inputRange: [0, 1],
      outputRange: ['180deg', '360deg'],
    });
    const frontAnimatedStyle = {
      transform: [
        { rotateY: frontInterpolate },
      ],
      backfaceVisibility: 'hidden',
      position: 'absolute',
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const backAnimatedStyle = {
      transform: [
        { rotateY: backInterpolate },
      ],
      backfaceVisibility: 'hidden',
      position: 'absolute',
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    return (
      <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT, alignSelf: 'center' }}>
        {/* Kart içeriği (flip alanı) */}
        <Pressable
          onPress={() => handleFlip(cardIndex)}
          style={{ flex: 1 }}
        >
          {/* Ön yüz */}
          <Animated.View style={[styles.card, { backgroundColor: colors.cardBackground, justifyContent: card.cards.image ? 'flex-start' : 'center' }, frontAnimatedStyle]}>
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            />
            {card.cards.image && (
              <View style={[styles.imageContainer, { backgroundColor: 'transparent', marginTop: 32 }]}> 
                <Image
                  source={{ uri: card.cards.image }}
                  style={styles.cardImage}
                />
              </View>
            )}
            
            <Text style={[typography.styles.h2, { color: colors.text, marginBottom: card.cards.image ? 16 : 0, textAlign: 'center' }]}>{card.cards.question}</Text>
          </Animated.View>
          {/* Arka yüz */}
          <Animated.View style={[styles.card, { backgroundColor: colors.cardBackground }, backAnimatedStyle]}>
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            />
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                paddingHorizontal: 24,
                paddingTop: 32,
                paddingBottom: 24,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Answer Section */}
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <Pill
                  label={t('swipeDeck.answer', 'Answer')}
                  icon={<Iconify icon="uil:comment-alt-check" size={18} color="#fff" />}
                />
                <Text style={[
                  typography.styles.h2,
                  {
                    color: '#fff',
                    textAlign: 'center',
                    marginTop: 8,
                    lineHeight: 28,
                    fontWeight: '600',
                  }
                ]}>
                  {card.cards.answer}
                </Text>
              </View>

              {/* Example Section */}
              {card.cards.example && (
                <>
                  <SectionDivider />
                  <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <Pill
                      label={t('swipeDeck.example', 'Example')}
                      icon={<Iconify icon="lucide:lightbulb" size={18} color="#fff" />}
                    />
                    <Text style={[
                      typography.styles.subtitle,
                      {
                        color: 'rgba(255, 255, 255, 0.9)',
                        textAlign: 'center',
                        marginTop: 8,
                        lineHeight: 22,
                        fontSize: 16,
                      }
                    ]}>
                      {card.cards.example}
                    </Text>
                  </View>
                </>
              )}

              {/* Note Section */}
              {card.cards.note && (
                <>
                  <SectionDivider />
                  <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <Pill
                      label={t('swipeDeck.note', 'Note')}
                      icon={<Iconify icon="material-symbols-light:stylus-note" size={18} color="#fff" />}
                    />
                    <Text style={[
                      typography.styles.subtitle,
                      {
                        color: 'rgba(255, 255, 255, 0.85)',
                        textAlign: 'center',
                        marginTop: 8,
                        lineHeight: 22,
                        fontSize: 15,
                        fontStyle: 'italic',
                      }
                    ]}>
                      {card.cards.note}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </View>
    );
  };

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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ width: '100%', alignItems: 'center', marginTop: 110}}>
          <Image source={logoasil} style={{ width: 260, height: 260, resizeMode: 'cover' }} />
          <Text style={[typography.styles.h2, { color: colors.text, textAlign: 'center', marginTop: 16 }]}> 
            {progress === totalCardCount ? t('swipeDeck.bravo', "Bravo! Tüm Kartları Tamamladın") : t('swipeDeck.learnTime', "Kalan Kartları Öğrenmeye Vakit Var")}
          </Text>
          <View style={{ width: 72, height: 1, backgroundColor: colors.orWhite, borderRadius: 2, alignSelf: 'center', marginTop: 16, marginBottom: 32 }} />
          
          {/* İstatistik Kartları */}
          <View style={styles.statsContainer}>
            {/* Learning Kartlar */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: '#f3a14c' }]}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(243, 161, 76, 0.1)' }]}>
                <Iconify icon="mingcute:time-fill" size={24} color="#f3a14c" />
              </View>
              <Text style={[styles.statNumber, { color: colors.text }]}>{learningCount}</Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>{t('swipeDeck.learning', 'Öğreniliyor')}</Text>
            </View>

            {/* Learned Kartlar */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: '#3e8e41' }]}>
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(62, 142, 65, 0.1)' }]}>
                <Iconify icon="hugeicons:tick-01" size={24} color="#3e8e41" />
              </View>
              <Text style={[styles.statNumber, { color: colors.text }]}>{learnedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>{t('swipeDeck.learned', 'Öğrenildi')}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sayaçlar */}
      <View style={styles.counterRow}>
        <View style={[styles.counterBoxLeft, { backgroundColor: leftHighlight ? leftActiveColor : leftInactiveColor }]}>
          {leftHighlight ? (
            <Iconify icon="mingcute:time-fill" size={18} color="#fff" />
          ) : (
            <Text style={styles.counterText}>{leftCount}</Text>
          )}
        </View>
        <View style={styles.deckProgressBox}>
          <Text style={[styles.deckProgressText, {color: colors.text}]}>{leftCount + initialLearnedCount + rightCount}/{totalCardCount}</Text>
        </View>
        <View style={[styles.counterBoxRight, { backgroundColor: rightHighlight ? rightActiveColor : rightInactiveColor }]}>
          {rightHighlight ? (
            <Iconify icon="hugeicons:tick-01" size={18} color="#fff" />
          ) : (
            <Text style={styles.counterText}>{rightCount}</Text>
          )}
        </View>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: 15 }}>
        <Swiper
          ref={swiperRef}
          cards={cards}
          cardIndex={currentIndex}
          renderCard={(card, i) => (
            <FlipCard
              card={card}
              cardIndex={i}
              currentIndex={currentIndex}
              key={card.card_id}
            />
          )}
          onSwipedLeft={(i) => { handleSwipe(i, 'left'); setCurrentIndex(i + 1); }}
          onSwipedRight={(i) => { handleSwipe(i, 'right'); setCurrentIndex(i + 1); }}
          overlayLabels={{
            left: {
              element: (
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderWidth: 2,
                  borderColor: '#F98A21',
                  borderRadius: 26,
                }} />
              ),
              style: {
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  marginTop: 0,
                  marginLeft: 0,
                }
              }
            },
            right: {
              element: (
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderWidth: 2,
                  borderColor: '#3e8e41',
                  borderRadius: 26,
                }} />
              ),
              style: {
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginTop: 0,
                  marginLeft: 0,
                }
              }
            }
          }}
          overlayOpacityHorizontalThreshold={60}
          animateOverlayLabelsOpacity
          onSwipedTop={(i) => {
            // Yukarı swipe yapıldığında kartı geri getir
            if (swiperRef.current) {
              swiperRef.current.swipeBack();
            }
          }}
          disableTopSwipe={true}
          disableBottomSwipe={true}
          stackSize={2}
          showSecondCard={false}
          swipeBackCard={true}
          backgroundColor={colors.background}
          stackSeparation={18}
          stackScale={0.07}
          cardHorizontalMargin={24}
          containerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          cardStyle={{ width: CARD_WIDTH, height: CARD_HEIGHT, alignSelf: 'center', justifyContent: 'center' }}
          stackAnimationFriction={100}
          stackAnimationTension={100}
          swipeAnimationDuration={600}
        />
      </View>
      {/* Yatay birleşik butonlar */}
      <View style={[styles.horizontalButtonRow, { backgroundColor: colors.buttonColor }]}>
        <TouchableOpacity style={[styles.horizontalButton, { borderRightWidth: 1, borderRightColor: '#e0e0e0' }]} onPress={() => handleSkip(15)}>
          <Iconify icon="material-symbols:repeat-rounded" size={20} color={colors.buttonText} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.buttonText }]}>{t('swipeDeck.minutes', "15 dk")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.horizontalButton, { borderRightWidth: 1, borderRightColor: '#e0e0e0' }]} onPress={() => handleSkip(60)}>
          <Iconify icon="mingcute:time-line" size={20} color={colors.buttonText} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.buttonText }]}>{t('swipeDeck.hours', "1 sa")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.horizontalButton, { borderRightWidth: 1, borderRightColor: '#e0e0e0' }]} onPress={() => handleSkip(24 * 60)}>
          <Iconify icon="solar:calendar-broken" size={20} color={colors.buttonText} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.buttonText }]}>{t('swipeDeck.days', "1 gün")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.horizontalButton} onPress={() => handleSkip(7 * 24 * 60)}>
          <Iconify icon="solar:star-broken" size={20} color={colors.buttonText} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.buttonText }]}>{t('swipeDeck.sevenDays', "7 gün")}</Text>
        </TouchableOpacity>
      </View>
      {/* Geri alma butonu */}
      <TouchableOpacity style={[styles.undoButton, undoDisabled && { opacity: 0.5 }]} onPress={handleUndo} disabled={undoDisabled}>
        <Iconify icon="lets-icons:refund-back" size={28} color={colors.orWhite} />
      </TouchableOpacity>
      {/* Auto play butonu */}
      <TouchableOpacity
        style={styles.autoPlayButton}
        onPress={() => setAutoPlay((prev) => !prev)}
      >
        {autoPlay ? (
          <Iconify icon="material-symbols:pause-rounded" size={32} color={colors.orWhite} />
        ) : (
          <Iconify icon="streamline:button-play-solid" size={20} color={colors.orWhite} />
        )}
      </TouchableOpacity>
      {/* Progress Bar (undoButton'un hemen üstünde) */}
      <View style={[styles.progressBarContainer, { backgroundColor: colors.progressBarSwipe }]}>
        <View style={[styles.progressBarFill, { width: totalCardCount > 0 ? `${((leftCount + initialLearnedCount + rightCount) / totalCardCount) * 100}%` : '0%', backgroundColor: colors.buttonColor }]} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 5,
    shadowRadius: 4,
  },
  imageContainer: {
    width: '100%',
    height: (CARD_HEIGHT * 1.85) / 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    borderRadius: 12,
  },
  counterRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: 16,
    paddingBottom: 100,
    height: 36,
  },
  counterBoxLeft: {
    position: 'absolute',
    left: -30,
    top: 16,
    minWidth: 80,
    paddingLeft: 30,
    paddingRight: 12,
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
    top: 16,
    minWidth: 80,
    paddingLeft: 12,
    paddingRight: 30,
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
  counterText: {
    ...typography.styles.button,
    color: '#fff',
  },
  horizontalButtonRow: {
    flexDirection: 'row',
    width: '93%',
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff8f0',
    boxSizing: 'border-box',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 105,
  },
  horizontalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: 'transparent',
    borderRightWidth: 0,
    borderColor: '#e0e0e0',
  },
  horizontalButtonText: {
    ...typography.styles.button,
  },
  undoButton: {
    position: 'absolute',
    left: 24,
    bottom: 24,
    width: 48,
    height: 48,

    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 30,
  },
  deckProgressBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 16,
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
    marginBottom: 8,
    position: 'absolute',
    bottom: 72,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 8,
    transition: 'width 0.3s',
  },
  autoPlayButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    borderRadius: 24,
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
    width: 300,
    height: 300,
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
    gap: 16,
    marginTop: 8,
  },
  statCard: {
    width: '45%',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statNumber: {
    ...typography.styles.h2,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    ...typography.styles.subtitle,
    fontSize: 14,
    fontWeight: '500',
  },
}); 