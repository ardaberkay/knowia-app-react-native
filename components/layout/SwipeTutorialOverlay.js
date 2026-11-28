import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import Reanimated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Text } from '../ui/AppText';
import { fontSizes, fonts } from '../../theme/typography';
import PhosphorIcon from '../ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

const ACCENT = '#F98A21';
const DIM = 'rgba(0, 0, 0, 0.74)';
const LEFT_COLOR = '#F3A14C';
const RIGHT_COLOR = '#3E8E41';

// Full-screen rect with a rounded-rect hole (even-odd fill = the hole stays clear).
const spotlightPath = (w, h, x, y, rw, rh, r) => {
  const rr = Math.max(0, Math.min(r, rw / 2, rh / 2));
  return [
    `M0 0H${w}V${h}H0Z`,
    `M${x + rr} ${y}H${x + rw - rr}A${rr} ${rr} 0 0 1 ${x + rw} ${y + rr}`,
    `V${y + rh - rr}A${rr} ${rr} 0 0 1 ${x + rw - rr} ${y + rh}`,
    `H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + rh - rr}`,
    `V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`,
  ].join('');
};

// Looping shared value 0 → 1 → 0 while mounted.
function usePulse(duration = 1100) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(v);
  }, [v, duration]);
  return v;
}

// Step 1: a finger tapping the middle of the card.
function TapHint({ frame }) {
  const p = usePulse(900);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - p.value), transform: [{ scale: 0.7 + p.value * 0.9 }] }));
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: 1 - p.value * 0.12 }] }));
  if (!frame) return null;
  return (
    <View pointerEvents="none" style={[styles.tapHint, { left: frame.left + frame.width / 2 - 36, top: frame.top + frame.height / 2 - 36 }]}>
      <Reanimated.View style={[styles.tapRing, ring]} />
      <Reanimated.View style={[styles.tapDot, dot]}>
        <PhosphorIcon icon={ICONS.tapToFlip} size={26} color="#FFFFFF" />
      </Reanimated.View>
    </View>
  );
}

// Step 2: the two directions, gently pulling left and right.
function SwipeHint({ frame }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withSequence(
      withTiming(-1, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
      withTiming(0, { duration: 500 }),
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
      withTiming(0, { duration: 500 }),
    ), -1);
    return () => cancelAnimation(p);
  }, [p]);
  const left = useAnimatedStyle(() => ({ opacity: 0.55 + Math.max(0, -p.value) * 0.45, transform: [{ translateX: Math.min(0, p.value) * 10 }] }));
  const right = useAnimatedStyle(() => ({ opacity: 0.55 + Math.max(0, p.value) * 0.45, transform: [{ translateX: Math.max(0, p.value) * 10 }] }));
  const { t } = useTranslation();
  if (!frame) return null;
  return (
    <View pointerEvents="none" style={[styles.swipeHint, { top: frame.top + frame.height + 14, left: frame.left, width: frame.width }]}>
      <Reanimated.View style={[styles.swipePill, { backgroundColor: LEFT_COLOR }, left]}>
        <PhosphorIcon icon={ICONS.swipeLeft} size={15} color="#FFFFFF" />
        <Text style={styles.swipePillText}>{t('swipeDeck.tutorial.swipeHintLeft', 'Tekrar Et')}</Text>
      </Reanimated.View>
      <Reanimated.View style={[styles.swipePill, { backgroundColor: RIGHT_COLOR }, right]}>
        <Text style={styles.swipePillText}>{t('swipeDeck.tutorial.swipeHintRight', 'Öğrendim')}</Text>
        <PhosphorIcon icon={ICONS.swipeRight} size={15} color="#FFFFFF" />
      </Reanimated.View>
    </View>
  );
}

/**
 * First-run coachmarks (swipe screen, deck detail). Dims everything except
 * the step's target, outlines it with a soft pulsing frame and shows a step
 * card with dots, an icon, optional bullet points and back / next.
 * Target layouts are measured by the screen relative to its root view:
 * cardTargetLayout / intervalTargetLayout for the swipe screen, or any
 * { [target]: layout } map through targetLayouts.
 * A step without a measured target shows the card centred on a full dim.
 */
export default function SwipeTutorialOverlay({
  steps,
  stepIndex,
  onStepChange,
  onComplete,
  cardTargetLayout,
  intervalTargetLayout,
  targetLayouts,
  colors,
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pulse = usePulse(1300);
  const frameGlow = useAnimatedStyle(() => ({ opacity: 0.45 + pulse.value * 0.55 }));
  const [coachHeight, setCoachHeight] = useState(0);

  const activeStep = steps[stepIndex] || steps[0];
  if (!activeStep) return null;

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;
  const isCardTarget = activeStep.target === 'card';
  const isIntervalTarget = activeStep.target === 'interval';
  const layout = targetLayouts?.[activeStep.target]
    ?? (isCardTarget ? cardTargetLayout : isIntervalTarget ? intervalTargetLayout : null);
  const pad = activeStep.pad ?? (isCardTarget ? 10 : 6);
  const radius = activeStep.radius ?? (isCardTarget ? 26 : 14);
  const valid = layout
    && [layout.x, layout.y, layout.width, layout.height].every(Number.isFinite)
    && layout.width > 0 && layout.height > 0;
  const frame = valid ? {
    left: Math.max(0, layout.x - pad),
    top: Math.max(0, layout.y - pad),
    width: Math.min(width, layout.width + pad * 2),
    height: Math.min(height, layout.height + pad * 2),
  } : null;

  // card step: the coach card sits over the card's top; interval step: above
  // the buttons; any other target: below it when it fits, else above it.
  let cardPosition;
  if (isCardTarget) {
    cardPosition = { top: frame ? Math.max(insets.top + 8, frame.top - 196) : insets.top + 60 };
  } else if (isIntervalTarget) {
    cardPosition = { bottom: frame ? Math.max(24, height - frame.top + 14) : 144 + insets.bottom };
  } else if (!frame) {
    cardPosition = { top: Math.max(insets.top + 24, (height - (coachHeight || 260)) / 2) };
  } else {
    const below = frame.top + frame.height + 14;
    const fitsBelow = below + (coachHeight || 260) <= height - insets.bottom - 16;
    cardPosition = fitsBelow
      ? { top: below }
      : { bottom: Math.max(insets.bottom + 16, height - frame.top + 14) };
  }

  const goNext = () => (isLastStep ? onComplete() : onStepChange((s) => Math.min(steps.length - 1, s + 1)));
  const goBack = () => onStepChange((s) => Math.max(0, s - 1));

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          d={frame ? spotlightPath(width, height, frame.left, frame.top, frame.width, frame.height, radius) : `M0 0H${width}V${height}H0Z`}
          fill={DIM}
          fillRule="evenodd"
        />
      </Svg>

      {frame && (
        <Reanimated.View
          pointerEvents="none"
          style={[styles.frame, { left: frame.left, top: frame.top, width: frame.width, height: frame.height, borderRadius: radius }, frameGlow]}
        />
      )}

      {activeStep.target === 'card' && !activeStep.showSwipeHint && <TapHint frame={frame} />}
      {activeStep.showSwipeHint && <SwipeHint frame={frame} />}

      <Reanimated.View
        key={stepIndex}
        entering={FadeInDown.duration(320)}
        onLayout={(e) => setCoachHeight(e.nativeEvent.layout.height)}
        style={[styles.coach, cardPosition, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
      >
        <View style={styles.coachTop}>
          <View style={[styles.coachIcon, { backgroundColor: ACCENT + '22' }]}>
            <PhosphorIcon icon={activeStep.icon} size={20} color={ACCENT} />
          </View>
          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === stepIndex ? styles.dotActive : null, { backgroundColor: i <= stepIndex ? ACCENT : colors.cardBorder }]}
              />
            ))}
          </View>
        </View>

        <Reanimated.Text maxFontSizeMultiplier={1.2} entering={FadeIn.duration(260)} style={[styles.title, { color: colors.text }]}>
          {activeStep.title}
        </Reanimated.Text>
        <Text style={[styles.description, { color: colors.muted }]}>{activeStep.description}</Text>
        {activeStep.points?.length > 0 && (
          <View style={styles.points}>
            {activeStep.points.map((point, i) => (
              <View key={i} style={styles.pointRow}>
                <View style={[styles.pointIcon, { backgroundColor: (point.color || ACCENT) + '22' }]}>
                  <PhosphorIcon icon={point.icon} size={15} color={point.color || ACCENT} />
                </View>
                <Text style={[styles.pointText, { color: colors.text }]}>{point.text}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <Pressable onPress={onComplete} hitSlop={8} style={styles.skip}>
            <Text style={[styles.skipText, { color: colors.muted }]}>{t('swipeDeck.tutorial.skip', 'Geç')}</Text>
          </Pressable>
          <View style={styles.navActions}>
            {!isFirstStep && (
              <Pressable
                onPress={goBack}
                accessibilityLabel={t('swipeDeck.tutorial.back', 'Geri')}
                style={[styles.backBtn, { borderColor: colors.cardBorder }]}
              >
                <PhosphorIcon icon={ICONS.back} size={18} color={colors.text} />
              </Pressable>
            )}
            <Pressable onPress={goNext} style={styles.nextBtn}>
              <Text style={styles.nextText}>
                {isLastStep ? t('swipeDeck.tutorial.done', 'Anladım') : t('swipeDeck.tutorial.next', 'İleri')}
              </Text>
              {!isLastStep && <PhosphorIcon icon={ICONS.arrowRight} size={16} color="#FFFFFF" />}
            </Pressable>
          </View>
        </View>
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 9999, elevation: 9999 },
  frame: { position: 'absolute', borderWidth: 2, borderColor: ACCENT },

  coach: {
    position: 'absolute',
    left: 18,
    right: 18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  coachTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  coachIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { width: 20 },
  title: { fontSize: fontSizes.title3, fontFamily: fonts.bold, marginBottom: 6 },
  description: { fontSize: fontSizes.subhead, fontFamily: fonts.regular, lineHeight: 21 },
  points: { marginTop: 12, gap: 10 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pointIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, fontSize: fontSizes.footnote, fontFamily: fonts.regular, lineHeight: 19, paddingTop: 4 },

  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  skip: { paddingVertical: 8, paddingRight: 8 },
  skipText: { fontSize: fontSizes.subhead, fontFamily: fonts.semibold },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { height: 42, paddingHorizontal: 20, borderRadius: 21, backgroundColor: ACCENT, flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextText: { color: '#FFFFFF', fontSize: fontSizes.subhead, fontFamily: fonts.bold },

  tapHint: { position: 'absolute', width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  tapRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#FFFFFF' },
  tapDot: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(249, 138, 33, 0.92)', alignItems: 'center', justifyContent: 'center' },

  swipeHint: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  swipePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99 },
  swipePillText: { color: '#FFFFFF', fontSize: fontSizes.footnote, fontFamily: fonts.bold },
});
