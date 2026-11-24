import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { typography } from '../../theme/typography';
import MathText from '../ui/MathText';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

const FLIP_DURATION = 280;
const PERSPECTIVE = 1200;
const ENTRANCE_OFFSET = verticalScale(8);
const ENTRANCE_SCALE = 0.96;

// '#RRGGBB' / '#RGB' -> 'rgba(r,g,b,a)'. Falls back to the input for other formats.
function withAlpha(color, alpha) {
  if (typeof color !== 'string' || color[0] !== '#') return color;
  let hex = color.slice(1);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6 && hex.length !== 8) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SwipeFlipCard = forwardRef(function SwipeFlipCardImpl({
  card,
  cardId,
  isPlaceholder = false,
  isActive = true,
  cardWidth,
  cardHeight,
  gradientColors,
  cardBackground,
  textColor,
  onFlip,
  swipeX,
  leftSwipeAccentColor = '#F98A21',
  rightSwipeAccentColor = '#3e8e41',
  flipProgress: externalFlipProgress = null,
  entranceProgress: externalEntranceProgress = null,
  entranceOpacity: externalEntranceOpacity = null,
  onBackOverflowChange,
  reversed = false,
}, ref) {
  const { t } = useTranslation();
  // Reverse mode: answer on the front, question (+ image) on the back.
  const frontText = reversed ? card?.cards?.answer : card?.cards?.question;
  const frontImage = reversed ? null : card?.cards?.image;
  const backPrimaryText = reversed ? card?.cards?.question : card?.cards?.answer;
  const backImage = reversed ? card?.cards?.image : null;
  const [isFlipped, setIsFlipped] = useState(false);
  // Back face is not scrollable (scrolling fights the swipe/tap gestures).
  // Instead we measure whether the content fits and let the parent show a
  // "see more" affordance that opens the full content.
  const [backViewportHeight, setBackViewportHeight] = useState(0);
  const [backContentHeight, setBackContentHeight] = useState(0);
  const isBackOverflowing = backViewportHeight > 0 && backContentHeight > backViewportHeight + 1;

  useEffect(() => {
    if (isPlaceholder || !cardId) return;
    onBackOverflowChange?.(cardId, isBackOverflowing);
  }, [cardId, isBackOverflowing, isPlaceholder, onBackOverflowChange]);

  const backFadeColors = useMemo(() => {
    const base = gradientColors?.[gradientColors.length - 1] || '#7A5F3A';
    return [withAlpha(base, 0), withAlpha(base, 0.92), base];
  }, [gradientColors]);
  // The deck owns these shared values when the card is rendered inside the
  // swipe stack, allowing the card and its action row to animate together.
  // Local values remain as a safe fallback for standalone usage.
  const localFlipProgress = useSharedValue(0);
  const localEntranceProgress = useSharedValue(0);
  const localEntranceOpacity = useSharedValue(0);
  const flipProgress = externalFlipProgress || localFlipProgress;
  const entranceProgress = externalEntranceProgress || localEntranceProgress;
  const entranceOpacity = externalEntranceOpacity || localEntranceOpacity;

  useEffect(() => {
    cancelAnimation(flipProgress);
    flipProgress.value = 0;
    setIsFlipped(false);

    if (!externalEntranceProgress || !externalEntranceOpacity) {
      cancelAnimation(entranceProgress);
      cancelAnimation(entranceOpacity);
      entranceProgress.value = 0;
      entranceOpacity.value = 0;
    }
  }, [cardId, entranceOpacity, entranceProgress, externalEntranceOpacity, externalEntranceProgress, flipProgress]);

  useEffect(() => {
    if (externalEntranceProgress || externalEntranceOpacity) return;

    cancelAnimation(entranceProgress);
    cancelAnimation(entranceOpacity);

    if (!isActive || isPlaceholder) {
      entranceProgress.value = 0;
      entranceOpacity.value = 0;
      return;
    }

    // Standalone fallback: the deck normally owns this timeline.
    entranceProgress.value = withSpring(1, {
      damping: 10,
      stiffness: 240,
      mass: 0.55,
      overshootClamping: false,
    });
    entranceOpacity.value = withTiming(1, {
      duration: 60,
      easing: Easing.out(Easing.quad),
    });
  }, [entranceOpacity, entranceProgress, externalEntranceOpacity, externalEntranceProgress, isActive, isPlaceholder]);

  const flip = useCallback(() => {
    if (!isActive || isPlaceholder || !cardId) return;

    const target = flipProgress.value >= 0.5 ? 0 : 1;
    setIsFlipped(target === 1);
    flipProgress.value = withTiming(target, {
      duration: FLIP_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    onFlip?.(cardId, target === 1);
  }, [cardId, flipProgress, isActive, isPlaceholder, onFlip]);

  const reset = useCallback(() => {
    cancelAnimation(flipProgress);
    flipProgress.value = 0;
  }, [flipProgress]);

  useImperativeHandle(ref, () => ({
    flip,
    reset,
  }), [flip, reset]);

  // Each face is a complete physical card surface. This avoids a transformed
  // parent/shell around transformed children, which could mirror the back face
  // text on Android. Front = 0 -> 180, back = 180 -> 360 keeps the back text
  // readable while the gradient/background itself flips with the card.
  const frontAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: PERSPECTIVE },
      { rotateY: `${180 * flipProgress.value}deg` },
    ],
  }));

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: PERSPECTIVE },
      { rotateY: `${180 + (180 * flipProgress.value)}deg` },
    ],
  }));

  const contentEntranceStyle = useAnimatedStyle(() => {
    const x = swipeX?.value ?? 0;
    const labelDistance = Math.max(80, cardWidth * 0.28);
    // Let the user see the card content for the first part of the gesture.
    // It then fades out, finishing before the direction label becomes visible,
    // so the label never sits on top of readable card text.
    const fadeStart = labelDistance * 0.55;
    const fadeEnd = labelDistance * 0.68;
    // The label starts at the same 40% point, so the card content is still
    // fully readable before the label phase begins and cannot disappear early.
    const swipeFade = interpolate(
      Math.abs(x),
      [fadeStart, fadeEnd],
      [1, 0],
      'clamp'
    );

    return {
      opacity: entranceOpacity.value * swipeFade,
      transform: [
        { translateY: (1 - entranceProgress.value) * ENTRANCE_OFFSET },
        {
          scale: ENTRANCE_SCALE + ((1 - ENTRANCE_SCALE) * entranceProgress.value),
        },
      ],
    };
  }, [cardWidth, swipeX]);

  // Precompute all scaling outside UI-thread worklets. These helpers are regular
  // JavaScript functions and must never be called from useAnimatedStyle.
  const swipeLabelOffset = verticalScale(7);

  // Direction-aware counter color accent. The deck supplies the active layer's
  // Reanimated translateX shared value, so all of this runs on the UI thread.
  const swipeAccentStyle = useAnimatedStyle(() => {
    const x = swipeX?.value ?? 0;
    const distance = Math.max(80, cardWidth * 0.28);
    const progress = Math.min(1, Math.abs(x) / distance);
    const start = 0.10;
    const accentProgress = progress <= start
      ? 0
      : (progress - start) / (1 - start);
    const accentColor = x < 0 ? leftSwipeAccentColor : rightSwipeAccentColor;

    return {
      opacity: interpolate(accentProgress, [0, 1], [0, 0.18]),
      backgroundColor: accentColor,
    };
  }, [cardWidth, leftSwipeAccentColor, rightSwipeAccentColor, swipeX]);

  const swipeBorderStyle = useAnimatedStyle(() => {
    const x = swipeX?.value ?? 0;
    const distance = Math.max(80, cardWidth * 0.28);
    const progress = Math.min(1, Math.abs(x) / distance);
    const accentColor = x < 0 ? leftSwipeAccentColor : rightSwipeAccentColor;

    return {
      opacity: interpolate(progress, [0, 0.08, 1], [0, 0.55, 1]),
      borderColor: x === 0
        ? 'rgba(0, 0, 0, 0)'
        : interpolateColor(
          progress,
          [0, 1],
          ['rgba(0, 0, 0, 0)', accentColor]
        ),
    };
  }, [cardWidth, leftSwipeAccentColor, rightSwipeAccentColor, swipeX]);

  // Direction-aware labels. A single style is used so there is no JS-side
  // state change during the gesture.
  const leftSwipeLabelStyle = useAnimatedStyle(() => {
    const x = swipeX?.value ?? 0;
    const distance = Math.max(80, cardWidth * 0.28);
    const progress = Math.min(1, Math.abs(x) / distance);
    const visibleProgress = Math.min(1, Math.max(0, (progress - 0.68) / 0.32));
    return {
      opacity: x < 0 ? interpolate(visibleProgress, [0, 0.35, 1], [0, 0.35, 1]) : 0,
      transform: [
        { scale: interpolate(visibleProgress, [0, 1], [0.90, 1]) },
        { translateY: interpolate(visibleProgress, [0, 1], [swipeLabelOffset, 0]) },
      ],
    };
  }, [cardWidth, swipeLabelOffset, swipeX]);

  const rightSwipeLabelStyle = useAnimatedStyle(() => {
    const x = swipeX?.value ?? 0;
    const distance = Math.max(80, cardWidth * 0.28);
    const progress = Math.min(1, Math.abs(x) / distance);
    const visibleProgress = Math.min(1, Math.max(0, (progress - 0.68) / 0.32));
    return {
      opacity: x > 0 ? interpolate(visibleProgress, [0, 0.35, 1], [0, 0.35, 1]) : 0,
      transform: [
        { scale: interpolate(visibleProgress, [0, 1], [0.90, 1]) },
        { translateY: interpolate(visibleProgress, [0, 1], [swipeLabelOffset, 0]) },
      ],
    };
  }, [cardWidth, swipeLabelOffset, swipeX]);

  const containerStyle = useMemo(() => ({
    width: cardWidth,
    height: cardHeight,
    alignSelf: 'center',
  }), [cardHeight, cardWidth]);

  const baseCardStyle = useMemo(() => ({
    width: cardWidth,
    height: cardHeight,
    backgroundColor: cardBackground,
  }), [cardBackground, cardHeight, cardWidth]);

  const questionTextStyle = useMemo(() => [
    typography.styles.h2,
    {
      color: textColor,
      marginBottom: frontImage ? verticalScale(16) : 0,
      textAlign: 'center',
    },
  ], [frontImage, textColor]);

  const answerTextStyle = useMemo(() => [
    typography.styles.h2,
    {
      color: '#fff',
      textAlign: 'center',
      marginTop: verticalScale(8),
      lineHeight: moderateScale(28),
      fontWeight: '600',
    },
  ], []);

  const subTextStyle = useMemo(() => [
    typography.styles.subtitle,
    {
      color: 'rgba(255, 255, 255, 0.9)',
      textAlign: 'center',
      marginTop: verticalScale(8),
      lineHeight: moderateScale(22),
      fontSize: moderateScale(16),
    },
  ], []);

  const noteTextStyle = useMemo(() => [
    typography.styles.subtitle,
    {
      color: 'rgba(255, 255, 255, 0.85)',
      textAlign: 'center',
      marginTop: verticalScale(8),
      lineHeight: moderateScale(22),
      fontSize: moderateScale(15),
      fontStyle: 'italic',
    },
  ], []);

  if (isPlaceholder) {
    return (
      <View style={containerStyle}>
        <View style={[styles.card, baseCardStyle, styles.placeholderCard]}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Reanimated.View
        style={[styles.face, styles.frontFace, baseCardStyle, frontAnimatedStyle]}
        pointerEvents={isFlipped ? 'none' : 'auto'}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />

        <Reanimated.View pointerEvents="box-none" style={[styles.faceContent, contentEntranceStyle]}>
          <View style={styles.frontPressable}>
              <View
                style={[
                  styles.frontContent,
                  { justifyContent: frontImage ? 'flex-start' : 'center' },
                ]}
              >
                {frontImage ? (
                  <View
                    style={[
                      styles.imageContainer,
                      {
                        marginTop: verticalScale(32),
                        height: (cardHeight * 1.85) / 5,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: frontImage }}
                      style={styles.cardImage}
                      fadeDuration={0}
                    />
                  </View>
                ) : null}

                <MathText
                  value={frontText}
                  style={questionTextStyle}
                  forceText
                />
              </View>
          </View>
        </Reanimated.View>

        <Reanimated.View
          pointerEvents="none"
          style={[styles.swipeAccentWash, swipeAccentStyle]}
        />
        <Reanimated.View
          pointerEvents="none"
          style={[styles.swipeAccentBorder, swipeBorderStyle]}
        />
      </Reanimated.View>

      <Reanimated.View
        style={[styles.face, styles.backFace, baseCardStyle, backAnimatedStyle]}
        pointerEvents={isFlipped ? 'auto' : 'none'}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />

        <Reanimated.View pointerEvents="box-none" style={[styles.faceContent, contentEntranceStyle]}>
          <View style={styles.backPadding}>
          <View
            style={[
              styles.backViewport,
              { justifyContent: isBackOverflowing ? 'flex-start' : 'center' },
            ]}
            onLayout={(e) => setBackViewportHeight(e.nativeEvent.layout.height)}
          >
            <View
              style={styles.backContent}
              onLayout={(e) => setBackContentHeight(e.nativeEvent.layout.height)}
            >
              <View style={styles.answerSection}>
                <Pill
                  label={reversed ? t('cardDetail.question', 'Soru') : t('swipeDeck.answer', 'Answer')}
                  icon={
                    <Iconify
                      icon={reversed ? 'uil:comment-alt-question' : 'uil:comment-alt-check'}
                      size={moderateScale(18)}
                      color="#fff"
                    />
                  }
                />
                {backImage ? (
                  <View style={[styles.backImageContainer, { height: cardHeight * 0.3 }]}>
                    <Image
                      source={{ uri: backImage }}
                      style={styles.cardImage}
                      fadeDuration={0}
                    />
                  </View>
                ) : null}
                <MathText
                  value={backPrimaryText}
                  forceText
                  style={answerTextStyle}
                />
              </View>

              {card?.cards?.example ? (
                <>
                  <SectionDivider />
                  <View style={styles.answerSection}>
                    <Pill
                      label={t('swipeDeck.example', 'Example')}
                      icon={<Iconify icon="lucide:lightbulb" size={moderateScale(18)} color="#fff" />}
                    />
                    <MathText
                      value={card.cards.example}
                      forceText
                      style={subTextStyle}
                    />
                  </View>
                </>
              ) : null}

              {card?.cards?.note ? (
                <>
                  <SectionDivider />
                  <View style={styles.answerSection}>
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
                    <MathText
                      value={card.cards.note}
                      forceText
                      style={noteTextStyle}
                    />
                  </View>
                </>
              ) : null}
            </View>
          </View>
          </View>
          {isBackOverflowing ? (
            <LinearGradient
              pointerEvents="none"
              colors={backFadeColors}
              locations={[0, 0.6, 1]}
              style={styles.backFade}
            />
          ) : null}
        </Reanimated.View>

        <Reanimated.View
          pointerEvents="none"
          style={[styles.swipeAccentWash, swipeAccentStyle]}
        />
        <Reanimated.View
          pointerEvents="none"
          style={[styles.swipeAccentBorder, swipeBorderStyle]}
        />
      </Reanimated.View>

      <Reanimated.View
        pointerEvents="none"
        style={styles.swipeLabelLayer}
      >
        <Reanimated.Text style={[styles.swipeLabel, styles.swipeLabelOffWhite, leftSwipeLabelStyle]}>
          {t('swipeDeck.tutorial.swipeHintLeft', 'Tekrarla')}
        </Reanimated.Text>
        <Reanimated.Text style={[styles.swipeLabel, styles.swipeLabelOffWhite, rightSwipeLabelStyle]}>
          {t('swipeDeck.tutorial.swipeHintRight', 'Öğrendim')}
        </Reanimated.Text>
      </Reanimated.View>
    </View>
  );
});

const Pill = memo(function Pill({ label, icon }) {
  return (
    <View style={styles.pill}>
      {icon ? <View style={styles.pillIcon}>{icon}</View> : null}
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
});

const SectionDivider = memo(function SectionDivider() {
  return <View style={styles.sectionDivider} />;
});

function areEqual(prev, next) {
  if (prev.isPlaceholder !== next.isPlaceholder) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.cardId !== next.cardId) return false;
  if (prev.cardWidth !== next.cardWidth || prev.cardHeight !== next.cardHeight) return false;
  if (prev.cardBackground !== next.cardBackground) return false;
  if (prev.textColor !== next.textColor) return false;
  if (prev.onFlip !== next.onFlip) return false;
  if (prev.onBackOverflowChange !== next.onBackOverflowChange) return false;
  if (prev.reversed !== next.reversed) return false;
  if (prev.swipeX !== next.swipeX) return false;
  if (prev.leftSwipeAccentColor !== next.leftSwipeAccentColor) return false;
  if (prev.rightSwipeAccentColor !== next.rightSwipeAccentColor) return false;
  if (prev.flipProgress !== next.flipProgress) return false;
  if (prev.entranceProgress !== next.entranceProgress) return false;
  if (prev.entranceOpacity !== next.entranceOpacity) return false;

  const prevGrad = Array.isArray(prev.gradientColors)
    ? prev.gradientColors.join('|')
    : String(prev.gradientColors);
  const nextGrad = Array.isArray(next.gradientColors)
    ? next.gradientColors.join('|')
    : String(next.gradientColors);
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

const styles = StyleSheet.create({
  card: {
    borderRadius: moderateScale(26),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swipeAccentWash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(26),
    zIndex: 10,
  },
  swipeAccentBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(26),
    borderWidth: moderateScale(2),
    zIndex: 11,
  },
  swipeLabelLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  swipeLabel: {
    position: 'absolute',
    fontSize: moderateScale(25),
    fontWeight: '800',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  swipeLabelOffWhite: {
    color: '#FFF7ED',
  },
  placeholderCard: {
    position: 'relative',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(24),
  },
  face: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: moderateScale(26),
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  frontFace: {
    zIndex: 2,
  },
  backFace: {
    zIndex: 1,
  },
  faceContent: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  backPadding: {
    flex: 1,
    width: '100%',
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(32),
    paddingBottom: verticalScale(24),
  },
  backViewport: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  backImageContainer: {
    width: '100%',
    marginBottom: verticalScale(8),
  },
  backFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: verticalScale(110),
  },
  frontPressable: {
    flex: 1,
    width: '100%',
    padding: scale(24),
  },
  frontContent: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  backContent: {
    width: '100%',
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
  answerSection: {
    alignItems: 'center',
    marginBottom: verticalScale(24),
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
  },
  pillIcon: {
    marginRight: scale(8),
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

export default memo(SwipeFlipCard, areEqual);