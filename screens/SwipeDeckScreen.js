import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, Dimensions, Pressable, Animated, Easing, Image } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { getCardsForLearning, ensureUserCardProgress } from '../services/CardService';
import { supabase } from '../lib/supabase';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [leftHighlight, setLeftHighlight] = useState(false);
  const [rightHighlight, setRightHighlight] = useState(false);
  const swiperRef = useRef(null);
  const [history, setHistory] = useState([]);

  // Sayaç kutuları için renkler
  const leftInactiveColor = '#f3a14c'; // Bir tık daha koyu turuncu
  const leftActiveColor = colors.buttonColor; // Tema turuncusu
  const rightInactiveColor = '#6faa72'; // Bir tık daha koyu yeşil
  const rightActiveColor = '#3e8e41'; // Bir tık daha koyu aktif renk

  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);
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
    if (swiperRef.current) {
      swiperRef.current.swipeLeft();
    }
  };

  const handleUndo = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const lastIndex = prev[prev.length - 1];
      setCurrentIndex(lastIndex);
      return prev.slice(0, -1);
    });
  };

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
      <Pressable
        onPress={() => handleFlip(cardIndex)}
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          alignSelf: 'center', // Ortala
        }}
      >
        <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
          <Animated.View style={[styles.card, { backgroundColor: colors.cardBackground, justifyContent: 'flex-start' }, frontAnimatedStyle]}>
            <LinearGradient
              colors={colors.deckGradient || ['#fff8f0', '#ffe0c3', '#f9b97a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
            />
            <View style={[styles.imageContainer, { backgroundColor: 'transparent' }]}>
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
          <Animated.View style={[styles.card, { backgroundColor: colors.cardBackground }, backAnimatedStyle]}>
            <LinearGradient
              colors={colors.deckGradient || ['#fff8f0', '#ffe0c3', '#f9b97a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
            />
            <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', paddingVertical: 18 }}>
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
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.buttonColor} />
      </SafeAreaView>
    );
  }

  if (cards.length === 0 || currentIndex >= cards.length) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[typography.styles.h2, { color: colors.text, textAlign: 'center', marginTop: 40 }]}>Tüm kartları tamamladın!</Text>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.buttonColor }]} onPress={() => navigation.goBack()}>
            <Text style={{ color: colors.buttonText }}>Geri Dön</Text>
          </TouchableOpacity>
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
          key={currentIndex}
          cards={cards}
          cardIndex={currentIndex}
          renderCard={(card, i) => <FlipCard card={card} cardIndex={i} currentIndex={currentIndex} key={card.card_id} />}
          onSwipedLeft={(i) => handleSwipe(i, 'left')}
          onSwipedRight={(i) => handleSwipe(i, 'right')}
          backgroundColor={colors.background}
          stackSize={1}
          disableTopSwipe
          disableBottomSwipe
          infinite={false}
          showSecondCard={true}
          stackSeparation={18}
          stackScale={0.07}
          cardHorizontalMargin={24}
          containerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          cardStyle={{ width: CARD_WIDTH, height: CARD_HEIGHT, alignSelf: 'center', justifyContent: 'center' }}
        />
      </View>
      {/* Yatay birleşik butonlar */}
      <View style={[styles.horizontalButtonRow, { backgroundColor: colors.buttonColor }]}>
        <TouchableOpacity style={[styles.horizontalButton, { borderRightWidth: 1, borderRightColor: '#e0e0e0' }]} onPress={() => handleSkip(15)}>
          <MaterialCommunityIcons name="repeat" size={20} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.text }]}>15 dk</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.horizontalButton, { borderRightWidth: 1, borderRightColor: '#e0e0e0' }]} onPress={() => handleSkip(60)}>
          <Ionicons name="time-outline" size={20} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.text }]}>1 sa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.horizontalButton, { borderRightWidth: 1, borderRightColor: '#e0e0e0' }]} onPress={() => handleSkip(24 * 60)}>
          <Ionicons name="calendar-outline" size={20} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.text }]}>1 gün</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.horizontalButton} onPress={() => handleSkip(7 * 24 * 60)}>
          <Ionicons name="star-outline" size={20} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.horizontalButtonText, { color: colors.text }]}>7 gün</Text>
        </TouchableOpacity>
      </View>
      {/* Geri alma butonu */}
      <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
        <MaterialCommunityIcons name="arrow-u-left-top" size={28} color={colors.text} />
      </TouchableOpacity>
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
    marginBottom: 93,
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
}); 