import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, Dimensions, Pressable, Animated, Easing, Image } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { getCardsForLearning, ensureUserCardProgress } from '../services/CardService';
import { supabase } from '../lib/supabase';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, Entypo } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import logoasil from '../assets/logoasil.png';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

// Kart boyutlandırma sabitleri
const CARD_WIDTH = width * 0.88; // %92 genişlik
const CARD_ASPECT_RATIO = 1.45; // Daha da uzun oran
const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT_RATIO;

export default function SwipeDeckScreen({ route, navigation }) {
  const { deck } = route.params;
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
  const [hasLearningCard, setHasLearningCard] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayTimeout = useRef(null);
  const { t } = useTranslation();

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
      // Eksik user_card_progress kayıtlarını oluştur
      await ensureUserCardProgress(deck.id, user.id);
      // Kartları user_card_progress üzerinden çek (status: 'new' veya 'learning')
      const { data: learningCards, error } = await supabase
        .from('user_card_progress')
        .select('card_id, status, next_review, cards(question, image, answer, example, note)')
        .eq('user_id', user.id)
        .in('status', ['new', 'learning'])
        .lte('next_review', new Date().toISOString())
        .eq('cards.deck_id', deck.id);
      console.log('learningCards:', learningCards);
      console.log('supabase error:', error);
      setCards((learningCards || []).filter(card => card.cards));
      setFlipped({});
      // Toplam kart sayısı (bu destedeki tüm kartlar)
      const { data: allCards, error: allCardsError } = await supabase
        .from('cards')
        .select('id')
        .eq('deck_id', deck.id);
      setTotalCardCount(allCards ? allCards.length : 0);
      // Kalan kart sayısı (status learned olmayanlar)
      const { data: notLearned, error: notLearnedError } = await supabase
        .from('user_card_progress')
        .select('card_id')
        .eq('user_id', user.id)
        .eq('cards.deck_id', deck.id)
        .neq('status', 'learned')
        .select('card_id', { count: 'exact' });
      setRemainingCardCount(notLearned ? notLearned.length : 0);
      // Gelecekte gösterilecek learning kart var mı?
      const { data: learningCardsExist, error: learningCardsExistError } = await supabase
        .from('user_card_progress')
        .select('card_id, status, cards(deck_id)')
        .eq('user_id', user.id)
        .eq('status', 'learning')
        .eq('cards.deck_id', deck.id);
      setHasLearningCard(learningCardsExist && learningCardsExist.length > 0);
      // Başlangıçta learned olan kartların sayısını al
      const { data: learnedCards, error: learnedCardsError } = await supabase
        .from('user_card_progress')
        .select('card_id, cards(deck_id)')
        .eq('user_id', user.id)
        .eq('status', 'learned')
        .eq('cards.deck_id', deck.id);
      const filteredLearnedCards = (learnedCards || []).filter(
        c => c.cards && c.cards.deck_id === deck.id
      );
      setInitialLearnedCount(filteredLearnedCards.length);
      setLoading(false);
    };
    fetchCards();
  }, [deck.id]);

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

  const handleOneDaySkip = async () => {
    if (!cards[currentIndex]) return;
    const card = cards[currentIndex];
    if (!userId) return;
    await supabase
      .from('user_card_progress')
      .update({ status: 'learning', next_review: new Date(Date.now() + 24 * 60 * 60 * 1000) })
      .eq('user_id', userId)
      .eq('card_id', card.card_id);
    setCurrentIndex(currentIndex + 1);
  };

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

  // Auto play fonksiyonu
  useEffect(() => {
    if (!autoPlay) return;
    if (currentIndex >= cards.length) {
      setAutoPlay(false);
      return;
    }
    // Flip -> bekle -> swipe left (flip sadece bir defa)
    handleFlip(currentIndex);
    autoPlayTimeout.current = setTimeout(() => {
      if (swiperRef.current) {
        swiperRef.current.swipeLeft();
      }
    }, 1200); // kartı gösterme süresi
    return () => {
      if (autoPlayTimeout.current) clearTimeout(autoPlayTimeout.current);
    };
  }, [autoPlay, currentIndex, cards.length]);

  // Auto play durdurucu (kartlar bittiğinde veya ekran değişirse)
  useEffect(() => {
    return () => {
      if (autoPlayTimeout.current) clearTimeout(autoPlayTimeout.current);
    };
  }, []);

  const FlipCard = ({ card, cardIndex, currentIndex }) => {
    // Eğer kart yoksa veya stack'teki alttaki kartsa, placeholder göster
    if (!card || !card.cards || cardIndex > currentIndex) {
      return (
        <View style={[styles.card, { opacity: 0.7 }]}> 
          <LinearGradient
            colors={colors.deckGradient || ['#fff8f0', '#ffe0c3', '#f9b97a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
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
          <Animated.View style={[styles.card, { backgroundColor: colors.cardBackground, justifyContent: 'flex-start' }, frontAnimatedStyle]}>
            <LinearGradient
              colors={colors.deckGradient || ['#fff8f0', '#ffe0c3', '#f9b97a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
            />
            <View style={[styles.imageContainer, { backgroundColor: 'transparent', marginTop: 32 }]}> 
              {card.cards.image && (
                <Image
                  source={{ uri: card.cards.image }}
                  style={styles.cardImage}
                />
              )}
            </View>
            {card.cards.image && (
              <View style={[{ width: 72, height: 2, backgroundColor: colors.orWhite, borderRadius: 2, alignSelf: 'center', marginBottom: 12 }]} />
            )}
            <Text style={[typography.styles.h2, { color: colors.text, marginBottom: 16 }]}>{card.cards.question}</Text>
          </Animated.View>
          {/* Arka yüz */}
          <Animated.View style={[styles.card, { backgroundColor: colors.cardBackground }, backAnimatedStyle]}>
            <LinearGradient
              colors={colors.deckGradient || ['#fff8f0', '#ffe0c3', '#f9b97a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
            />
            <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', paddingVertical: 18, marginTop: 32 }}>
              <Text style={[typography.styles.h2, { color: colors.text, marginBottom: 14 }]}>{card.cards.answer}</Text>
              {(card.cards.example || card.cards.note) && (
                <View style={[{ width: 72, height: 2, backgroundColor: colors.orWhite, borderRadius: 2, alignSelf: 'center', marginBottom: 14 }]} />
              )}
              {card.cards.example && <Text style={[{ color: colors.subtext, marginBottom: 14 }, typography.styles.subtitle]}>{card.cards.example}</Text>}
              {card.cards.note && (
                <View style={[{ width: 72, height: 2, backgroundColor: colors.orWhite, borderRadius: 2, alignSelf: 'center', marginBottom: 14 }]} />
              )}
              {card.cards.note && <Text style={[typography.styles.body, { color: colors.subtext }]}>{card.cards.note}</Text>}
            </View>
          </Animated.View>
        </Pressable>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.buttonColor} />
          <Text style={[styles.loadingText, { color: colors.text }]}>{t('swipeDeck.loading', "Kartlar Yükleniyor")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (cards.length === 0 || currentIndex >= cards.length) {
    const progress = initialLearnedCount + rightCount;
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ width: '100%', alignItems: 'center', marginTop: 110}}>
          <Image source={logoasil} style={{ width: 260, height: 260, resizeMode: 'cover' }} />
          <Text style={[typography.styles.h2, { color: colors.text, textAlign: 'center', marginTop: 16 , fontSize: 22}]}> 
            {progress === totalCardCount ? t('swipeDeck.bravo', "Bravo! Tüm Kartları Tamamladın") : t('swipeDeck.learnTime', "Kalan Kartları Öğrenmeye Vakit Var")}
          </Text>
          <View style={{ width: 72, height: 1, backgroundColor: colors.orWhite, borderRadius: 2, alignSelf: 'center', marginTop: 16,marginBottom: 16 }} />
          <View style={styles.deckProgressBox}>
          <Text style={[styles.deckProgressText, typography.styles.subtitle, {color: colors.text}]}>{initialLearnedCount + rightCount}/{totalCardCount}</Text>
        </View>
          {/* Progress Bar (tamamlandı ekranında) */}
          <View style={[styles.progressBarContainer, { backgroundColor: colors.inProgressBar, position: 'relative', marginTop: 90}]}> 
            <View style={[styles.progressBarFill, { width: totalCardCount > 0 ? `${((initialLearnedCount + rightCount) / totalCardCount) * 100}%` : '0%', backgroundColor: colors.buttonColor }]} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sayaçlar */}
      <View style={styles.counterRow}>
        <View style={[styles.counterBox, { backgroundColor: leftHighlight ? leftActiveColor : leftInactiveColor }]}>
          {leftHighlight ? (
            <Ionicons name="time" size={18} color="#fff" />
          ) : (
            <Text style={styles.counterText}>{leftCount}</Text>
          )}
        </View>
        <View style={styles.deckProgressBox}>
          <Text style={[styles.deckProgressText, {color: colors.text}]}>{leftCount + initialLearnedCount + rightCount}/{totalCardCount}</Text>
        </View>
        <View style={[styles.counterBox, { backgroundColor: rightHighlight ? rightActiveColor : rightInactiveColor }]}>
          {rightHighlight ? (
            <MaterialCommunityIcons name="check-bold" size={18} color="#fff" />
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
          renderCard={(card, i) => <FlipCard card={card} cardIndex={i} currentIndex={currentIndex} key={card.card_id} />}
          onSwipedLeft={(i) => { handleSwipe(i, 'left'); setCurrentIndex(i + 1); }}
          onSwipedRight={(i) => { handleSwipe(i, 'right'); setCurrentIndex(i + 1); }}
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
          <MaterialCommunityIcons name="repeat" size={20} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.text }]}>{t('swipeDeck.minutes', "15 dk")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.horizontalButton, { borderRightWidth: 1, borderRightColor: '#e0e0e0' }]} onPress={() => handleSkip(60)}>
          <Ionicons name="time-outline" size={20} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.text }]}>{t('swipeDeck.hours', "1 sa")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.horizontalButton, { borderRightWidth: 1, borderRightColor: '#e0e0e0' }]} onPress={() => handleSkip(24 * 60)}>
          <Ionicons name="calendar-outline" size={20} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.text }]}>{t('swipeDeck.days', "1 gün")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.horizontalButton} onPress={() => handleSkip(7 * 24 * 60)}>
          <Ionicons name="star-outline" size={20} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.text }]}>{t('swipeDeck.sevenDays', "7 gün")}</Text>
        </TouchableOpacity>
      </View>
      {/* Geri alma butonu */}
      <TouchableOpacity style={[styles.undoButton, undoDisabled && { opacity: 0.5 }]} onPress={handleUndo} disabled={undoDisabled}>
        <MaterialCommunityIcons name="arrow-u-left-top" size={28} color={colors.text} />
      </TouchableOpacity>
      {/* Auto play butonu */}
      <TouchableOpacity
        style={styles.autoPlayButton}
        onPress={() => setAutoPlay((prev) => !prev)}
      >
        {autoPlay ? (
          <Ionicons name="pause" size={32} color={colors.text} />
        ) : (
          <Entypo name="controller-play" size={32} color={colors.text} />
        )}
      </TouchableOpacity>
      {/* Progress Bar (undoButton'un hemen üstünde) */}
      <View style={[styles.progressBarContainer, { backgroundColor: colors.buttonText }]}>
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
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 5,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#e5e5e5',
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
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    gap: 12,
  },
  skipButton: {
    flex: 1,
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  backButton: {
    marginTop: 32,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  counterRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 100,
  },
  counterBox: {
    backgroundColor: '#fff',
    minWidth: 80,
    paddingHorizontal: 12,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  counterText: {
    fontWeight: 'bold',
    fontSize: 18,
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
    fontWeight: 'bold',
    fontSize: 16,
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
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  deckProgressText: {
    fontWeight: 'bold',
    fontSize: 18,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 