import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Image, Platform, TouchableOpacity, useWindowDimensions } from 'react-native';
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BottomSheetModal, BottomSheetScrollView } from '@expo/ui/community/bottom-sheet';
import { MenuView } from '@expo/ui/community/menu';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/AppText';
import StackCarousel from '../ui/StackCarousel';
import { formatFutureReview } from './SwipeCompletionView';
import { ShimmerBox } from '../skeleton/DeckSkeleton';
import { useTheme } from '../../theme/theme';
import { getCategoryColors } from '../../theme/colors';
import { getCategoryIcon, ICONS } from '../../theme/icons';
import PhosphorIcon from '../ui/PhosphorIcon';
import { typography, fontSizes, fonts, lineHeights } from '../../theme/typography';
import { triggerHaptic } from '../../lib/hapticManager';
import { isSpeechAvailable, useSpeakText } from '../../lib/speech';
import { useAuth } from '../../contexts/AuthContext';
import { getCardProgress } from '../../services/CardService';

/**
 * Card browsing and card detail, used by the cards pages (deck, chapter,
 * favourite cards) and the Library:
 *
 *   CardStackSlider — the cards in a deck carousel at the top of a cards
 *     list. Tap the front card to flip it; its ⓘ corner opens the detail.
 *   CardDetailSheet (default) — the full-screen detail sheet: the card's
 *     content in the card look (category gradient, pill headings, dividers;
 *     same as the swipe screen's "see more" sheet) and its actions (close,
 *     favourite, report, edit / delete).
 */

// --- CardStackSlider ---

const SLIDER_CARD_MAX_WIDTH = 220;
const SLIDER_CARD_WIDTH_RATIO = 0.56;
const CARD_ASPECT_RATIO = 315 / 240;
const CARD_RADIUS = 20;
// Slow enough that the edge-on moment (90°, where the faces swap) spans
// several frames instead of reading as a flash; the card dips a little in
// the middle of the turn.
const FLIP_TIMING = { duration: 420, easing: Easing.inOut(Easing.cubic) };
const FLIP_MID_SCALE = 0.92;
// Bottom-right corner of the front card that opens the detail (the ⓘ button
// sits in it; a bit larger than the button so it is easy to hit).
const DETAIL_HOT_SPOT = 56;

export const CardStackSlider = memo(function CardStackSlider({ cards, onOpenDetail, onEndReached }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  // Each card registers its flip; a tap on the front card (reported by the
  // carousel with the tap point) flips it, or opens the detail from the ⓘ
  // corner.
  const flipsRef = useRef(new Map());
  const registerFlip = useCallback((id, flip) => {
    flipsRef.current.set(id, flip);
    return () => {
      if (flipsRef.current.get(id) === flip) flipsRef.current.delete(id);
    };
  }, []);
  // Callbacks are read through refs (see the memo comparison below).
  const onOpenDetailRef = useRef(onOpenDetail);
  onOpenDetailRef.current = onOpenDetail;
  const onEndReachedRef = useRef(onEndReached);
  onEndReachedRef.current = onEndReached;
  const handleEndReached = useCallback(() => onEndReachedRef.current?.(), []);
  const handleFrontPress = useCallback((item, index, point) => {
    const inDetailSpot = point
      && point.x >= point.width - DETAIL_HOT_SPOT
      && point.y >= point.height - DETAIL_HOT_SPOT;
    if (inDetailSpot) {
      triggerHaptic('light');
      onOpenDetailRef.current?.(item);
      return;
    }
    flipsRef.current.get(item?.id)?.();
  }, []);

  const renderCard = useCallback(({ item, index, width, height, progress }) => (
    <FlipCard
      card={item}
      index={index}
      width={width}
      height={height}
      progress={progress}
      registerFlip={registerFlip}
      colors={colors}
      t={t}
    />
  ), [colors, registerFlip, t]);

  return (
    <StackCarousel
      items={cards}
      keyExtractor={cardKey}
      renderItem={renderCard}
      variant="deck"
      onFrontPress={handleFrontPress}
      onEndReached={handleEndReached}
      widthRatio={SLIDER_CARD_WIDTH_RATIO}
      maxWidth={SLIDER_CARD_MAX_WIDTH}
      aspectRatio={CARD_ASPECT_RATIO}
      radius={CARD_RADIUS}
      activeColor={colors.buttonColor}
      inactiveColor={colors.muted}
      paddingTop={16}
      dotsGap={18}
    />
  );
// Re-render only for a new card list: screens pass loadMore, whose identity
// changes with their loading state (twice per page), and a re-render of the
// carousel mid-swipe stalls it.
}, (prev, next) => prev.cards === next.cards);

const cardKey = (card, index) => (card?.id ? String(card.id) : `card-${index}`);

// A card in the slider. Flips on the UI thread; a flipped card turns back
// once it leaves the front.
//
// Kept cheap to draw, because the whole slider is redrawn on every frame of
// a sheet's open / close animation (iOS scales the page behind it):
//   - the answer face mounts on the card's first flip only;
//   - the 3D transform (perspective) is applied only while it turns, so a
//     resting card is a flat layer;
//   - each face is rasterized (shouldRasterizeIOS): its rounded gradient
//     (clipped, an offscreen pass) is drawn once and reused while the card
//     moves, scales or turns.
const FlipCard = memo(({ card, index, width, height, progress, registerFlip, colors, t }) => {
  const flip = useSharedValue(0); // 0 = question side, 1 = answer side
  const [hasBack, setHasBack] = useState(false);

  const toggle = useCallback(() => {
    setHasBack(true);
    flip.value = withTiming(flip.value > 0.5 ? 0 : 1, FLIP_TIMING);
  }, [flip]);
  useEffect(() => registerFlip(card?.id, toggle), [card?.id, registerFlip, toggle]);

  useAnimatedReaction(
    () => Math.abs(progress.value - index) > 0.5,
    (away, wasAway) => {
      if (away && !wasAway && flip.value > 0) flip.value = withTiming(0, FLIP_TIMING);
    },
    [index]
  );

  // At rest (0 or 1) a flat transform; 3D only mid-turn.
  const frontStyle = useAnimatedStyle(() => {
    const turning = flip.value > 0 && flip.value < 1;
    return {
      opacity: flip.value < 0.5 ? 1 : 0,
      transform: turning
        ? [
          { perspective: 1000 },
          { rotateY: `${flip.value * 180}deg` },
          { scale: interpolate(flip.value, [0, 0.5, 1], [1, FLIP_MID_SCALE, 1]) },
        ]
        : [{ scale: 1 }],
    };
  });
  const backStyle = useAnimatedStyle(() => {
    const turning = flip.value > 0 && flip.value < 1;
    return {
      opacity: flip.value < 0.5 ? 0 : 1,
      transform: turning
        ? [
          { perspective: 1000 },
          { rotateY: `${flip.value * 180 - 180}deg` },
          { scale: interpolate(flip.value, [0, 0.5, 1], [1, FLIP_MID_SCALE, 1]) },
        ]
        : [{ scale: 1 }],
    };
  });

  const faceProps = {
    gradientColors: getCategoryColors(colors, card?.deck?.categories?.sort_order),
    colors,
  };

  return (
    <View style={{ width, height }}>
      <Reanimated.View style={[styles.face, frontStyle]}>
        <CardFace
          {...faceProps}
          text={card?.question || card?.name || card?.title || t('cardDetail.unnamed', 'İsimsiz Kart')}
          numberOfLines={4}
        />
      </Reanimated.View>
      {hasBack ? (
        <Reanimated.View style={[styles.face, backStyle]}>
          <CardFace
            {...faceProps}
            text={card?.answer || t('cardDetail.noAnswer', 'Cevap yok')}
            numberOfLines={5}
          />
        </Reanimated.View>
      ) : null}
    </View>
  );
});

// The category watermark is only used on deck cards, not on single cards.
// Only the ⓘ icon: the slider renders many cards, keep each one light.
function CardFace({ gradientColors, colors, text, numberOfLines }) {
  return (
    <View style={styles.faceRaster} shouldRasterizeIOS collapsable={false}>
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.faceGradient}>
      <View style={styles.faceContent}>
        <Text style={[styles.faceText, { color: colors.headText }]} numberOfLines={numberOfLines}>
          {text}
        </Text>
      </View>
      {/* Opens the detail; the tap itself is handled by the carousel. */}
      <View style={styles.detailButton}>
        <PhosphorIcon icon={ICONS.info} size={20} color="#FFFFFF" />
      </View>
    </LinearGradient>
    </View>
  );
}

// --- CardDetailSheet ---

const FULL_SCREEN = ['100%'];
const AFTER_DISMISS_MS = 350; // the sheet's close animation

/**
 * Full-screen detail sheet of one card. Opens when `visible` turns true;
 * `onDismiss` is called once it has closed (button, swipe down or action).
 *
 * Actions are optional; each shows only when its handler is given:
 *   onToggleFavorite(card) + isFavorite — in the ⋯ menu (add / remove,
 *     with a filled heart when it is a favourite).
 *   onReport(card) — in the ⋯ menu; runs after the sheet has closed (it
 *     opens its own sheet).
 *   onEdit(card) — in the ⋯ menu; runs after the sheet has closed (it opens
 *     the edit page).
 *   onDelete(card) — in the ⋯ menu; the screen confirms and deletes.
 *
 * With no action given there is no menu, and the ✕ sits on the right.
 *
 * deck ({ id, name, to_name, categories }) is the card's deck when the card
 * itself doesn't carry it (cards fetched for one deck); card.deck wins.
 * showLearningStatus / enableSpeech: the learning status section and the 🔊
 * buttons (both on by default; the swipe screen's "see more" turns them off).
 */
export default function CardDetailSheet({
  card,
  deck,
  visible,
  onDismiss,
  isFavorite = false,
  onToggleFavorite,
  onReport,
  onEdit,
  onDelete,
  showCreatedAt = false,
  showLearningStatus = true,
  enableSpeech = true,
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const sheetRef = useRef(null);
  const cardDeck = card?.deck || deck || null;
  // Content vs visible height: the content scrolls only when it is taller.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  // No deck id = nothing loaded for speech.
  const { speakingKey, speak, stop: stopSpeaking } = useSpeakText(
    enableSpeech ? (cardDeck?.id ?? card?.deck_id ?? null) : null
  );

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);
  // Reading ends with the sheet or when another card is shown.
  useEffect(() => {
    if (!visible) stopSpeaking();
  }, [stopSpeaking, visible]);
  useEffect(() => stopSpeaking, [card?.id, stopSpeaking]);

  const closeThen = useCallback((action) => {
    sheetRef.current?.dismiss();
    setTimeout(action, AFTER_DISMISS_MS);
  }, []);

  // The native menu keeps its first handlers; read the current ones.
  const menuActionsRef = useRef({});
  menuActionsRef.current = {
    favorite: () => {
      if (!onToggleFavorite) return;
      triggerHaptic('medium');
      onToggleFavorite(card);
    },
    report: () => onReport && closeThen(() => onReport(card)),
    edit: () => onEdit && closeThen(() => onEdit(card)),
    delete: () => onDelete?.(card),
  };
  const menuActions = [
    onToggleFavorite ? {
      id: 'favorite',
      title: isFavorite
        ? t('cardDetail.removeFavorite', 'Favorilerden çıkar')
        : t('cardDetail.addFavorite', 'Favorilere ekle'),
      image: isFavorite ? 'heart.fill' : 'heart',
    } : null,
    onReport ? { id: 'report', title: t('moderation.reportCard', 'Kartı şikayet et'), image: 'exclamationmark.bubble' } : null,
    onEdit ? { id: 'edit', title: t('cardDetail.edit', 'Kartı Düzenle'), image: 'pencil' } : null,
    onDelete ? { id: 'delete', title: t('cardDetail.delete', 'Kartı Sil'), image: 'trash', attributes: { destructive: true } } : null,
  ].filter(Boolean);

  const headerButtonStyle = [styles.headerButton, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }];
  const hasMenu = Boolean(card && menuActions.length > 0);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={FULL_SCREEN}
      enablePanDownToClose
      index={0}
      onChange={(index) => {
        if (index === -1) {
          stopSpeaking();
          onDismiss?.();
        }
      }}
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
    >
      <View style={[styles.sheetHeader, !hasMenu && styles.sheetHeaderCloseOnly]}>
        <TouchableOpacity
          onPress={() => sheetRef.current?.dismiss()}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t('cardDetail.close', 'Kapat')}
          style={headerButtonStyle}
        >
          <PhosphorIcon icon={ICONS.close} size={22} color={colors.text} />
        </TouchableOpacity>
        {hasMenu ? (
          <View style={styles.sheetHeaderActions}>
            <MenuView
              actions={menuActions}
              onOpenMenu={() => triggerHaptic('light')}
              onPressAction={({ nativeEvent }) => menuActionsRef.current[nativeEvent.event]?.()}
              style={styles.headerMenuHost}
            >
              <View style={headerButtonStyle}>
                <PhosphorIcon icon={ICONS.more} size={22} color={colors.text} />
              </View>
            </MenuView>
          </View>
        ) : null}
      </View>

      {/* A pull down on short content goes straight to the sheet: no bounce,
          no automatic inset, no scrolling when the content fits. (The sheet's
          stuttering close came from the slider behind it, see FlipCard.) */}
      <BottomSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentInsetAdjustmentBehavior="never"
        scrollEnabled={contentHeight > viewportHeight + 1}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContentHeight(h)}
      >
        {card ? (
          <CardDetailContent
            card={card}
            deck={cardDeck}
            colors={colors}
            showCreatedAt={showCreatedAt}
            speakingKey={speakingKey}
            onSpeak={enableSpeech ? speak : null}
            showLearningStatus={showLearningStatus}
          />
        ) : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// The card as a reading page: deck / category, question, image, answer on a
// surface, example and note, the user's learning state, created date.
// Sections without content don't show.
function CardDetailContent({ card, deck, colors, showCreatedAt, speakingKey, onSpeak, showLearningStatus = true }) {
  const { t, i18n } = useTranslation();
  const { isDarkMode } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => {
    setImageLoaded(false);
  }, [card.id, card.image]);

  // undefined while loading, null when never studied.
  const [progress, setProgress] = useState(undefined);
  useEffect(() => {
    if (!showLearningStatus || !userId || !card.id) return undefined;
    let cancelled = false;
    setProgress(undefined);
    getCardProgress(userId, card.id)
      .then((row) => { if (!cancelled) setProgress(row); })
      .catch(() => { if (!cancelled) setProgress(null); });
    return () => { cancelled = true; };
  }, [card.id, showLearningStatus, userId]);

  const sortOrder = deck?.categories?.sort_order;
  const categoryColors = getCategoryColors(colors, sortOrder);
  const accent = categoryColors[0];
  const categoryName = sortOrder != null
    ? t(`categories.${sortOrder}`, deck?.categories?.name || '')
    : deck?.categories?.name;
  const deckTitle = deck?.name && deck?.to_name ? `${deck.name} → ${deck.to_name}` : deck?.name;
  const label = (text) => text.toLocaleUpperCase(i18n.language);
  const question = card.question || t('cardDetail.unnamed', 'İsimsiz Kart');
  const answer = card.answer || t('cardDetail.noAnswer', 'Cevap yok');

  return (
    <>
      {/* Category colour: the chip, the question block and the accent lines. */}
      {categoryName || deckTitle ? (
        <View style={styles.metaRow}>
          {categoryName ? (
            <View style={[styles.categoryChip, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
              <PhosphorIcon icon={getCategoryIcon(sortOrder)} size={14} color={accent} />
              <Text style={[styles.categoryChipText, { color: colors.text }]} numberOfLines={1}>{categoryName}</Text>
            </View>
          ) : null}
          {deckTitle ? (
            <Text style={[typography.styles.footnote, styles.deckName, { color: colors.muted }]} numberOfLines={1}>
              {deckTitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Question: the page's lead, on the category gradient. Rasterized: the
          rounded gradient is clipped (an offscreen pass), so it is drawn once
          instead of on every frame of the sheet's open / close slide. */}
      <View shouldRasterizeIOS collapsable={false} style={styles.questionHeroRaster}>
      <LinearGradient colors={categoryColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.questionHero}>
        <SectionLabel
          text={label(t('cardDetail.question', 'Soru'))}
          colors={colors}
          onColor
          speaking={speakingKey === 'question'}
          onSpeak={onSpeak && card.question ? () => onSpeak('question', card.question, 'front') : null}
        />
        <Text
          style={[
            question.length > LONG_QUESTION ? typography.styles.title2 : typography.styles.title1,
            styles.questionText,
            { lineHeight: question.length > LONG_QUESTION ? lineHeights.title2 : lineHeights.title1 },
          ]}
        >
          {question}
        </Text>
        {card.image ? (
          <View style={styles.imageBox}>
            <Image
              source={{ uri: card.image }}
              style={[styles.image, !imageLoaded && { opacity: 0 }]}
              onLoadEnd={() => setImageLoaded(true)}
              fadeDuration={0}
            />
          </View>
        ) : null}
      </LinearGradient>
      </View>

      {/* Answer, on a neutral surface under the question. */}
      <View style={[styles.answerSurface, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
        <SectionLabel
          text={label(t('cardDetail.answer', 'Cevap'))}
          colors={colors}
          speaking={speakingKey === 'answer'}
          onSpeak={onSpeak && card.answer ? () => onSpeak('answer', card.answer, 'back') : null}
          flush
        />
        <Text style={[typography.styles.title3, styles.answerText, { color: colors.text }]}>{answer}</Text>
      </View>

      {card.example ? (
        <AccentSection label={label(t('cardDetail.example', 'Örnek'))} accent={accent} colors={colors}>
          <Text style={[typography.styles.bodyLarge, styles.accentText, { color: colors.text }]}>{card.example}</Text>
        </AccentSection>
      ) : null}
      {card.note ? (
        <AccentSection label={label(t('cardDetail.note', 'Not'))} accent={accent} colors={colors}>
          <Text style={[typography.styles.bodyLarge, styles.accentText, styles.noteText, { color: colors.muted }]}>{card.note}</Text>
        </AccentSection>
      ) : null}

      {showLearningStatus && userId ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          <SectionLabel text={label(t('cardDetail.learningTitle', 'Öğrenme durumu'))} colors={colors} />
          <LearningStatus progress={progress} colors={colors} isDarkMode={isDarkMode} />
        </>
      ) : null}

      {showCreatedAt && card.created_at ? (
        <Text style={[typography.styles.footnote, styles.createdAt, { color: colors.muted }]}>
          {`${t('cardDetail.createdAt', 'Oluşturulma Tarihi')}: ${new Date(card.created_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}`}
        </Text>
      ) : null}
    </>
  );
}

// Questions longer than this use the smaller title size.
const LONG_QUESTION = 60;

// A small spaced caption over a section, with an optional speaker button.
// onColor: white version for the gradient question block.
function SectionLabel({ text, colors, speaking = false, onSpeak, flush = false, onColor = false }) {
  const { t } = useTranslation();
  const buttonLook = onColor
    ? {
      borderColor: speaking ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)',
      backgroundColor: speaking ? 'rgba(255, 255, 255, 0.32)' : 'rgba(255, 255, 255, 0.16)',
    }
    : { borderColor: speaking ? colors.buttonColor : colors.cardBorder, backgroundColor: colors.background };
  const iconColor = onColor ? '#FFFFFF' : (speaking ? colors.buttonColor : colors.text);
  return (
    <View style={[styles.sectionLabelRow, flush && styles.sectionLabelRowFlush]}>
      <Text style={[styles.sectionLabel, { color: onColor ? 'rgba(255, 255, 255, 0.78)' : colors.muted }]}>{text}</Text>
      {onSpeak && isSpeechAvailable ? (
        <TouchableOpacity
          onPress={() => {
            triggerHaptic('light');
            onSpeak();
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('cardDetail.speak', 'Sesli oku')}
          style={[styles.speakButton, buttonLook]}
        >
          <PhosphorIcon icon={ICONS.speak} size={16} color={iconColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Example / note: a caption and text beside a thin line in the category colour.
function AccentSection({ label, accent, colors, children }) {
  return (
    <View style={styles.accentSection}>
      <View style={[styles.accentLine, { backgroundColor: accent }]} />
      <View style={styles.accentBody}>
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

// The user's progress on the card: undefined = loading, null = never studied.
function LearningStatus({ progress, colors, isDarkMode }) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  if (progress === undefined) {
    return (
      <ShimmerBox
        isDarkMode={isDarkMode}
        screenWidth={windowWidth}
        duration={2000}
        borderRadius={16}
        style={[styles.statusSurface, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
      >
        <View style={styles.statusPlaceholder} />
      </ShimmerBox>
    );
  }
  let dot = colors.muted;
  let title = t('cardDetail.statusNew', 'Henüz çalışılmadı');
  let detail = null;
  if (progress?.status === 'learned') {
    dot = colors.success;
    title = t('cardDetail.statusLearned', 'Öğrenildi');
  } else if (progress) {
    dot = colors.buttonColor;
    const due = !progress.next_review || new Date(progress.next_review).getTime() <= Date.now();
    if (due) {
      title = t('cardDetail.statusDue', 'Tekrar zamanı geldi');
    } else {
      title = t('cardDetail.statusLearning', 'Öğreniliyor');
      detail = t('cardDetail.nextReview', {
        time: formatFutureReview(progress.next_review, t),
        defaultValue: `Sonraki tekrar: ${formatFutureReview(progress.next_review, t)}`,
      });
    }
  }
  return (
    <View style={[styles.statusSurface, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      <View style={[styles.statusDot, { backgroundColor: dot }]} />
      <View style={styles.statusTexts}>
        <Text style={[typography.styles.headline, { color: colors.text }]}>{title}</Text>
        {detail ? <Text style={[typography.styles.subhead, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Slider card faces
  face: {
    ...StyleSheet.absoluteFill,
    backfaceVisibility: 'hidden',
  },
  faceRaster: {
    flex: 1,
  },
  faceGradient: {
    flex: 1,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  faceContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 44,
  },
  faceText: {
    fontSize: fontSizes.bodyLarge,
    fontFamily: fonts.bold,
    lineHeight: lineHeights.bodyLarge,
    textAlign: 'center',
  },
  detailButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Detail sheet
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 10,
  },
  // Only the ✕: on the right.
  sheetHeaderCloseOnly: {
    justifyContent: 'flex-end',
  },
  sheetHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMenuHost: {
    width: 36,
    height: 36,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },

  // Reading page
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  questionHeroRaster: {
    marginBottom: 16,
  },
  questionHero: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  categoryChipText: {
    fontSize: fontSizes.caption,
    fontFamily: fonts.semibold,
  },
  deckName: {
    flex: 1,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    marginBottom: 6,
  },
  sectionLabelRowFlush: {
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: fontSizes.micro,
    fontFamily: fonts.semibold,
    letterSpacing: 1.2,
  },
  speakButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionText: {
    color: '#FFFFFF',
  },
  imageBox: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.14)',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  answerSurface: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    marginBottom: 24,
  },
  answerText: {
    lineHeight: lineHeights.title3,
  },
  accentSection: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  accentLine: {
    width: 3,
    borderRadius: 2,
    marginRight: 12,
  },
  accentBody: {
    flex: 1,
    gap: 6,
  },
  accentText: {
    lineHeight: lineHeights.bodyLarge,
  },
  noteText: {
    fontStyle: 'italic',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 4,
    marginBottom: 16,
  },
  statusSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusPlaceholder: {
    height: 40,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTexts: {
    flex: 1,
    gap: 2,
  },
  createdAt: {
    marginTop: 20,
  },
});
