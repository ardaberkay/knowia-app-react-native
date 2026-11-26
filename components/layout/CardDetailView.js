import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Image, Platform, TouchableOpacity } from 'react-native';
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
import { Iconify } from 'react-native-iconify';
import { Text } from '../ui/AppText';
import StackCarousel from '../ui/StackCarousel';
import { Pill, SectionDivider } from './SwipeFlipCard';
import { useTheme } from '../../theme/theme';
import { getCategoryColors } from '../../theme/colors';
import { typography, fontSizes, fonts, lineHeights } from '../../theme/typography';
import { triggerHaptic } from '../../lib/hapticManager';

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

// A card in the slider. Flips on the UI thread with nothing re-rendering; a
// flipped card turns back once it leaves the front.
const FlipCard = memo(({ card, index, width, height, progress, registerFlip, colors, t }) => {
  const flip = useSharedValue(0); // 0 = question side, 1 = answer side

  const toggle = useCallback(() => {
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

  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [
      { perspective: 1000 },
      { rotateY: `${flip.value * 180}deg` },
      { scale: interpolate(flip.value, [0, 0.5, 1], [1, FLIP_MID_SCALE, 1]) },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 0 : 1,
    transform: [
      { perspective: 1000 },
      { rotateY: `${flip.value * 180 - 180}deg` },
      { scale: interpolate(flip.value, [0, 0.5, 1], [1, FLIP_MID_SCALE, 1]) },
    ],
  }));

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
      <Reanimated.View style={[styles.face, backStyle]}>
        <CardFace
          {...faceProps}
          text={card?.answer || t('cardDetail.noAnswer', 'Cevap yok')}
          numberOfLines={5}
        />
      </Reanimated.View>
    </View>
  );
});

// The category watermark is only used on deck cards, not on single cards.
// Only the ⓘ icon: the slider renders many cards, keep each one light.
function CardFace({ gradientColors, colors, text, numberOfLines }) {
  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.faceGradient}>
      <View style={styles.faceContent}>
        <Text style={[styles.faceText, { color: colors.headText }]} numberOfLines={numberOfLines}>
          {text}
        </Text>
      </View>
      {/* Opens the detail; the tap itself is handled by the carousel. */}
      <View style={styles.detailButton}>
        <Iconify icon="material-symbols:info-outline" size={20} color="#FFFFFF" />
      </View>
    </LinearGradient>
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
 *   onToggleFavorite(card) + isFavorite — the heart.
 *   onReport(card) — runs after the sheet has closed (it opens its own sheet).
 *   onEdit(card) — in the ⋯ menu; runs after the sheet has closed (it opens
 *     the edit page).
 *   onDelete(card) — in the ⋯ menu; the screen confirms and deletes.
 */
export default function CardDetailSheet({
  card,
  visible,
  onDismiss,
  isFavorite = false,
  onToggleFavorite,
  onReport,
  onEdit,
  onDelete,
  showCreatedAt = false,
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const sheetRef = useRef(null);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const closeThen = useCallback((action) => {
    sheetRef.current?.dismiss();
    setTimeout(action, AFTER_DISMISS_MS);
  }, []);

  // The native menu keeps its first handlers; read the current ones.
  const menuActionsRef = useRef({});
  menuActionsRef.current = {
    edit: () => onEdit && closeThen(() => onEdit(card)),
    delete: () => onDelete?.(card),
  };
  const menuActions = [
    onEdit ? { id: 'edit', title: t('cardDetail.edit', 'Kartı Düzenle'), image: 'pencil' } : null,
    onDelete ? { id: 'delete', title: t('cardDetail.delete', 'Kartı Sil'), image: 'trash', attributes: { destructive: true } } : null,
  ].filter(Boolean);

  const headerButtonStyle = [styles.headerButton, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }];

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={FULL_SCREEN}
      enablePanDownToClose
      index={0}
      onChange={(index) => {
        if (index === -1) onDismiss?.();
      }}
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
    >
      <View style={styles.sheetHeader}>
        <TouchableOpacity
          onPress={() => sheetRef.current?.dismiss()}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t('cardDetail.close', 'Kapat')}
          style={headerButtonStyle}
        >
          <Iconify icon="material-symbols:close-rounded" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.sheetHeaderActions}>
          {card && onToggleFavorite ? (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('medium');
                onToggleFavorite(card);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              style={headerButtonStyle}
            >
              <Iconify
                icon={isFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={20}
                color={isFavorite ? '#F98A21' : colors.text}
              />
            </TouchableOpacity>
          ) : null}
          {card && onReport ? (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                closeThen(() => onReport(card));
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              style={headerButtonStyle}
            >
              <Iconify icon="ic:round-report-problem" size={20} color="#FED7AA" />
            </TouchableOpacity>
          ) : null}
          {card && menuActions.length > 0 ? (
            <MenuView
              actions={menuActions}
              onOpenMenu={() => triggerHaptic('light')}
              onPressAction={({ nativeEvent }) => menuActionsRef.current[nativeEvent.event]?.()}
              style={styles.headerMenuHost}
            >
              <View style={headerButtonStyle}>
                <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={22} color={colors.text} />
              </View>
            </MenuView>
          ) : null}
        </View>
      </View>

      <BottomSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        {card ? <CardDetailContent card={card} colors={colors} showCreatedAt={showCreatedAt} /> : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// The card's content in the card look. Deck order is kept: question first.
function CardDetailContent({ card, colors, showCreatedAt }) {
  const { t, i18n } = useTranslation();
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => {
    setImageLoaded(false);
  }, [card.id, card.image]);

  const extras = [
    card.example ? {
      key: 'example',
      label: t('swipeDeck.example', 'Örnek'),
      icon: 'lucide:lightbulb',
      text: card.example,
      style: null,
    } : null,
    card.note ? {
      key: 'note',
      label: t('swipeDeck.note', 'Not'),
      icon: 'material-symbols-light:stylus-note',
      text: card.note,
      style: styles.noteText,
    } : null,
  ].filter(Boolean);

  return (
    <>
      <View style={styles.detailCard}>
        <LinearGradient
          colors={getCategoryColors(colors, card.deck?.categories?.sort_order)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.detailSection}>
          <Pill
            label={t('cardDetail.question', 'Soru')}
            icon={<Iconify icon="uil:comment-alt-question" size={18} color="#fff" />}
          />
          {card.image ? (
            <View style={styles.imageBox}>
              {!imageLoaded ? <View style={styles.imagePlaceholder} /> : null}
              <Image
                source={{ uri: card.image }}
                style={[styles.image, !imageLoaded && { opacity: 0 }]}
                onLoadEnd={() => setImageLoaded(true)}
                fadeDuration={0}
              />
            </View>
          ) : null}
          {card.question ? <Text style={[typography.styles.title2, styles.primaryText]}>{card.question}</Text> : null}
        </View>

        <SectionDivider />
        <View style={styles.detailSection}>
          <Pill
            label={t('swipeDeck.answer', 'Cevap')}
            icon={<Iconify icon="uil:comment-alt-check" size={18} color="#fff" />}
          />
          <Text style={[typography.styles.title2, styles.primaryText]}>
            {card.answer || t('cardDetail.noAnswer', 'Cevap yok')}
          </Text>
        </View>

        {extras.map((section) => (
          <React.Fragment key={section.key}>
            <SectionDivider />
            <View style={styles.detailSection}>
              <Pill label={section.label} icon={<Iconify icon={section.icon} size={18} color="#fff" />} />
              <Text style={[typography.styles.body, styles.subText, section.style]}>{section.text}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {showCreatedAt && card.created_at ? (
        <Text style={[typography.styles.footnote, styles.createdAt, { color: colors.muted }]}>
          {`${t('cardDetail.createdAt', 'Oluşturulma Tarihi')} ${new Date(card.created_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}`}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Slider card faces
  face: {
    ...StyleSheet.absoluteFill,
    backfaceVisibility: 'hidden',
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
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  // Same as the swipe screen's "see more" sheet card.
  detailCard: {
    borderRadius: 26,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 8,
  },
  detailSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: lineHeights.title2,
  },
  subText: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  noteText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontStyle: 'italic',
  },
  imageBox: {
    width: '100%',
    height: 180,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  image: {
    width: '100%',
    height: 180,
    resizeMode: 'contain',
    borderRadius: 24,
  },
  createdAt: {
    textAlign: 'center',
    marginTop: 16,
  },
});
