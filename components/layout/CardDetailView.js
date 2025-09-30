import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, FlatList, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';

export default function CardDetailView({ card, cards = [], onSelectCard, showCreatedAt = true }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const screenWidth = Dimensions.get('window').width;
  const flatListRef = useRef(null);
  const [flippedCards, setFlippedCards] = useState({});
  const flipAnimations = useRef({});

  const currentIndex = useMemo(() => {
    if (!cards || cards.length === 0 || !card) return 0;
    const idx = cards.findIndex(c => c?.id === card?.id);
    return idx >= 0 ? idx : 0;
  }, [cards, card]);

  const flipCard = (cardId) => {
    if (!flipAnimations.current[cardId]) {
      flipAnimations.current[cardId] = new Animated.Value(0);
    }

    const toValue = flippedCards[cardId] ? 0 : 1;
    
    Animated.timing(flipAnimations.current[cardId], {
      toValue,
      duration: 600,
      useNativeDriver: true,
    }).start();

    setFlippedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const getFlipInterpolation = (cardId) => {
    if (!flipAnimations.current[cardId]) {
      flipAnimations.current[cardId] = new Animated.Value(0);
    }

    const frontInterpolate = flipAnimations.current[cardId].interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });

    const backInterpolate = flipAnimations.current[cardId].interpolate({
      inputRange: [0, 1],
      outputRange: ['180deg', '360deg'],
    });

    return { frontInterpolate, backInterpolate };
  };

  if (!card) return null;

  return (
    <ScrollView 
      style={{ flex: 1 }} 
      contentContainerStyle={{ paddingBottom: 8, flexGrow: 1 }} 
      showsVerticalScrollIndicator={false}
    >
      {/* Deck Slider */}
      {Array.isArray(cards) && cards.length > 0 ? (
        <View style={{ width: '100%', position: 'relative' }}>
          {/* Sol Ok Butonu */}
          {currentIndex > 0 && (
            <TouchableOpacity
              style={[styles.navButton, styles.leftNavButton, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
              onPress={() => {
                const prevIndex = currentIndex - 1;
                if (prevIndex >= 0 && flatListRef.current) {
                  flatListRef.current.scrollToIndex({ index: prevIndex, animated: true });
                  if (onSelectCard) onSelectCard(cards[prevIndex]);
                }
              }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.cardQuestionText} />
            </TouchableOpacity>
          )}

          <FlatList
            ref={flatListRef}
            data={cards}
            keyExtractor={(item, index) => (item?.id ? String(item.id) : `card-${index}`)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={currentIndex}
            getItemLayout={(data, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
            renderItem={({ item }) => {
              const cardId = item?.id || `card-${item?.name || 'unknown'}`;
              const { frontInterpolate, backInterpolate } = getFlipInterpolation(cardId);
              const isFlipped = flippedCards[cardId];

              return (
                <View style={{ width: screenWidth, paddingHorizontal: 18, marginVertical: 27, justifyContent: 'center', alignItems: 'center' }}>
                  <Animated.View
                    style={[
                      styles.sliderItem,
                      {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.cardBorder,
                        shadowOpacity: 0,
                        elevation: 0,
                        transform: [{ rotateY: frontInterpolate }],
                      },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => flipCard(cardId)}
                      style={styles.cardTouchable}
                    >
                      {/* Ön yüz */}
                      <Animated.View
                        style={[
                          styles.cardFace,
                          {
                            transform: [{ rotateY: frontInterpolate }],
                            backfaceVisibility: 'hidden',
                          },
                        ]}
                      >
                        <View style={styles.cardContent}>
                          <Text style={[typography.styles.body, styles.sliderItemTitle, { color: colors.cardQuestionText }]} numberOfLines={3}>
                            {item?.question || item?.name || item?.title || t('cardDetail.unnamed', 'İsimsiz Kart')}
                          </Text>
                        </View>
                      </Animated.View>

                      {/* Arka yüz */}
                      <Animated.View
                        style={[
                          styles.cardFace,
                          {
                            transform: [{ rotateY: backInterpolate }],
                            backfaceVisibility: 'hidden',
                          },
                        ]}
                      >
                        <View style={styles.cardContent}>
                          <Text style={[typography.styles.body, styles.sliderItemTitle, { color: colors.cardAnswerText, transform: [{ scaleX: -1 }] }]} numberOfLines={4}>
                            {item?.answer || t('cardDetail.noAnswer', 'Cevap yok')}
                          </Text>
                        </View>
                      </Animated.View>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              );
            }}
            onMomentumScrollEnd={evt => {
              const offsetX = evt?.nativeEvent?.contentOffset?.x || 0;
              const index = Math.round(offsetX / screenWidth);
              const next = cards[index];
              if (next && onSelectCard) onSelectCard(next);
            }}
          />

          {/* Sağ Ok Butonu */}
          {currentIndex < cards.length - 1 && (
            <TouchableOpacity
              style={[styles.navButton, styles.rightNavButton, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
              onPress={() => {
                const nextIndex = currentIndex + 1;
                if (nextIndex < cards.length && flatListRef.current) {
                  flatListRef.current.scrollToIndex({ index: nextIndex, animated: true });
                  if (onSelectCard) onSelectCard(cards[nextIndex]);
                }
              }}
            >
              <Ionicons name="chevron-forward" size={24} color={colors.cardQuestionText} />
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Kart Detayları Kapsayıcı */}
      <View style={[styles.cardDetailContainer, {
        backgroundColor: colors.cardBackground,
        borderColor: colors.cardBorder,
        shadowColor: colors.shadowColor,
        shadowOffset: colors.shadowOffset,
        shadowOpacity: colors.shadowOpacity,
        shadowRadius: colors.shadowRadius,
        elevation: colors.elevation,
      }]}>
        
        {/* Görsel */}
        {card?.image ? (
          <>
            <View style={[{width: '100%', maxHeight: 220, marginBottom: 16}, {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
            }]}>
              <View style={[styles.labelRow, { marginBottom: 16 }]}>
                <Iconify icon="mage:image-fill" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
                  {t("cardDetail.image", "Kart Görseli")}
                </Text>
              </View>
              <View style={{ alignSelf: 'center'}}>
                <Image source={{ uri: card.image }} style={styles.cardImage} />
              </View>
            </View>
            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          </>
        ) : null}

        {/* Soru */}
        <View style={styles.sectionContainer}>
          <View style={styles.labelRow}>
            <Iconify icon="uil:comment-alt-question" size={24} color="#F98A21" style={styles.labelIcon} />
            <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
              {t("cardDetail.question", "Soru")}
            </Text>
          </View>
          <Text style={[typography.styles.body, { fontSize: 16, color: colors.cardAnswerText, marginTop: 8, marginLeft: 24 }]}>
            {card?.question}
          </Text>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

        {/* Cevap */}
        {card?.answer ? (
          <>
            <View style={styles.sectionContainer}>
              <View style={styles.labelRow}>
                <Iconify icon="uil:comment-alt-check" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
                  {t("cardDetail.answer", "Cevap")}
                </Text>
              </View>
              <Text style={[typography.styles.body, { fontSize: 16, color: colors.cardAnswerText, marginTop: 8, marginLeft: 24  }]}>
                {card.answer}
              </Text>
            </View>
            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          </>
        ) : null}

        {/* Örnek */}
        {card?.example ? (
          <>
            <View style={styles.sectionContainer}>
              <View style={styles.labelRow}>
                <Iconify icon="lucide:lightbulb" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
                  {t("cardDetail.example", "Örnek")}
                </Text>
              </View>
              <Text style={[typography.styles.body, { fontSize: 16, color: colors.cardAnswerText, marginTop: 8, marginLeft: 24  }]}>
                {card.example}
              </Text>
            </View>
            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          </>
        ) : null}

        {/* Not */}
        {card?.note ? (
          <View style={styles.sectionContainer}>
            <View style={styles.labelRow}>
              <Iconify icon="material-symbols-light:stylus-note" size={24} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
                {t("cardDetail.note", "Not")}
              </Text>
            </View>
            <Text style={[typography.styles.body, { fontSize: 16, color: colors.cardAnswerText, marginTop: 8, marginLeft: 24  }]}>
              {card.note}
            </Text>
          </View>
        ) : null}
        
      </View>

      {/* Oluşturulma tarihi */}
      {showCreatedAt && card?.created_at ? (
        <View style={{ paddingHorizontal: 18, marginTop: 'auto', marginBottom: 12 }}>
          <Text style={[typography.styles.caption, { color: colors.muted, textAlign: 'center', fontSize: 14 }]}>
            {t("cardDetail.createdAt", "Oluşturulma Tarihi")} {new Date(card.created_at).toLocaleString('tr-TR')}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sliderItem: {
    height: 315,
    width: 240,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderItemTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionContainer: {
    width: '100%',
    paddingVertical: 16,
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
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardImage: {
    width: 120,
    height: 160,
    borderRadius: 18,
    resizeMode: 'contain',
    backgroundColor: '#f2f2f2',
    alignSelf: 'center',
  },
  cardAnswer: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.2,
    borderRadius: 8,
    padding: 2,
    paddingTop: 0,
    marginTop: 0,
  },
  scrollableContent: {
    flex: 1,
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  cardContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    width: '100%',
    height: '100%',
  },
  cardTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDetailContainer: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 20,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,

    paddingVertical: 14,
    marginTop: 12,
    marginBottom: 12,
    alignSelf: 'center',
  },
  divider: {
    width: '100%',
    height: 2,
    marginVertical: 6,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leftNavButton: {
    left: 15,
    transform: [{ translateY: -20 }],
  },
  rightNavButton: {
    right: 15,
    transform: [{ translateY: -20 }],
  },
});
