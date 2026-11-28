import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/ui/AppText';
import PhosphorIcon from '../../components/ui/PhosphorIcon';
import CreateButton from '../../components/tools/CreateButton';
import { useTheme } from '../../theme/theme';
import { fontSizes, fonts } from '../../theme/typography';
import { getCategoryIcon, ICONS } from '../../theme/icons';
import { getCategoryColors } from '../../theme/colors';
import { triggerHaptic } from '../../lib/hapticManager';
import { OnboardingFinishContext } from '../../contexts/OnboardingFinishContext';
import { DAILY_GOAL_PRESETS, goalMinutes, savePendingDailyGoal } from '../../services/ProfileService';

const ACCENT = '#F98A21';
const GREEN = '#3E8E41';
const REPEAT = '#F3A14C';
const SLIDE_COUNT = 4;
const SWIPE_OUT = 90; // px past which a demo swipe counts

// ---------------------------------------------------------------- slide 1
/** A real-feeling card: tap to flip, swipe right (learned) or left (repeat). */
function SwipeDemo({ onTouchCard }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  // Portrait card, 2:3 like the swipe screen: the height comes from the
  // screen height, the width from it. Every layer gets these numbers.
  const cardHeight = Math.round(Math.min(height * 0.4, 330));
  const cardWidth = Math.round(cardHeight / 1.5);
  const size = { width: cardWidth, height: cardHeight };

  const cards = useMemo(() => [1, 2, 3].map((n) => ({
    q: t(`onboarding.demo${n}Q`, ['Book', 'Apple', 'River'][n - 1]),
    a: t(`onboarding.demo${n}A`, ['Kitap', 'Elma', 'Nehir'][n - 1]),
  })), [t]);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState(null); // 'right' | 'left' | null
  const feedbackTimer = useRef(null);
  useEffect(() => () => clearTimeout(feedbackTimer.current), []);

  const tx = useSharedValue(0);
  const flip = useSharedValue(0);
  const appear = useSharedValue(1); // 0 while the swiped card is gone, then the next one grows in

  const onSwiped = useCallback((dir) => {
    triggerHaptic(dir > 0 ? 'success' : 'selection');
    setFeedback(dir > 0 ? 'right' : 'left');
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 1600);
    setIndex((i) => (i + 1) % cards.length);
  }, [cards.length]);

  // The new card's text is rendered: only now move the (hidden) card back to
  // the middle and let it grow in from the card behind. Resetting before the
  // re-render showed the old card for a frame.
  const firstIndexRef = useRef(true);
  useEffect(() => {
    if (firstIndexRef.current) { firstIndexRef.current = false; return; }
    tx.value = 0;
    flip.value = 0;
    appear.value = withTiming(1, { duration: 200 });
  }, [index, tx, flip, appear]);

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onBegin(() => { if (onTouchCard) runOnJS(onTouchCard)(true); })
    .onFinalize(() => { if (onTouchCard) runOnJS(onTouchCard)(false); })
    .onUpdate((e) => { tx.value = e.translationX; })
    .onEnd((e) => {
      const dir = Math.sign(tx.value);
      if (Math.abs(tx.value) > SWIPE_OUT || Math.abs(e.velocityX) > 900) {
        tx.value = withTiming(dir * width, { duration: 220 }, () => {
          appear.value = 0;
          runOnJS(onSwiped)(dir);
        });
      } else {
        tx.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });
  const tap = Gesture.Tap().onEnd(() => {
    flip.value = withTiming(flip.value > 0.5 ? 0 : 1, { duration: 320 });
  });
  const gesture = Gesture.Race(pan, tap);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { translateY: (1 - appear.value) * 16 },
      { scale: 0.92 + appear.value * 0.08 },
      { translateX: tx.value },
      { rotate: `${interpolate(tx.value, [-200, 0, 200], [-12, 0, 12], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${flip.value * 180}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${flip.value * 180 + 180}deg` }],
  }));
  const rightTag = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [0, SWIPE_OUT], [0, 1], Extrapolation.CLAMP) }));
  const leftTag = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-SWIPE_OUT, 0], [1, 0], Extrapolation.CLAMP) }));

  const card = cards[index];

  return (
    <View style={styles.demo}>
      <View style={size}>
        {/* the next card waits behind */}
        <View style={[styles.demoCard, size, styles.demoBehind, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]} />

        <GestureDetector gesture={gesture}>
          <Reanimated.View style={[styles.demoLayer, size, cardStyle]}>
            <Reanimated.View style={[styles.demoCard, size, styles.demoFace, frontStyle]}>
              <LinearGradient colors={['#F98A21', '#FF6B35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.demoLabel}>{t('onboarding.demoQuestion', 'Soru')}</Text>
              <View style={styles.demoMiddle}>
                <Text style={[styles.demoWord, { color: '#FFFFFF' }]} numberOfLines={2}>{card.q}</Text>
              </View>
              <View style={styles.demoTapHint}>
                <PhosphorIcon icon={ICONS.tapToFlip} size={14} color="rgba(255, 255, 255, 0.85)" />
                <Text style={styles.demoTapText} numberOfLines={1}>{t('onboarding.demoTap', 'Çevirmek için dokun')}</Text>
              </View>
            </Reanimated.View>
            <Reanimated.View style={[styles.demoCard, size, styles.demoFace, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }, backStyle]}>
              <Text style={[styles.demoLabel, { color: colors.muted }]}>{t('onboarding.demoAnswer', 'Cevap')}</Text>
              <View style={styles.demoMiddle}>
                <Text style={[styles.demoWord, { color: colors.text }]} numberOfLines={2}>{card.a}</Text>
              </View>
              <View style={styles.demoTapHint} />
            </Reanimated.View>

            {/* direction tags while dragging */}
            <Reanimated.View style={[styles.dragTag, styles.dragTagRight, { borderColor: GREEN }, rightTag]}>
              <Text style={[styles.dragTagText, { color: GREEN }]}>{t('onboarding.demoLearned', 'Öğrendim')}</Text>
            </Reanimated.View>
            <Reanimated.View style={[styles.dragTag, styles.dragTagLeft, { borderColor: REPEAT }, leftTag]}>
              <Text style={[styles.dragTagText, { color: REPEAT }]}>{t('onboarding.demoRepeat', 'Tekrar Et')}</Text>
            </Reanimated.View>
          </Reanimated.View>
        </GestureDetector>
      </View>

      {/* what the swipe did / how to use it */}
      <View style={styles.demoFooter}>
        {feedback ? (
          <Reanimated.View key={feedback + index} entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.feedbackRow}>
            <PhosphorIcon icon={feedback === 'right' ? ICONS.learned : ICONS.repeat} size={16} color={feedback === 'right' ? GREEN : REPEAT} />
            <Text style={[styles.feedbackText, { color: colors.text }]}>
              {feedback === 'right'
                ? t('onboarding.demoLearnedFeedback', 'Öğrendin, bu kart bir daha gelmez.')
                : t('onboarding.demoRepeatFeedback', 'Birkaç kart sonra yeniden gelecek.')}
            </Text>
          </Reanimated.View>
        ) : (
          <View style={styles.hintRow}>
            <View style={styles.hintSide}>
              <PhosphorIcon icon={ICONS.swipeLeft} size={14} color={REPEAT} />
              <Text style={[styles.hintText, { color: colors.muted }]}>{t('onboarding.demoRepeat', 'Tekrar Et')}</Text>
            </View>
            <View style={[styles.hintDivider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.hintSide}>
              <Text style={[styles.hintText, { color: colors.muted }]}>{t('onboarding.demoLearned', 'Öğrendim')}</Text>
              <PhosphorIcon icon={ICONS.swipeRight} size={14} color={GREEN} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- slide 2
/** Three ready / community decks fanned out, in the app's deck card look. */
function DecksVisual() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const decks = [
    { order: 3, name: t('categories.3', 'Matematik'), count: 48, rotate: '-10deg', x: -78, y: 14 },
    { order: 6, name: t('categories.6', 'Sanat ve Kültür'), count: 64, rotate: '10deg', x: 78, y: 14 },
    { order: 1, name: t('categories.1', 'Dil'), count: 120, rotate: '0deg', x: 0, y: 0 },
  ];
  return (
    <View style={styles.visual}>
      {decks.map((deck) => (
        <View
          key={deck.order}
          style={[styles.deckTile, { transform: [{ translateX: deck.x }, { translateY: deck.y }, { rotate: deck.rotate }] }]}
        >
          <LinearGradient colors={getCategoryColors(colors, deck.order)} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <View style={styles.deckWatermark}>
            <PhosphorIcon icon={getCategoryIcon(deck.order)} size={96} color="rgba(0, 0, 0, 0.1)" />
          </View>
          <View style={styles.deckUser}>
            <Image source={require('../../assets/images/app_icon.png')} style={styles.deckAvatar} />
            <Text style={styles.deckUserText} numberOfLines={1}>Knowia</Text>
          </View>
          <Text style={styles.deckName} numberOfLines={2}>{deck.name}</Text>
          <View style={styles.deckCount}>
            <PhosphorIcon icon={ICONS.stack} size={12} color="#FFFFFF" />
            <Text style={styles.deckCountText}>{deck.count}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- slide 3
/** A small "create card" form: question / answer, CSV and share. */
function CreateVisual() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const box = { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder };
  return (
    <View style={styles.visual}>
      <View style={[styles.mockCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
        {[
          { icon: ICONS.question, label: t('addCard.question', 'Soru'), value: t('onboarding.demo1Q', 'Book') },
          { icon: ICONS.answer, label: t('addCard.answer', 'Cevap'), value: t('onboarding.demo1A', 'Kitap') },
        ].map((row) => (
          <View key={row.label} style={styles.mockField}>
            <View style={styles.mockLabelRow}>
              <PhosphorIcon icon={row.icon} size={16} color={ACCENT} />
              <Text style={[styles.mockLabel, { color: colors.text }]}>{row.label}</Text>
            </View>
            <View style={[styles.mockBox, box]}>
              <Text style={[styles.mockValue, { color: colors.text }]}>{row.value}</Text>
            </View>
          </View>
        ))}
        <View style={styles.mockChips}>
          <View style={[styles.mockChip, { backgroundColor: ACCENT + '1F' }]}>
            <PhosphorIcon icon={ICONS.csvFile} size={14} color={ACCENT} />
            <Text style={[styles.mockChipText, { color: ACCENT }]}>{t('addCard.csvUpload', 'CSV ile Yükle')}</Text>
          </View>
          <View style={[styles.mockChip, { backgroundColor: GREEN + '22' }]}>
            <PhosphorIcon icon={ICONS.community} size={14} color={GREEN} />
            <Text style={[styles.mockChipText, { color: GREEN }]}>{t('onboarding.share', 'Paylaş')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- slide 4
/** Daily goal choice (optional): saved on the device, written to the profile after sign-up. */
function GoalPicker({ selected, onSelect }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.goals}>
      <View style={[styles.goalIcon, { backgroundColor: ACCENT + '22' }]}>
        <PhosphorIcon icon={ICONS.fire} size={30} color={ACCENT} />
      </View>
      {DAILY_GOAL_PRESETS.map((preset) => {
        const active = selected === preset.goal;
        return (
          <Pressable
            key={preset.key}
            onPress={() => { triggerHaptic('selection'); onSelect(active ? null : preset.goal); }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={({ pressed }) => [
              styles.goalRow,
              {
                backgroundColor: active ? ACCENT + '14' : colors.cardBackground,
                borderColor: active ? ACCENT : colors.cardBorder,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={styles.goalTextCol}>
              <Text style={[styles.goalTitle, { color: colors.text }]}>{t(`profile.activity.goals.${preset.key}.title`)}</Text>
              <Text style={[styles.goalMeta, { color: colors.muted }]}>
                {t('profile.activity.goalMeta', { count: preset.goal, min: goalMinutes(preset.goal) })}
              </Text>
            </View>
            <View style={[styles.radio, { borderColor: active ? ACCENT : colors.muted }]}>
              {active ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        );
      })}
      <Text style={[styles.goalHint, { color: colors.muted }]}>
        {t('onboarding.goalHint', 'İstediğin zaman profilinden değiştirebilirsin.')}
      </Text>
    </View>
  );
}

/** Slide title + text, faded and lifted by the pager position (follows the finger). */
function SlideText({ index, position, title, text, colors }) {
  const style = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(position.value - index));
    return { opacity: 1 - distance, transform: [{ translateY: distance * 16 }] };
  });
  return (
    <Reanimated.View style={[styles.textBlock, style]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.text, { color: colors.muted }]}>{text}</Text>
    </Reanimated.View>
  );
}

// ---------------------------------------------------------------- screen
/**
 * First-run introduction (before sign-in): 4 slides — swipe to learn (a card
 * to try), ready + community decks, your own decks, a little every day (daily
 * goal). "Atla" jumps to the last slide; there "Hemen Başla" opens sign-up and
 * "Zaten hesabım var" opens sign-in.
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const onFinish = useContext(OnboardingFinishContext);
  const pagerRef = useRef(null);
  const [page, setPage] = useState(0);
  const [goal, setGoal] = useState(null);
  const isLast = page === SLIDE_COUNT - 1;
  const position = useSharedValue(0); // pager position (page + offset)
  // the pager swipes everywhere except while a finger is on slide 1's card
  const [cardTouched, setCardTouched] = useState(false);

  const slides = [
    { key: 'learn', title: t('onboarding.learnTitle', 'Kaydırarak öğren'), text: t('onboarding.learnText', 'Bildiğini sağa, tekrar etmek istediğini sola kaydır. Ne zaman tekrar göreceğine sen karar ver.'), body: <SwipeDemo onTouchCard={setCardTouched} /> },
    { key: 'decks', title: t('onboarding.decksTitle', 'Hazır desteler'), text: t('onboarding.decksText', "Knowia'nın hazır desteleriyle hemen başla ya da topluluğun paylaştıklarını keşfet."), body: <DecksVisual /> },
    { key: 'create', title: t('onboarding.createTitle', 'Kendi desten'), text: t('onboarding.createText', 'Kartlarını tek tek yaz ya da CSV ile yüzlercesini birden ekle. İstersen toplulukla paylaş.'), body: <CreateVisual /> },
    { key: 'daily', title: t('onboarding.dailyTitle', 'Her gün biraz'), text: t('onboarding.dailyText', 'Günlük hedefini seç, serini koru. Zamanı gelince küçük bir hatırlatma gelsin.'), body: <GoalPicker selected={goal} onSelect={setGoal} /> },
  ];

  const goTo = (next) => {
    const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, next));
    pagerRef.current?.setPage(clamped);
  };

  const finish = async (target) => {
    if (goal) await savePendingDailyGoal(goal);
    await onFinish?.(target);
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.root, { backgroundColor: colors.background }]}>
      {/* soft glow from the top */}
      <LinearGradient
        colors={[ACCENT + '1F', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.topBar}>
        {!isLast ? (
          <Pressable onPress={() => goTo(SLIDE_COUNT - 1)} hitSlop={12} style={({ pressed }) => [styles.skip, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={[styles.skipText, { color: colors.muted }]}>{t('onboarding.skip', 'Atla')}</Text>
          </Pressable>
        ) : null}
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        scrollEnabled={!cardTouched}
        onPageScroll={(e) => { position.value = e.nativeEvent.position + e.nativeEvent.offset; }}
        onPageSelected={(e) => setPage(e.nativeEvent.position)}
      >
        {slides.map((slide, i) => (
          <View key={slide.key} style={styles.page}>
            <View style={styles.body}>{slide.body}</View>
            <SlideText index={i} position={position} title={slide.title} text={slide.text} colors={colors} />
          </View>
        ))}
      </PagerView>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <View
              key={slide.key}
              style={[styles.dot, i === page ? styles.dotActive : null, { backgroundColor: i <= page ? ACCENT : colors.cardBorder }]}
            />
          ))}
        </View>
        <CreateButton
          onPress={() => (isLast ? finish('register') : goTo(page + 1))}
          text={isLast ? t('onboarding.start', 'Hemen Başla') : t('onboarding.next', 'İleri')}
          style={styles.primary}
        />
        <Pressable
          onPress={() => finish('login')}
          disabled={!isLast}
          hitSlop={8}
          style={({ pressed }) => [styles.secondary, { opacity: isLast ? (pressed ? 0.6 : 1) : 0 }]}
        >
          <Text style={[styles.secondaryText, { color: colors.muted }]}>{t('onboarding.haveAccount', 'Zaten hesabım var')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { height: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 20 },
  skip: { paddingVertical: 6, paddingHorizontal: 4 },
  skipText: { fontSize: fontSizes.subhead, fontFamily: fonts.semibold },
  pager: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 24 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textBlock: { alignItems: 'center', paddingTop: 8, paddingBottom: 12, minHeight: 112 },
  title: { fontSize: fontSizes.title2, fontFamily: fonts.bold, textAlign: 'center', marginBottom: 8 },
  text: { fontSize: fontSizes.subhead, fontFamily: fonts.regular, lineHeight: 21, textAlign: 'center', maxWidth: 320 },

  bottom: { paddingHorizontal: 24, paddingTop: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 20 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { width: 20 },
  primary: { flex: 0, alignSelf: 'stretch' },
  secondary: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  secondaryText: { fontSize: fontSizes.subhead, fontFamily: fonts.semibold },

  // slide 1
  demo: { alignItems: 'center', justifyContent: 'center' },
  demoLayer: { position: 'absolute', top: 0, left: 0 },
  demoCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  demoMiddle: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  demoBehind: { borderWidth: StyleSheet.hairlineWidth, transform: [{ scale: 0.92 }, { translateY: 16 }], opacity: 0.6 },
  demoFace: { backfaceVisibility: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  demoLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fonts.semibold,
    color: 'rgba(255, 255, 255, 0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  demoWord: { fontSize: fontSizes.title1, fontFamily: fonts.bold, textAlign: 'center', paddingHorizontal: 8 },
  demoTapHint: { height: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  demoTapText: { fontSize: fontSizes.caption, fontFamily: fonts.medium, color: 'rgba(255, 255, 255, 0.85)' },
  dragTag: { position: 'absolute', top: 56, borderWidth: 2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(0, 0, 0, 0.25)' },
  dragTagRight: { left: 18, transform: [{ rotate: '-10deg' }] },
  dragTagLeft: { right: 18, transform: [{ rotate: '10deg' }] },
  dragTagText: { fontSize: fontSizes.subhead, fontFamily: fonts.bold, textTransform: 'uppercase' },
  demoFooter: { height: 44, marginTop: 24, justifyContent: 'center' },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedbackText: { fontSize: fontSizes.subhead, fontFamily: fonts.semibold },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hintSide: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { fontSize: fontSizes.footnote, fontFamily: fonts.semibold },
  hintDivider: { width: 1, height: 14 },

  // slide 2
  visual: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 260 },
  deckTile: {
    position: 'absolute',
    width: 128,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    padding: 10,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  deckWatermark: { position: 'absolute', left: -48, top: 0, bottom: 0, justifyContent: 'center' },
  deckUser: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  deckAvatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.4)' },
  deckUserText: { flexShrink: 1, fontSize: fontSizes.caption, fontFamily: fonts.semibold, color: 'rgba(255, 255, 255, 0.85)' },
  deckName: { fontSize: fontSizes.body, fontFamily: fonts.semibold, color: '#F0F0F0', textAlign: 'center' },
  deckCount: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  deckCountText: { fontSize: fontSizes.caption, fontFamily: fonts.bold, color: '#FFFFFF' },

  // slide 3
  mockCard: { width: '100%', maxWidth: 320, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 14 },
  mockField: { gap: 8 },
  mockLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mockLabel: { fontSize: fontSizes.subhead, fontFamily: fonts.semibold },
  mockBox: { height: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
  mockValue: { fontSize: fontSizes.body, fontFamily: fonts.regular },
  mockChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mockChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  mockChipText: { fontSize: fontSizes.footnote, fontFamily: fonts.semibold },

  // slide 4
  goals: { width: '100%', maxWidth: 360, gap: 10, alignItems: 'stretch' },
  goalIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 8 },
  goalRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  goalTextCol: { flex: 1 },
  goalTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  goalMeta: { fontSize: fontSizes.footnote, fontFamily: fonts.regular, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ACCENT },
  goalHint: { fontSize: fontSizes.caption, fontFamily: fonts.regular, textAlign: 'center', marginTop: 4 },
});
