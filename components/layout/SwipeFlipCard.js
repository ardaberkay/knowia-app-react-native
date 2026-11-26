import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text, MAX_FONT_SIZE_MULTIPLIER } from '../ui/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { typography } from '../../theme/typography';
import { triggerHaptic } from '../../lib/hapticManager';

const PERSPECTIVE = 1200;
const ENTRANCE_OFFSET = 8;
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

function SwipeFlipCard({
  card,
  cardId,
  isPlaceholder = false,
  isActive = true,
  cardWidth,
  cardHeight,
  gradientColors,
  cardBackground,
  textColor,
  swipeX,
  leftSwipeAccentColor = '#F98A21',
  rightSwipeAccentColor = '#3e8e41',
  flipProgress: externalFlipProgress = null,
  entranceProgress: externalEntranceProgress = null,
  entranceOpacity: externalEntranceOpacity = null,
  onBackOverflowChange,
  reversed = false,
}) {
  const { t } = useTranslation();
  // Reverse mode: answer on the front, question (+ image) on the back.
  const frontText = reversed ? card?.cards?.answer : card?.cards?.question;
  const frontImage = reversed ? null : card?.cards?.image;
  const backPrimaryText = reversed ? card?.cards?.question : card?.cards?.answer;
  const backImage = reversed ? card?.cards?.image : null;
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

  // The flip itself is owned by SwipeCardDeck: its tap gesture animates
  // flipProgress on the UI thread. This card only renders that progress, so a
  // flip never re-renders React.
  //
  // Each face is a complete physical card surface. This avoids a transformed
  // parent/shell around transformed children, which could mirror the back face
  // text on Android. Front = 0 -> 180, back = 180 -> 360 keeps the back text
  // readable while the gradient/background itself flips with the card.
  // The opacity swap at 90° hides the far face without relying on
  // backfaceVisibility, which is unreliable on Android.
  const frontAnimatedStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value < 0.5 ? 1 : 0,
    transform: [
      { perspective: PERSPECTIVE },
      { rotateY: `${180 * flipProgress.value}deg` },
    ],
  }));

  const backAnimatedStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value < 0.5 ? 0 : 1,
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

  // The back face skips the entrance spring: it is hidden while a new card
  // arrives, and a quick flip would otherwise show its text still scaling and
  // settling. It keeps only the swipe fade.
  const backContentStyle = useAnimatedStyle(() => {
    const x = swipeX?.value ?? 0;
    const labelDistance = Math.max(80, cardWidth * 0.28);
    return {
      opacity: interpolate(
        Math.abs(x),
        [labelDistance * 0.55, labelDistance * 0.68],
        [1, 0],
        'clamp'
      ),
    };
  }, [cardWidth, swipeX]);

  // Precompute all scaling outside UI-thread worklets. These helpers are regular
  // JavaScript functions and must never be called from useAnimatedStyle.
  const swipeLabelOffset = 7;

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
      marginBottom: frontImage ? 16 : 0,
      textAlign: 'center',
    },
  ], [frontImage, textColor]);

  const answerTextStyle = useMemo(() => [
    typography.styles.h2,
    {
      color: '#fff',
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 28,
      fontWeight: '600',
    },
  ], []);

  const subTextStyle = useMemo(() => [
    typography.styles.subtitle,
    {
      color: 'rgba(255, 255, 255, 0.9)',
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 22,
      fontSize: 16,
    },
  ], []);

  const noteTextStyle = useMemo(() => [
    typography.styles.subtitle,
    {
      color: 'rgba(255, 255, 255, 0.85)',
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 22,
      fontSize: 15,
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
        pointerEvents="none"
        renderToHardwareTextureAndroid
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
                        marginTop: 32,
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

                <Text
                  style={questionTextStyle}
                >
                  {frontText}
                </Text>
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
        pointerEvents="none"
        renderToHardwareTextureAndroid
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />

        <Reanimated.View pointerEvents="box-none" style={[styles.faceContent, backContentStyle]}>
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
                  label={t('swipeDeck.answer', 'Answer')}
                  icon={
                    <Iconify
                      icon="uil:comment-alt-check"
                      size={18}
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
                <Text
                  style={answerTextStyle}
                >
                  {backPrimaryText}
                </Text>
              </View>

              {card?.cards?.example ? (
                <>
                  <SectionDivider />
                  <View style={styles.answerSection}>
                    <Pill
                      label={t('swipeDeck.example', 'Example')}
                      icon={<Iconify icon="lucide:lightbulb" size={18} color="#fff" />}
                    />
                    <Text
                      style={subTextStyle}
                    >
                      {card.cards.example}
                    </Text>
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
                          size={18}
                          color="#fff"
                        />
                      }
                    />
                    <Text
                      style={noteTextStyle}
                    >
                      {card.cards.note}
                    </Text>
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
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={[styles.swipeLabel, styles.swipeLabelOffWhite, leftSwipeLabelStyle]}>
          {t('swipeDeck.tutorial.swipeHintLeft', 'Tekrarla')}
        </Reanimated.Text>
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={[styles.swipeLabel, styles.swipeLabelOffWhite, rightSwipeLabelStyle]}>
          {t('swipeDeck.tutorial.swipeHintRight', 'Öğrendim')}
        </Reanimated.Text>
      </Reanimated.View>
    </View>
  );
}

// Pill and SectionDivider are also used by SwipeDeckScreen's "show more" sheet.
export const Pill = memo(function Pill({ label, icon }) {
  return (
    <View style={styles.pill}>
      {icon ? <View style={styles.pillIcon}>{icon}</View> : null}
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
});

export const SectionDivider = memo(function SectionDivider() {
  return <View style={styles.sectionDivider} />;
});

function areEqual(prev, next) {
  if (prev.isPlaceholder !== next.isPlaceholder) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.cardId !== next.cardId) return false;
  if (prev.cardWidth !== next.cardWidth || prev.cardHeight !== next.cardHeight) return false;
  if (prev.cardBackground !== next.cardBackground) return false;
  if (prev.textColor !== next.textColor) return false;
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


// Speaker / favourite / "see more" controls drawn on top of the active card.
// They sit outside the card's gesture surface (so a press never flips the
// card) but follow its entrance, swipe fade and flip timeline.
const AnimatedActionPressable = Reanimated.createAnimatedComponent(Pressable);
const ACTION_ENTRANCE_OFFSET = 8;

export const SwipeCardActions = memo(function SwipeCardActions({
  cardId,
  cardWidth,
  isFavorite,
  favoriteColor,
  onFavoritePress,
  swipeX,
  flipProgress,
  entranceProgress,
  entranceOpacity,
  showMore = false,
  showMoreLabel,
  onShowMorePress,
  showMoreTextColor = '#1C1C1C',
  onSpeakPress,
  isSpeaking = false,
  speakLabel,
  stopSpeakingLabel,
}) {
  // This timeline intentionally mirrors SwipeFlipCard.contentEntranceStyle.
  // The action row is outside the ScrollView/face content, but it uses the
  // exact same shared entrance/fade values as the card content.
  const actionEntranceStyle = useAnimatedStyle(() => {
    const x = swipeX?.value ?? 0;
    const labelDistance = Math.max(80, cardWidth * 0.28);
    const fadeStart = labelDistance * 0.55;
    const fadeEnd = labelDistance * 0.68;
    const swipeFade = interpolate(
      Math.abs(x),
      [fadeStart, fadeEnd],
      [1, 0],
      'clamp'
    );

    const entrance = entranceProgress?.value ?? 1;
    const opacity = entranceOpacity?.value ?? 1;

    return {
      opacity: opacity * swipeFade,
      transform: [
        { translateY: (1 - entrance) * ACTION_ENTRANCE_OFFSET },
        { scale: 0.96 + (0.04 * entrance) },
      ],
    };
  }, [cardWidth, entranceOpacity, entranceProgress, swipeX]);

  // The action row itself never participates in the card content ScrollView.
  // Only the visual heart faces use the same Y-axis flip timeline as the card.
  const frontFlipStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${180 * (flipProgress?.value ?? 0)}deg` },
    ],
  }), [flipProgress]);

  const backFlipStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${180 + (180 * (flipProgress?.value ?? 0))}deg` },
    ],
  }), [flipProgress]);

  // "See more" lives on the back face only: fade it in with the second half
  // of the flip so it never shows on the question side.
  const showMoreStyle = useAnimatedStyle(() => {
    const x = swipeX?.value ?? 0;
    const labelDistance = Math.max(80, cardWidth * 0.28);
    const swipeFade = interpolate(
      Math.abs(x),
      [labelDistance * 0.55, labelDistance * 0.68],
      [1, 0],
      'clamp'
    );
    const flipVisible = interpolate(flipProgress?.value ?? 0, [0.5, 1], [0, 1], 'clamp');
    return { opacity: flipVisible * swipeFade * (entranceOpacity?.value ?? 1) };
  }, [cardWidth, entranceOpacity, flipProgress, swipeX]);

  // "See more" only takes touches on the back face. This small row learns the
  // side from flipProgress when the flip passes halfway; nothing else renders.
  const [backShowing, setBackShowing] = useState(false);
  useAnimatedReaction(
    () => (flipProgress?.value ?? 0) >= 0.5,
    (isBack, wasBack) => {
      if (showMore && isBack !== wasBack) runOnJS(setBackShowing)(isBack);
    },
    [flipProgress, showMore]
  );

  const handleShowMorePress = useCallback(() => {
    triggerHaptic('light');
    onShowMorePress?.(cardId);
  }, [cardId, onShowMorePress]);

  const handlePress = useCallback(() => {
    triggerHaptic('medium');
    onFavoritePress?.(cardId);
  }, [cardId, onFavoritePress]);

  const handleSpeakPress = useCallback(() => {
    triggerHaptic('light');
    onSpeakPress?.(cardId);
  }, [cardId, onSpeakPress]);

  // Speaker (top-left): same two-face flip as the heart, so it turns with the
  // card. It looks the same while speaking; tapping again stops.
  const speakIcon = 'solar:volume-loud-bold';
  const speakIconColor = '#FFF7ED';

  const favoriteIcon = isFavorite ? 'solar:heart-bold' : 'solar:heart-broken';
  const favoriteIconColor = isFavorite ? favoriteColor : '#FFF7ED';

  return (
    <>
    <View
      pointerEvents="box-none"
      style={styles.cardActionRow}
    >
      {onSpeakPress ? (
        <AnimatedActionPressable
          accessibilityRole="button"
          accessibilityLabel={isSpeaking ? stopSpeakingLabel : speakLabel}
          onPress={handleSpeakPress}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          }}
          style={[styles.cardActionButton, actionEntranceStyle]}
        >
          <Reanimated.View
            pointerEvents="none"
            style={styles.cardActionIconStage}
          >
            <Reanimated.View
              style={[styles.cardActionIconFace, styles.cardActionIconFrontFace, frontFlipStyle]}
            >
              <Iconify icon={speakIcon} size={25} color={speakIconColor} />
            </Reanimated.View>
            <Reanimated.View
              style={[styles.cardActionIconFace, styles.cardActionIconBackFace, backFlipStyle]}
            >
              <Iconify icon={speakIcon} size={25} color={speakIconColor} />
            </Reanimated.View>
          </Reanimated.View>
        </AnimatedActionPressable>
      ) : <View />}

      <AnimatedActionPressable
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? 'Favorilerden kaldır' : 'Favorilere ekle'}
        onPress={handlePress}
        hitSlop={{
          top: 10,
          bottom: 10,
          left: 10,
          right: 10,
        }}
        style={[styles.cardActionButton, actionEntranceStyle]}
      >
        <Reanimated.View
          pointerEvents="none"
          style={styles.cardActionIconStage}
        >
          <Reanimated.View
            style={[styles.cardActionIconFace, styles.cardActionIconFrontFace, frontFlipStyle]}
          >
            <Iconify
              icon={favoriteIcon}
              size={25}
              color={favoriteIconColor}
            />
          </Reanimated.View>

          <Reanimated.View
            style={[styles.cardActionIconFace, styles.cardActionIconBackFace, backFlipStyle]}
          >
            <Iconify
              icon={favoriteIcon}
              size={25}
              color={favoriteIconColor}
            />
          </Reanimated.View>
        </Reanimated.View>
      </AnimatedActionPressable>
    </View>

      {showMore ? (
        <View
          pointerEvents={backShowing ? 'box-none' : 'none'}
          style={styles.showMoreRow}
        >
          <AnimatedActionPressable
            accessibilityRole="button"
            accessibilityLabel={showMoreLabel}
            onPress={handleShowMorePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.showMoreButton, showMoreStyle]}
          >
            <Text style={[styles.showMoreText, { color: showMoreTextColor }]}>{showMoreLabel}</Text>
            <Iconify icon="flowbite:caret-down-solid" size={14} color={showMoreTextColor} />
          </AnimatedActionPressable>
        </View>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  showMoreRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    zIndex: 300,
    elevation: 300,
    alignItems: 'center',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  showMoreText: {
    ...typography.styles.button,
    fontSize: 14,
  },
  cardActionRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    zIndex: 300,
    elevation: 300,
    flexDirection: 'row',
    alignItems: 'center',
    // Speaker on the left, favourite on the right.
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  cardActionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  cardActionIconStage: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardActionIconFace: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  cardActionIconFrontFace: {
    zIndex: 2,
  },
  cardActionIconBackFace: {
    zIndex: 1,
  },
  card: {
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swipeAccentWash: {
    ...StyleSheet.absoluteFill,
    borderRadius: 26,
    zIndex: 10,
  },
  swipeAccentBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 26,
    borderWidth: 2,
    zIndex: 11,
  },
  swipeLabelLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  swipeLabel: {
    position: 'absolute',
    fontSize: 25,
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
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
  },
  face: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 26,
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
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  backViewport: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  backImageContainer: {
    width: '100%',
    marginBottom: 8,
  },
  backFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
  },
  frontPressable: {
    flex: 1,
    width: '100%',
    padding: 24,
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
    marginBottom: 22,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    borderRadius: 24,
  },
  answerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 12,
  },
  pillIcon: {
    marginRight: 8,
  },
  pillText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  sectionDivider: {
    width: '60%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 20,
    alignSelf: 'center',
  },
});

export default memo(SwipeFlipCard, areEqual);