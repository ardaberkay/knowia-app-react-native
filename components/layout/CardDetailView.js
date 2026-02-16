import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, FlatList, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import Svg, { Path } from 'react-native-svg';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import MathText from '../ui/MathText';

export default function CardDetailView({ card, cards = [], onSelectCard, showCreatedAt = true }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const screenWidth = Dimensions.get('window').width;
  const flatListRef = useRef(null);
  const [flippedCards, setFlippedCards] = useState({});
  const flipAnimations = useRef({});
  const dotAnimations = useRef({});

  // Kategoriye göre renkleri al (Supabase sort_order kullanarak)
  const getCategoryColors = (sortOrder) => {
    if (colors.categoryColors && colors.categoryColors[sortOrder]) {
      return colors.categoryColors[sortOrder];
    }
    // Varsayılan renkler (Tarih kategorisi - sort_order: 4)
    return ['#6F8EAD', '#3F5E78'];
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

  const currentIndex = useMemo(() => {
    if (!cards || cards.length === 0 || !card) return 0;
    const idx = cards.findIndex(c => c?.id === card?.id);
    return idx >= 0 ? idx : 0;
  }, [cards, card]);

  // Dot indikatör için görüntülenecek kartları hesapla
  const getVisibleCards = useMemo(() => {
    if (!cards || cards.length === 0) return [];
    
    const totalCards = cards.length;
    const currentIdx = currentIndex;
    
    if (totalCards <= 3) {
      // 3 veya daha az kart varsa hepsini göster
      return cards.map((card, index) => ({ card, index }));
    }
    
    // Mevcut kartı ortada tutacak şekilde görüntülenecek kartları belirle
    let startIndex = currentIdx - 1;
    let endIndex = currentIdx + 1;
    
    // Başlangıçta sınır kontrolü
    if (startIndex < 0) {
      startIndex = 0;
      endIndex = 2;
    }
    
    // Sonda sınır kontrolü
    if (endIndex >= totalCards) {
      endIndex = totalCards - 1;
      startIndex = endIndex - 2;
    }
    
    return cards.slice(startIndex, endIndex + 1).map((card, relativeIndex) => ({
      card,
      index: startIndex + relativeIndex
    }));
  }, [cards, currentIndex]);

  // Dot animasyonlarını başlat
  useEffect(() => {
    getVisibleCards.forEach(({ card: dotCard, index: dotIndex }) => {
      const cardId = dotCard?.id || `dot-${dotIndex}`;
      
      if (!dotAnimations.current[cardId]) {
        dotAnimations.current[cardId] = {
          scale: new Animated.Value(dotIndex === currentIndex ? 1.5 : 1),
          opacity: new Animated.Value(dotIndex === currentIndex ? 1 : 0.4),
        };
      }

      // Animasyonu başlat
      Animated.parallel([
        Animated.spring(dotAnimations.current[cardId].scale, {
          toValue: dotIndex === currentIndex ? 1.5 : 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(dotAnimations.current[cardId].opacity, {
          toValue: dotIndex === currentIndex ? 1 : 0.4,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [currentIndex, getVisibleCards]);

  const flipCard = (cardId) => {
    if (!flipAnimations.current[cardId]) {
      flipAnimations.current[cardId] = new Animated.Value(0);
    }

    const toValue = flippedCards[cardId] ? 0 : 1;
    
    Animated.timing(flipAnimations.current[cardId], {
      toValue,
      duration: 500,
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
      contentContainerStyle={{ paddingBottom: verticalScale(8), flexGrow: 1 }} 
      showsVerticalScrollIndicator={false}
    >
      {/* Deck Slider */}
      <View style={{ 
        width: '100%', 
        position: 'relative',
        paddingVertical: verticalScale(20),
      }}>
        {/* Kıvrımlı arka plan */}
        <View style={styles.curvedBackgroundContainer}>
          <Svg
            height="100%"
            width="100%"
            style={StyleSheet.absoluteFillObject}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <Path
              d="M0,0 L100,0 L100,70 Q75,90 50,70 Q25,50 0,70 Z"
              fill={colors.cardBackground}
            />
          </Svg>
        </View>
          {/* Sol Ok Butonu */}
          {currentIndex > 0 && (
            <TouchableOpacity
              style={[styles.navButton, styles.leftNavButton, { backgroundColor: colors.buttonColor, borderColor: colors.cardBorder }]}
              onPress={() => {
                const prevIndex = currentIndex - 1;
                if (prevIndex >= 0 && flatListRef.current) {
                  flatListRef.current.scrollToIndex({ index: prevIndex, animated: true });
                  if (onSelectCard) onSelectCard(cards[prevIndex]);
                }
              }}
            >
              <Iconify icon="material-symbols:arrow-back-ios-new-rounded" size={moderateScale(22)} color={colors.cardQuestionText} />
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
              
              // Kartın destesinden kategori bilgisini al
              const categorySortOrder = item?.deck?.categories?.sort_order;
              const gradientColors = getCategoryColors(categorySortOrder);
              const categoryIcon = getCategoryIcon(categorySortOrder);

              return (
                <View style={{ width: screenWidth, paddingHorizontal: scale(18), marginVertical: verticalScale(27), justifyContent: 'center', alignItems: 'center' }}>
                  <Animated.View
                    style={[
                      styles.sliderItem,
                      {
                        shadowOpacity: 0,
                        elevation: 0,
                        transform: [{ rotateY: frontInterpolate }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 1 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sliderItemGradient}
                    >
                      {/* Background Category Icon */}
                      <View style={styles.backgroundCategoryIcon}>
                        <Iconify
                          icon={categoryIcon}
                          size={scale(200)}
                          color="rgba(0, 0, 0, 0.1)"
                          style={styles.categoryIconStyle}
                        />
                      </View>
                      
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => flipCard(cardId)}
                        style={styles.cardTouchable}
                      >
                        {/* Soru İkonu - Ön Yüz */}
                        <Animated.View 
                          style={[
                            styles.quarterCircleContainer,
                            {
                              opacity: flipAnimations.current[cardId]?.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [1, 0, 0],
                                extrapolate: 'clamp',
                              }) || 1,
                            }
                          ]}
                        >
                          <View style={[styles.quarterCircle, { backgroundColor: colors.buttonColor }]}>
                            <Iconify icon="uil:comment-alt-question" size={moderateScale(26)} color="rgba(255, 255, 255, 0.9)" />
                          </View>
                        </Animated.View>

                        {/* Flip İkonu - Sağ Üst Köşe */}
                        <Animated.View 
                          style={[
                            styles.flipIconContainer,
                            {
                              opacity: flipAnimations.current[cardId]?.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [1, 0, 0],
                                extrapolate: 'clamp',
                              }) || 1,
                            }
                          ]}
                        >
                          <Iconify icon="fluent:card-ui-portrait-flip-24-regular" size={24} color="rgba(255, 255, 255, 0.9)" />
                        </Animated.View>

                        {/* Cevap İkonu - Arka Yüz */}
                        <Animated.View 
                          style={[
                            styles.quarterCircleContainer,
                            {
                              opacity: flipAnimations.current[cardId]?.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [0, 0, 1],
                                extrapolate: 'clamp',
                              }) || 0,
                            }
                          ]}
                        >
                          <View style={[styles.quarterCircle, { backgroundColor: colors.buttonColor, transform: [{ rotateY: '180deg' }] }]}>
                            <Iconify icon="uil:comment-alt-check" size={moderateScale(26)} color="rgba(255, 255, 255, 0.9)" />
                          </View>
                        </Animated.View>

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
                            <MathText
                              value={item?.question || item?.name || item?.title || t('cardDetail.unnamed', 'İsimsiz Kart')}
                              style={[typography.styles.body, styles.sliderItemTitle, { color: colors.headText }]}
                              numberOfLines={3}
                            />
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
                            <MathText
                              value={item?.answer || t('cardDetail.noAnswer', 'Cevap yok')}
                              style={[
                                typography.styles.body,
                                styles.sliderItemTitle,
                                { color: colors.headText, transform: [{ scaleX: -1 }] },
                              ]}
                              numberOfLines={4}
                            />
                          </View>
                        </Animated.View>
                      </TouchableOpacity>
                    </LinearGradient>
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
              style={[styles.navButton, styles.rightNavButton, { backgroundColor: colors.buttonColor, borderColor: colors.cardBorder }]}
              onPress={() => {
                const nextIndex = currentIndex + 1;
                if (nextIndex < cards.length && flatListRef.current) {
                  flatListRef.current.scrollToIndex({ index: nextIndex, animated: true });
                  if (onSelectCard) onSelectCard(cards[nextIndex]);
                }
              }}
            >
              <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={moderateScale(22)} color={colors.cardQuestionText} />
            </TouchableOpacity>
          )}

          {/* Dot Indikatör */}
          {cards && cards.length > 1 && (
            <View style={styles.dotContainer}>
              {getVisibleCards.map(({ card: dotCard, index: dotIndex }) => {
                const cardId = dotCard?.id || `dot-${dotIndex}`;
                const animation = dotAnimations.current[cardId];
                
                return (
                  <Animated.View
                    key={cardId}
                    style={[
                      {
                        transform: [{ scale: animation?.scale || 1 }],
                        opacity: animation?.opacity || 0.4,
                      }
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        dotIndex === currentIndex ? styles.activeDot : styles.inactiveDot,
                        {
                          backgroundColor: dotIndex === currentIndex 
                            ? colors.buttonColor 
                            : colors.border,
                        }
                      ]}
                      onPress={() => {
                        if (flatListRef.current) {
                          flatListRef.current.scrollToIndex({ index: dotIndex, animated: true });
                          if (onSelectCard) onSelectCard(cards[dotIndex]);
                        }
                      }}
                    />
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>

      {/* Kart Detayları - Ayrı Kartlar */}
      <View style={styles.cardDetailsContainer}>
        
        {/* Görsel Kartı */}
        {card?.image ? (
          <View style={[styles.detailCard, {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={[styles.cardHeader, { borderBottomColor: colors.cardBorder }]}>
              <View style={styles.labelRow}>
                <Iconify icon="mage:image-fill" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
                  {t("cardDetail.image", "Kart Görseli")}
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
                <Image source={{ uri: card.image }} style={styles.cardImage} />
            </View>
          </View>
        ) : null}

        {/* Soru Kartı */}
        <View style={[styles.detailCard, {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
        }]}>
          <View style={[styles.cardHeader, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.labelRow}>
              <Iconify icon="uil:comment-alt-question" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
                {t("cardDetail.question", "Soru")}
              </Text>
            </View>
          </View>
          <View style={styles.cardContent}>
            <MathText
              value={card?.question}
              style={[typography.styles.body, { fontSize: 16, color: colors.cardAnswerText, marginLeft: 24 }]}
            />
          </View>
        </View>

        {/* Cevap Kartı */}
        {card?.answer ? (
          <View style={[styles.detailCard, {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={[styles.cardHeader, { borderBottomColor: colors.cardBorder }]}>
              <View style={styles.labelRow}>
                <Iconify icon="uil:comment-alt-check" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
                  {t("cardDetail.answer", "Cevap")}
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <MathText
                value={card.answer}
                style={[typography.styles.body, { fontSize: moderateScale(16), color: colors.cardAnswerText, marginLeft: scale(24) }]}
              />
            </View>
          </View>
        ) : null}

        {/* Örnek Kartı */}
        {card?.example ? (
          <View style={[styles.detailCard, {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={[styles.cardHeader, { borderBottomColor: colors.cardBorder }]}>
              <View style={styles.labelRow}>
                <Iconify icon="lucide:lightbulb" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
                  {t("cardDetail.example", "Örnek")}
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <MathText
                value={card.example}
                style={[typography.styles.body, { fontSize: moderateScale(16), color: colors.cardAnswerText, marginLeft: scale(24) }]}
              />
            </View>
          </View>
        ) : null}

        {/* Not Kartı */}
        {card?.note ? (
          <View style={[styles.detailCard, {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={[styles.cardHeader, { borderBottomColor: colors.cardBorder }]}>
              <View style={styles.labelRow}>
                <Iconify icon="material-symbols-light:stylus-note" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
                  {t("cardDetail.note", "Not")}
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <MathText
                value={card.note}
                style={[typography.styles.body, { fontSize: moderateScale(16), color: colors.cardAnswerText, marginLeft: scale(24) }]}
              />
            </View>
          </View>
        ) : null}
        
      </View>

      {/* Oluşturulma tarihi */}
      {showCreatedAt && card?.created_at ? (
        <View style={{ paddingHorizontal: scale(18), marginTop: 'auto', marginBottom: verticalScale(12) }}>
          <MathText
            value={`${t("cardDetail.createdAt", "Oluşturulma Tarihi")} ${new Date(card.created_at).toLocaleString('tr-TR')}`}
            style={[typography.styles.caption, { color: colors.muted, textAlign: 'center', fontSize: moderateScale(14) }]}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sliderItem: {
    height: verticalScale(315),
    width: scale(240),
    borderRadius: moderateScale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderItemGradient: {
    height: verticalScale(315),
    width: scale(240),
    borderRadius: moderateScale(20),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  sliderItemTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionContainer: {
    width: '100%',
    paddingVertical: verticalScale(16),
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(2),
  },
  labelIcon: {
    marginRight: scale(8),
  },
  label: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardImage: {
    width: '100%',
    height: verticalScale(160),
    borderRadius: moderateScale(32),
    resizeMode: 'contain',
    backgroundColor: 'transparent',
    alignSelf: 'center',
    borderWidth: moderateScale(1),
    borderColor: '#666666',
  },
  cardAnswer: {
    fontSize: moderateScale(15),
    fontWeight: '400',
    letterSpacing: 0.2,
    borderRadius: moderateScale(8),
    padding: moderateScale(2),
    paddingTop: 0,
    marginTop: 0,
  },
  scrollableContent: {
    flex: 1,
  },
  cardFace: {
    position: 'absolute',
    width: '90%',
    height: '90%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: moderateScale(20),
    backgroundColor: 'transparent',
  },
  quarterCircleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    width: scale(40),
    height: scale(40),
    overflow: 'hidden',
  },
  flipIconContainer: {
    position: 'absolute',
    top: verticalScale(7),
    right: 0,
    zIndex: 1,
    width: scale(32),
    height: scale(32),
    overflow: 'hidden',
  },
  flipIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#F98A21',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  quarterCircle: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#F98A21',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  cardTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDetailsContainer: {
    width: '100%',
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(8),
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(30),
    padding: scale(16),
    marginVertical: verticalScale(8),
    shadowColor: '#000',
    shadowOffset: { width: scale(2), height: verticalScale(4) },
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(8),
    elevation: 6,
    borderWidth: moderateScale(1),
    minHeight: verticalScale(120),
    justifyContent: 'space-between',
  },
  cardHeader: {
    borderBottomWidth: moderateScale(1),
    borderBottomColor: '#f0f0f0',
    paddingBottom: verticalScale(8),
    marginBottom: verticalScale(8),
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  divider: {
    width: '100%',
    height: verticalScale(2),
    marginVertical: verticalScale(6),
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(20),
    borderWidth: moderateScale(1),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(4),
    elevation: 3,
  },
  leftNavButton: {
    left: scale(15),
  },
  rightNavButton: {
    right: scale(15),

  },
  backgroundCategoryIcon: {
    position: 'absolute',
    left: scale(-120), // İkonun yarısının taşması için
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0, // En altta kalması için
    overflow: 'hidden', // Taşan kısmı gizle
  },
  categoryIconStyle: {
    // Subtle background effect için
    opacity: 0.8,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',

    paddingHorizontal: scale(20),
  },
  activeDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: moderateScale(8),
    marginHorizontal: scale(6),
  },
  inactiveDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(5),
    marginHorizontal: scale(4),
  },
  curvedBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
});
