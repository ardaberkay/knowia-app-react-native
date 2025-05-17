import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, Dimensions, Pressable, Animated, Easing } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { getCardsForLearning, ensureUserCardProgress } from '../services/CardService';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

export default function SwipeDeckScreen({ route, navigation }) {
  const { deck } = route.params;
  const { colors } = useTheme();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userId, setUserId] = useState(null);
  const [flipped, setFlipped] = useState({});
  const animatedValues = useRef({});

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
      setCards(learningCards || []);
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
    if (direction === 'right') {
      // Öğrendim (artık tekrar gösterilmesin)
      await supabase
        .from('user_card_progress')
        .update({ status: 'learned' })
        .eq('user_id', userId)
        .eq('card_id', card.card_id);
    } else if (direction === 'left') {
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
    setCurrentIndex(currentIndex + 1);
  };

  const FlipCard = ({ card, cardIndex }) => {
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
      width: '100%',
      height: height * 0.75,
    };
    const backAnimatedStyle = {
      transform: [
        { rotateY: backInterpolate },
      ],
      backfaceVisibility: 'hidden',
      position: 'absolute',
      width: '100%',
      height: height * 0.75,
    };
    return (
      <Pressable onPress={() => handleFlip(cardIndex)} style={{ width: '100%', height: 60 }}>
        <View style={{ width: '100%', height: 60 }}>
          <Animated.View style={[styles.card, { backgroundColor: colors.cardBackground }, frontAnimatedStyle]}>
            <Text style={[typography.styles.h2, { color: colors.text, marginBottom: 16 }]}>{card.cards.question}</Text>
          </Animated.View>
          <Animated.View style={[styles.card, { backgroundColor: colors.cardBackground }, backAnimatedStyle]}>
            <Text style={[typography.styles.body, { color: colors.subtext, marginBottom: 8 }]}>{card.cards.answer}</Text>
            {card.cards.example && <Text style={{ color: colors.muted, marginBottom: 8 }}>{card.cards.example}</Text>}
            {card.cards.note && <Text style={{ color: colors.muted }}>{card.cards.note}</Text>}
          </Animated.View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }] }>
        <ActivityIndicator size="large" color={colors.buttonColor} />
      </SafeAreaView>
    );
  }

  if (cards.length === 0 || currentIndex >= cards.length) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }] }>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[typography.styles.h2, { color: colors.text, textAlign: 'center', marginTop: 40 }]}>Tüm kartları tamamladın!</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={{ color: colors.buttonText }}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }] }>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Swiper
          cards={cards}
          cardIndex={currentIndex}
          renderCard={(card, i) => <FlipCard card={card} cardIndex={i} key={card.card_id} />}
          onSwipedLeft={(i) => handleSwipe(i, 'left')}
          onSwipedRight={(i) => handleSwipe(i, 'right')}
          backgroundColor={colors.background}
          stackSize={2}
          disableTopSwipe
          disableBottomSwipe
          infinite={false}
          showSecondCard
        />
      </View>
      <View style={styles.skipRow}>
        <TouchableOpacity style={styles.skipButton} onPress={() => handleSkip(15)}>
          <Text style={{ color: colors.buttonText }}>15dk</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={() => handleSkip(60)}>
          <Text style={{ color: colors.buttonText }}>1sa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={() => handleSkip(24 * 60)}>
          <Text style={{ color: colors.buttonText }}>1g</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={() => handleSkip(7 * 24 * 60)}>
          <Text style={{ color: colors.buttonText }}>7g</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    width: width - 40,
    height: height * 0.75,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
    gap: 12,
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  backButton: {
    marginTop: 32,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
}); 