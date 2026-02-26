import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Image, ScrollView, PixelRatio } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { typography } from '../../theme/typography';
import MathText from '../ui/MathText';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

function SwipeFlipCardImpl({
  card,
  cardId,
  isPlaceholder,
  cardWidth,
  cardHeight,
  gradientColors,
  cardBackground,
  textColor,
  animatedValue,
  onFlip,
  swipeX,
}) {
  const { t } = useTranslation();

  const rightBorderOpacity = useMemo(() => {
    if (!swipeX) return 0;
    return swipeX.interpolate({
      inputRange: [0, 15, 100],
      outputRange: [0, 0, 1],
      extrapolate: 'clamp',
    });
  }, [swipeX]);

  const leftBorderOpacity = useMemo(() => {
    if (!swipeX) return 0;
    return swipeX.interpolate({
      inputRange: [-100, -15, 0],
      outputRange: [1, 0, 0],
      extrapolate: 'clamp',
    });
  }, [swipeX]);

  const frontInterpolate = useMemo(() => {
    if (!animatedValue) return null;
    return animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });
  }, [animatedValue]);

  const backInterpolate = useMemo(() => {
    if (!animatedValue) return null;
    return animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['180deg', '360deg'],
    });
  }, [animatedValue]);

  const frontOpacity = useMemo(() => {
    if (!animatedValue) return 1;
    return animatedValue.interpolate({
      inputRange: [0, 0.5, 0.51, 1],
      outputRange: [1, 1, 0, 0],
    });
  }, [animatedValue]);

  const backOpacity = useMemo(() => {
    if (!animatedValue) return 0;
    return animatedValue.interpolate({
      inputRange: [0, 0.49, 0.5, 1],
      outputRange: [0, 0, 1, 1],
    });
  }, [animatedValue]);

  const frontZIndex = useMemo(() => {
    if (!animatedValue) return 10;
    return animatedValue.interpolate({
      inputRange: [0, 0.5, 0.51, 1],
      outputRange: [10, 10, 0, 0],
    });
  }, [animatedValue]);

  const backZIndex = useMemo(() => {
    if (!animatedValue) return 0;
    return animatedValue.interpolate({
      inputRange: [0, 0.49, 0.5, 1],
      outputRange: [0, 0, 10, 10],
    });
  }, [animatedValue]);

  const frontAnimatedStyle = useMemo(() => {
    return {
      transform: frontInterpolate ? [{ rotateY: frontInterpolate }] : undefined,
      backfaceVisibility: 'hidden',
      position: 'absolute',
      width: cardWidth,
      height: cardHeight,
      opacity: frontOpacity,
      zIndex: frontZIndex,
    };
  }, [frontInterpolate, frontOpacity, frontZIndex, cardWidth, cardHeight]);

  const backAnimatedStyle = useMemo(() => {
    return {
      transform: backInterpolate ? [{ rotateY: backInterpolate }] : undefined,
      backfaceVisibility: 'hidden',
      position: 'absolute',
      width: cardWidth,
      height: cardHeight,
      opacity: backOpacity,
      zIndex: backZIndex,
    };
  }, [backInterpolate, backOpacity, backZIndex, cardWidth, cardHeight]);

  const containerStyle = useMemo(
    () => ([
      { width: cardWidth, height: cardHeight, alignSelf: 'center' },
    ]),
    [cardWidth, cardHeight]
  );

  const baseCardStyle = useMemo(
    () => [styles.card, { width: cardWidth, height: cardHeight, backgroundColor: cardBackground }],
    [cardWidth, cardHeight, cardBackground]
  );

  const gradientStyle = useMemo(
    () => [StyleSheet.absoluteFill, { borderRadius: moderateScale(24) }],
    []
  );

  const backScrollContentStyle = useMemo(
    () => ({
      justifyContent: 'center',
      paddingHorizontal: scale(24),
      paddingTop: verticalScale(32),
      paddingBottom: verticalScale(24),
    }),
    []
  );

  const questionTextStyle = useMemo(
    () => [
      typography.styles.h2,
      {
        color: textColor,
        marginBottom: card?.cards?.image ? verticalScale(16) : 0,
        textAlign: 'center',
      },
    ],
    [textColor, card?.cards?.image]
  );

  const answerTextStyle = useMemo(
    () => [
      typography.styles.h2,
      {
        color: '#fff',
        textAlign: 'center',
        marginTop: verticalScale(8),
        lineHeight: moderateScale(28),
        fontWeight: '600',
      },
    ],
    []
  );

  const subTextStyle = useMemo(
    () => [
      typography.styles.subtitle,
      {
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginTop: verticalScale(8),
        lineHeight: moderateScale(22),
        fontSize: moderateScale(16),
      },
    ],
    []
  );

  const noteTextStyle = useMemo(
    () => [
      typography.styles.subtitle,
      {
        color: 'rgba(255, 255, 255, 0.85)',
        textAlign: 'center',
        marginTop: verticalScale(8),
        lineHeight: moderateScale(22),
        fontSize: moderateScale(15),
        fontStyle: 'italic',
      },
    ],
    []
  );

  if (isPlaceholder) {
    return (
      <View style={containerStyle}>
        <View style={[styles.card, { width: cardWidth, height: cardHeight, opacity: 0.7 }]}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={gradientStyle}
          />
        </View>
      </View>
    );
  }

  const pixelRatio = useMemo(() => PixelRatio.get(), []);

  return (
    <View style={containerStyle}>
      <Animated.View
        style={[
          baseCardStyle,
          { padding: 0, overflow: 'hidden' },
          frontAnimatedStyle,
        ]}
        renderToHardwareTextureAndroid={true}
        shouldRasterizeIOS={true}
        rasterizationScale={pixelRatio}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={gradientStyle}
        />

        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          removeClippedSubviews
          style={{ flex: 1, width: '100%' }}
        >
          <Pressable
            onPress={() => onFlip?.(cardId)}
            style={{
              flexGrow: 1,
              width: '100%',
              padding: scale(24),
            }}
          >
            <View style={{ flex: 1, justifyContent: card?.cards?.image ? 'flex-start' : 'center', alignItems: 'center', width: '100%' }}>
              {card?.cards?.image ? (
                <View
                  style={[
                    styles.imageContainer,
                    {
                      backgroundColor: 'transparent',
                      marginTop: verticalScale(32),
                      height: (cardHeight * 1.85) / 5,
                    },
                  ]}
                >
                  <Image source={{ uri: card.cards.image }} style={styles.cardImage} />
                </View>
              ) : null}

              <MathText value={card?.cards?.question} style={questionTextStyle} forceText />
            </View>
          </Pressable>
        </ScrollView>
      </Animated.View>

      <Animated.View
        style={[
          baseCardStyle,
          { padding: 0, overflow: 'hidden' },
          backAnimatedStyle
        ]}
        renderToHardwareTextureAndroid={true}
        shouldRasterizeIOS={true}
        rasterizationScale={pixelRatio}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={gradientStyle}
        />

        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          removeClippedSubviews
          style={{ flex: 1, width: '100%' }}
        >
          <Pressable
            onPress={() => onFlip?.(cardId)}
            style={[backScrollContentStyle, { flexGrow: 1 }]}
          >
            <View style={{ alignItems: 'center', marginBottom: verticalScale(24) }}>
              <Pill
                label={t('swipeDeck.answer', 'Answer')}
                icon={<Iconify icon="uil:comment-alt-check" size={moderateScale(18)} color="#fff" />}
              />
              <MathText value={card?.cards?.answer} forceText style={answerTextStyle} />
            </View>

            {card?.cards?.example ? (
              <>
                <SectionDivider />
                <View style={{ alignItems: 'center', marginBottom: verticalScale(24) }}>
                  <Pill
                    label={t('swipeDeck.example', 'Example')}
                    icon={<Iconify icon="lucide:lightbulb" size={moderateScale(18)} color="#fff" />}
                  />
                  <MathText value={card.cards.example} forceText style={subTextStyle} />
                </View>
              </>
            ) : null}

            {card?.cards?.note ? (
              <>
                <SectionDivider />
                <View style={{ alignItems: 'center', marginBottom: verticalScale(24) }}>
                  <Pill
                    label={t('swipeDeck.note', 'Note')}
                    icon={
                      <Iconify
                        icon="material-symbols-light:stylus-note"
                        size={moderateScale(18)}
                        color="#fff"
                      />
                    }
                  />
                  <MathText value={card.cards.note} forceText style={noteTextStyle} />
                </View>
              </>
            ) : null}
          </Pressable>
        </ScrollView>
      </Animated.View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderWidth: moderateScale(2),
            borderColor: '#F98A21',
            borderRadius: moderateScale(26),
            opacity: leftBorderOpacity,
            zIndex: 999,
          }
        ]}
        pointerEvents="none"
      />

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderWidth: moderateScale(2),
            borderColor: '#3e8e41',
            borderRadius: moderateScale(26),
            opacity: rightBorderOpacity,
            zIndex: 999,
          }
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

const Pill = memo(function Pill({ label, icon }) {
  return (
    <View style={styles.pill}>
      {icon ? <View style={{ marginRight: scale(8) }}>{icon}</View> : null}
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
});

const SectionDivider = memo(function SectionDivider() {
  return <View style={styles.sectionDivider} />;
});

function areEqual(prev, next) {
  if (prev.isPlaceholder !== next.isPlaceholder) return false;
  if (prev.cardId !== next.cardId) return false;
  if (prev.cardWidth !== next.cardWidth || prev.cardHeight !== next.cardHeight) return false;
  if (prev.cardBackground !== next.cardBackground) return false;
  if (prev.textColor !== next.textColor) return false;

  const prevGrad = Array.isArray(prev.gradientColors) ? prev.gradientColors.join('|') : String(prev.gradientColors);
  const nextGrad = Array.isArray(next.gradientColors) ? next.gradientColors.join('|') : String(next.gradientColors);
  if (prevGrad !== nextGrad) return false;

  const pc = prev.card?.cards;
  const nc = next.card?.cards;
  if (!pc && !nc) return true;
  if (!pc || !nc) return false;

  return (
    pc.question === nc.question &&
    pc.answer === nc.answer &&
    pc.example === nc.example &&
    pc.note === nc.note &&
    pc.image === nc.image
  );
}

export default memo(SwipeFlipCardImpl, areEqual);

const styles = StyleSheet.create({
  shadowContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(4) },
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(8),
    elevation: 2,
    borderRadius: moderateScale(26),
    backgroundColor: 'transparent',
  },
  card: {
    borderRadius: moderateScale(26),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(22),
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    borderRadius: moderateScale(24),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(14),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: moderateScale(1.5),
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: verticalScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(4),
    elevation: 2,
  },
  pillText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: moderateScale(14),
    letterSpacing: 0.5,
  },
  sectionDivider: {
    width: '60%',
    height: verticalScale(1),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: verticalScale(20),
    alignSelf: 'center',
  },
});