import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import Reanimated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '../ui/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/theme';
import { getCategoryColors } from '../../theme/colors';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import Svg, { Path } from 'react-native-svg';
import StackCarousel from '../ui/StackCarousel';

// Card size in the carousel: 240 × 315 at most (61% of the width on narrow
// phones), same proportions as before.
const CARD_MAX_WIDTH = 240;
const CARD_WIDTH_RATIO = 0.61;
const CARD_ASPECT_RATIO = 315 / 240;
const CARD_RADIUS = 20;
const FLIP_DURATION = 300;

/**
 * Card detail: the deck's cards in a deck carousel (swipe, or tap a card
 * behind to bring it up; tap the front card to flip it) and the selected
 * card's content under it.
 *
 * `card` is the selected card, `cards` the list it belongs to,
 * `onSelectCard(card)` is called when another card comes to the front (the
 * parent may fetch its details and pass them back as `card`), and
 * `onEndReached()` (optional) near the end of `cards`, to load the next page
 * so the carousel keeps going.
 */
export default function CardDetailView({ card, cards = [], onSelectCard, onEndReached, showCreatedAt = true, isDeckOwner = false }) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const carouselRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const currentIndex = useMemo(() => {
    const idx = cards.findIndex((c) => c?.id === card?.id);
    return idx >= 0 ? idx : 0;
  }, [cards, card?.id]);

  // The carousel reports the card it brought to the front; the parent then
  // selects it. When the selection changes from outside (e.g. the card was
  // deleted and the next one is selected), move the carousel to it.
  const frontIndexRef = useRef(currentIndex);
  const handleFrontChange = useCallback((index) => {
    frontIndexRef.current = index;
    const next = cards[index];
    if (next && next.id !== card?.id) onSelectCard?.(next);
  }, [cards, card?.id, onSelectCard]);
  useEffect(() => {
    if (currentIndex !== frontIndexRef.current) {
      frontIndexRef.current = currentIndex;
      carouselRef.current?.scrollToIndex(currentIndex);
    }
  }, [currentIndex]);

  useEffect(() => {
    setImageLoaded(false);
  }, [card?.id, card?.image]);

  // Each card registers its flip; a tap on the front card (reported by the
  // carousel) runs it.
  const flipsRef = useRef(new Map());
  const registerFlip = useCallback((id, flip) => {
    flipsRef.current.set(id, flip);
    return () => {
      if (flipsRef.current.get(id) === flip) flipsRef.current.delete(id);
    };
  }, []);
  const handleFrontPress = useCallback((item) => {
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

  if (!card) return null;

  const sections = [
    { key: 'question', icon: 'uil:comment-alt-question', label: t('cardDetail.question', 'Soru'), text: card.question },
    { key: 'answer', icon: 'uil:comment-alt-check', label: t('cardDetail.answer', 'Cevap'), text: card.answer },
    { key: 'example', icon: 'lucide:lightbulb', label: t('cardDetail.example', 'Örnek'), text: card.example },
    { key: 'note', icon: 'material-symbols-light:stylus-note', label: t('cardDetail.note', 'Not'), text: card.note },
  ].filter((section) => section.key === 'question' || section.text);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.carouselArea}>
        {/* Curved background behind the cards */}
        <View style={styles.curvedBackground}>
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
            <Path d="M0,0 L100,0 L100,70 Q75,90 50,70 Q25,50 0,70 Z" fill={colors.cardBackground} />
          </Svg>
        </View>
        <StackCarousel
          ref={carouselRef}
          items={cards}
          keyExtractor={cardKey}
          renderItem={renderCard}
          variant="deck"
          onFrontPress={handleFrontPress}
          widthRatio={CARD_WIDTH_RATIO}
          maxWidth={CARD_MAX_WIDTH}
          aspectRatio={CARD_ASPECT_RATIO}
          radius={CARD_RADIUS}
          initialIndex={currentIndex}
          onFrontChange={handleFrontChange}
          onEndReached={onEndReached}
          activeColor={colors.buttonColor}
          inactiveColor={colors.muted}
          paddingTop={27}
          dotsGap={27}
        />
      </View>

      <View style={styles.sections}>
        {card.image ? (
          <DetailSection icon="mage:image-fill" label={t('cardDetail.image', 'Kart Görseli')} colors={colors}>
            <View style={styles.imageBox}>
              {!imageLoaded && <View style={[styles.imagePlaceholder, { backgroundColor: colors.border }]} />}
              <Image
                source={{ uri: card.image }}
                style={[styles.image, !imageLoaded && { opacity: 0 }]}
                onLoadEnd={() => setImageLoaded(true)}
              />
            </View>
          </DetailSection>
        ) : null}
        {sections.map((section) => (
          <DetailSection key={section.key} icon={section.icon} label={section.label} colors={colors}>
            <Text style={[typography.styles.body, styles.sectionText, { color: colors.cardAnswerText }]}>
              {section.text}
            </Text>
          </DetailSection>
        ))}
      </View>

      {showCreatedAt && isDeckOwner && card.created_at ? (
        <Text style={[typography.styles.subhead, styles.createdAt, { color: colors.muted }]}>
          {`${t('cardDetail.createdAt', 'Oluşturulma Tarihi')} ${new Date(card.created_at).toLocaleString(i18n.language)}`}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const cardKey = (card, index) => (card?.id ? String(card.id) : `card-${index}`);

// One block under the carousel: icon + label header, then its content.
function DetailSection({ icon, label, colors, children }) {
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
        },
      ]}
    >
      <View style={[styles.sectionHeader, { borderBottomColor: colors.cardBorder }]}>
        <Iconify icon={icon} size={24} color="#F98A21" />
        <Text style={[styles.sectionLabel, { color: colors.cardQuestionText }]}>{label}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

// A card in the carousel. A tap on the front card (reported by the carousel)
// flips it, on the UI thread with nothing re-rendering; a flipped card turns
// back once it leaves the front.
const FlipCard = memo(({ card, index, width, height, progress, registerFlip, colors, t }) => {
  const flip = useSharedValue(0); // 0 = question side, 1 = answer side

  const toggle = useCallback(() => {
    flip.value = withTiming(flip.value > 0.5 ? 0 : 1, { duration: FLIP_DURATION });
  }, [flip]);
  useEffect(() => registerFlip(card?.id, toggle), [card?.id, registerFlip, toggle]);

  useAnimatedReaction(
    () => Math.abs(progress.value - index) > 0.5,
    (away, wasAway) => {
      if (away && !wasAway && flip.value > 0) flip.value = withTiming(0, { duration: FLIP_DURATION });
    },
    [index]
  );

  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 1000 }, { rotateY: `${flip.value * 180}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 0 : 1,
    transform: [{ perspective: 1000 }, { rotateY: `${flip.value * 180 - 180}deg` }],
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
          cornerIcon="uil:comment-alt-question"
          showFlipHint
          text={card?.question || card?.name || card?.title || t('cardDetail.unnamed', 'İsimsiz Kart')}
          numberOfLines={3}
        />
      </Reanimated.View>
      <Reanimated.View style={[styles.face, backStyle]}>
        <CardFace
          {...faceProps}
          cornerIcon="uil:comment-alt-check"
          text={card?.answer || t('cardDetail.noAnswer', 'Cevap yok')}
          numberOfLines={4}
        />
      </Reanimated.View>
    </View>
  );
});

// The category watermark is only used on deck cards, not on single cards.
function CardFace({ gradientColors, colors, cornerIcon, showFlipHint = false, text, numberOfLines }) {
  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.faceGradient}>
      <View style={[styles.cornerBadge, { backgroundColor: colors.buttonColor }]}>
        <Iconify icon={cornerIcon} size={26} color="rgba(255, 255, 255, 0.9)" />
      </View>
      {showFlipHint ? (
        <View style={styles.flipHint}>
          <Iconify icon="fluent:card-ui-portrait-flip-24-regular" size={24} color="rgba(255, 255, 255, 0.9)" />
        </View>
      ) : null}
      <View style={styles.faceContent}>
        <Text style={[styles.faceText, { color: colors.headText }]} numberOfLines={numberOfLines}>
          {text}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  carouselArea: {
    width: '100%',
    paddingVertical: 20,
  },
  curvedBackground: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
  },

  // Card faces
  face: {
    ...StyleSheet.absoluteFill,
    backfaceVisibility: 'hidden',
  },
  faceGradient: {
    flex: 1,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  cornerBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F98A21',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  flipHint: {
    position: 'absolute',
    top: 7,
    right: 4,
    zIndex: 1,
  },
  faceContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  faceText: {
    fontSize: fontSizes.bodyLarge,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },

  // Sections under the carousel
  sections: {
    width: '100%',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  section: {
    borderRadius: 30,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    minHeight: 140,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: fontSizes.bodyLarge,
    fontFamily: fonts.semibold,
    letterSpacing: 0.3,
  },
  sectionContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sectionText: {
    marginLeft: 24,
  },
  imageBox: {
    width: '100%',
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 12,
    opacity: 0.35,
  },
  image: {
    width: '100%',
    height: 160,
    resizeMode: 'contain',
  },
  createdAt: {
    textAlign: 'center',
    paddingHorizontal: 18,
    marginTop: 'auto',
    marginBottom: 56,
  },
});
