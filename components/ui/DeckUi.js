import React, { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { TouchableOpacity, View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import Reanimated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Text } from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import MaskedView from '@react-native-masked-view/masked-view';
import { triggerHaptic } from '../../lib/hapticManager';
import { fontSizes, fonts } from '../../theme/typography'; // Titreşim yöneticimizi ekledik

// Deck cards are always portrait rectangles: 140 wide (at most 36% of the
// screen on narrow phones) with a fixed 1:1.4 ratio, so they never turn square.
const DECK_CARD_MAX_WIDTH = 140;
const DECK_CARD_ASPECT_RATIO = 1.4;
export const useDeckCardSize = () => {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    const cardWidth = Math.min(DECK_CARD_MAX_WIDTH, width * 0.36);
    return { width: cardWidth, height: cardWidth * DECK_CARD_ASPECT_RATIO };
  }, [width]);
};

const FadeText = ({ text, style, maxWidth = 120, maxChars = 15 }) => {
  const shouldShowFade = text && text.length > maxChars;

  if (!shouldShowFade) {
    return (
      <Text
        style={[style, { maxWidth }]}
        numberOfLines={1}
        ellipsizeMode="clip" // Kısa metinlerde normal davranışı koruyoruz
      >
        {text}
      </Text>
    );
  }

  // SİHİRLİ DOKUNUŞ: Normal boşlukları "bölünemez boşluk" ile değiştiriyoruz.
  // RN bunu tek bir kelime sanıp jilet gibi "clip" yapacak, kelimeyi bütün olarak yutmayacak.
  const singleLineText = text.replace(/ /g, '\u00A0');

  return (
    <MaskedView
      style={[styles.maskedView, { maxWidth, flexDirection: 'row' }]}
      maskElement={
        <LinearGradient
          colors={['black', 'black', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.96, y: 0 }}
          style={[styles.maskGradient, { flex: 1, width: '100%' }]}
        />
      }
    >
      <Text
        style={[style, { flexShrink: 0 }]}
        numberOfLines={1}
        ellipsizeMode="clip" // Tail riskinden kurtulduk, tekrar "clip" kullanıyoruz!
      >
        {singleLineText}
      </Text>
    </MaskedView>
  );
};

// Progress yüzdesine göre chip gradient'ı — açıktan %100 (tik) paletine (#FFCC70 / #FF7505 / #D74400) doğru.
// En alt kademe daha açıktır ama tamamen soluk/krem değil; turuncu doygunluğu korunur.
const getInProgressGradient = (percent) => {
  if (percent >= 75) return ['#FFCC70', '#FF7505', '#D74400']; // %100 ile aynı üçlü (yaklaşan kademe)
  if (percent >= 50) return ['#FFC888', '#FB7A0E', '#E0500A'];
  if (percent >= 25) return ['#FFC2A0', '#F28E2C', '#D45E16'];
  return ['#FFB890', '#EA8F48', '#C66E30'];
};

// Fonksiyonu React.memo ile sarmak için const yapısına çevirdik
const DeckCard = ({
  deck,
  colors,
  typography,
  onPress,
  onToggleFavorite,
  isFavorite = false,
  showPopularityBadge = false,
  // 'default' | 'inProgress' | 'featured' (large card in DeckStackCarousel:
  // given width/height, bigger title, no heart button).
  variant = 'default',
  width,
  height,
}) => {
  const defaultSize = useDeckCardSize();
  const DECK_CARD_WIDTH = width ?? defaultSize.width;
  const DECK_CARD_HEIGHT = height ?? defaultSize.height;
  const isFeatured = variant === 'featured';

  // --- OPTIMISTIC UI: Lokal State ---
  const [localFavorite, setLocalFavorite] = useState(isFavorite);

  // Üstten gelen asıl değer değişirse (örn: sayfa yenilenirse) senkronize et
  useEffect(() => {
    setLocalFavorite(isFavorite);
  }, [isFavorite]);

  // Kalp butonuna basılınca çalışacak hızlandırılmış fonksiyon
  const handleFavoritePress = () => {
    triggerHaptic('medium'); // İsteğe göre 'selection'
    setLocalFavorite(!localFavorite); // Anında UI'ı güncelle
    onToggleFavorite(deck.id); // Arka planda Supabase/DB işlemini yap
  };
  // -----------------------------------


  const getCategoryColors = (sortOrder) => {
    if (colors.categoryColors && colors.categoryColors[sortOrder]) {
      return colors.categoryColors[sortOrder];
    }
    return ['#6F8EAD', '#3F5E78'];
  };

  const getCategoryIcon = (sortOrder) => {
    const icons = {
      1: "hugeicons:language-skill",
      2: "clarity:atom-solid",
      3: "mdi:math-compass",
      4: "game-icons:tied-scroll",
      5: "arcticons:world-geography-alt",
      6: "map:museum",
      7: "ic:outline-self-improvement",
      8: "streamline-ultimate:module-puzzle-2-bold"
    };
    return icons[sortOrder] || "material-symbols:category";
  };

  const gradientColors = getCategoryColors(deck.categories?.sort_order);
  const categoryIcon = getCategoryIcon(deck.categories?.sort_order);
  const isInProgressVariant = variant === 'inProgress';
  const progressValue = Math.max(0, Math.min(1, Number(deck?.deckProgress?.progress || 0)));
  const progressPercent = Math.round(progressValue * 100);
  const isProgressCompleted = progressPercent >= 100;
  const isProgressNearComplete = progressPercent >= 75 && progressPercent < 100;
  const inProgressGradient = getInProgressGradient(progressPercent);
  // Chip slightly bigger; overlap'i dengeleyip düşük % görünürlüğünü koruyoruz.
  const progressChipOverlap = 11;
  const progressFillMinWidth = progressPercent > 0 ? 4 : 0;

  const renderDeckTitle = (text) => {
    if (!text) return null;
    return (
      <FadeText
        text={text}
        style={[typography.styles.body, styles.deckTitleModern, isFeatured && styles.deckTitleFeatured, { color: colors.headText }]}
        maxWidth={'95%'}
        maxChars={isFeatured ? 16 : 12}
      />
    );
  };

  return (
    <View style={[styles.deckCardModern, isFeatured && styles.deckCardFeatured, { width: DECK_CARD_WIDTH, height: DECK_CARD_HEIGHT }]}>
      <TouchableOpacity
        key={`deck-${deck.id}`}
        style={styles.touchableContainer}
        onPress={() => onPress(deck)}
        // Featured cards overlap in the carousel; fading on press would show
        // the deck behind through it.
        activeOpacity={isFeatured ? 1 : 0.7}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.deckCardGradient}
        >
          {/* Background Category Icon */}
          <View style={styles.backgroundCategoryIcon}>
            <Iconify
              icon={categoryIcon}
              size={isFeatured ? 170 : 120}
              color="rgba(0, 0, 0, 0.1)"
              style={styles.categoryIconStyle}
            />
          </View>
          <View style={styles.deckCardContentModern}>
            <View style={styles.deckProfileRow}>
              <Image
                source={
                  deck.is_admin_created
                    ? require('../../assets/app_icon.png')
                    : deck.profiles?.image_url
                      ? { uri: deck.profiles.image_url }
                      : require('../../assets/avatar_default.webp')
                }
                style={styles.deckProfileAvatar}
              />
              <FadeText
                text={deck.profiles?.username || 'Kullanıcı'}
                style={[typography.styles.body, styles.deckProfileUsername]}
                maxWidth={'75%'}
                maxChars={12}
              />
            </View>
            <View style={styles.centerContentContainer}>
              <View style={styles.deckHeaderModern}>
                {deck.to_name ? (
                  <>
                    {renderDeckTitle(deck.name)}
                    <View style={{ width: 60, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 10 }} />
                    {renderDeckTitle(deck.to_name)}
                  </>
                ) : (
                  renderDeckTitle(deck.name)
                )}
              </View>
            </View>
            {!isInProgressVariant ? (
              <View style={styles.deckStatsModern}>
                {/* Popularity Badge */}
                {showPopularityBadge && deck.popularity_score && deck.popularity_score > 0 && (
                  <View style={[styles.popularityBadge, { backgroundColor: 'rgba(255, 255, 255, 0.25)' }]}>
                    <Iconify icon="mdi:fire" size={12} color="#fff" style={{ marginRight: 3 }} />
                    <Text style={[styles.popularityBadgeText, { color: '#fff' }]}>
                      {Math.round(deck.popularity_score)}
                    </Text>
                  </View>
                )}
                <View style={styles.deckCountBadge}>
                  <Iconify icon="ri:stack-fill" size={15} color="#fff" style={{ marginRight: 3 }} />
                  <Text style={[typography.styles.body, styles.deckCountBadgeText]}>{deck.card_count || 0}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Progress */}
          {isInProgressVariant && (
            <View style={styles.progressBadgeContainer}>
              <View style={[styles.deckCountBadge, styles.progressBottomBadge]}>
                <View style={[
                  styles.progressPercentChip,
                  isProgressNearComplete && styles.progressPercentChipNearComplete,
                  isProgressCompleted && styles.progressPercentChipCompleted,
                ]}>
                  <LinearGradient
                    colors={isProgressCompleted ? ['#FFCC70', '#FF7505', '#D74400'] : inProgressGradient}
                    locations={[0, 0.45, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.progressPercentChipGradient}
                  />
                  <View style={styles.progressPercentChipInner}>
                    {isProgressCompleted ? (
                      <Iconify
                        icon="streamline:check-solid"
                        size={16}
                        color="#FFFFFF"
                      />
                    ) : (
                      <>
                        <Text style={styles.progressPercentChipNumber}>{progressPercent}</Text>
                        <Text style={styles.progressPercentSign}>%</Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={styles.progressBarRow}>
                  <View style={{ width: progressChipOverlap }} />
                  <View style={styles.progressBottomTrack}>
                    <View
                      style={[
                        styles.progressBottomFill,
                        isProgressCompleted && styles.progressBottomFillCompleted,
                        {
                          width: `${progressPercent}%`,
                          minWidth: progressFillMinWidth,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}
          {!isFeatured ? (
            <TouchableOpacity
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                backgroundColor: colors.iconBackground,
                padding: 5,
                borderRadius: 999,
                zIndex: 10,
              }}
              onPress={handleFavoritePress} // YENİ FONKSİYONUMUZA BAĞLADIK
              activeOpacity={0.7}
            >
              <Iconify
                icon={localFavorite ? 'solar:heart-bold' : 'solar:heart-broken'} // ARTIK LOKAL STATE'İ DİNLİYOR
                size={20}
                color={localFavorite ? '#F98A21' : colors.headText} // ARTIK LOKAL STATE'İ DİNLİYOR
              />
            </TouchableOpacity>
          ) : null}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// --- DeckStackCarousel ---
// Favourite decks: the deck in the middle sits in front at full size; its
// neighbours are smaller, dimmed and tucked behind it, peeking out on each
// side. At most three decks show at once (two at either end). Native scroll
// with snapping, one deck per swipe. Tapping a side deck brings it to the
// front; tapping the front deck opens it.
const CAROUSEL_CARD_WIDTH_RATIO = 0.46; // of the container width
const CAROUSEL_CARD_MAX_WIDTH = 190;
const CAROUSEL_VERTICAL_PADDING = 16; // space above the cards
// Indicator under the cards, a small copy of the stack: the front deck's mark
// is a line in the middle, its neighbours are dots on each side, the rest are
// hidden (at most 3 marks, 2 at either end). The marks slide with the scroll.
const CAROUSEL_DOT_SIZE = 6;
const CAROUSEL_ACTIVE_DOT_WIDTH = 20;
const CAROUSEL_DOT_SPACING = 18; // between the centres of neighbouring marks
const CAROUSEL_DOTS_WIDTH = CAROUSEL_ACTIVE_DOT_WIDTH + 4 * CAROUSEL_DOT_SPACING;
const CAROUSEL_DOTS_GAP = 14; // between the cards and the indicator
const CAROUSEL_STEP_RATIO = 0.62; // scroll distance per deck, of the card width
const CAROUSEL_SIDE_OFFSET_RATIO = 0.42; // neighbour's centre from the front deck's
const CAROUSEL_FAR_OFFSET_RATIO = 0.46; // second neighbour: hidden behind the first
const CAROUSEL_SIDE_SCALE = 0.84;
const CAROUSEL_FAR_SCALE = 0.7;
const CAROUSEL_SIDE_DIM = 0.35;
const CAROUSEL_RADIUS = 18; // DeckCard's corner radius

const DeckStackItem = memo(({
  deck, index, scrollX, step, cardWidth, cardHeight, colors, typography, onItemPress,
}) => {
  const sideOffset = cardWidth * CAROUSEL_SIDE_OFFSET_RATIO;
  const farOffset = cardWidth * CAROUSEL_FAR_OFFSET_RATIO;

  // r: this deck's distance from the centre in scroll space. Scrolling moves
  // it by r; translateX swaps that for the stacked offset.
  const stackStyle = useAnimatedStyle(() => {
    const r = index * step - scrollX.value;
    const d = Math.abs(r) / step;
    const offset = interpolate(
      r,
      [-2 * step, -step, 0, step, 2 * step],
      [-farOffset, -sideOffset, 0, sideOffset, farOffset],
      Extrapolation.CLAMP
    );
    return {
      zIndex: Math.round(100 - d * 10),
      opacity: interpolate(d, [1, 1.7], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: offset - r },
        { scale: interpolate(d, [0, 1, 2], [1, CAROUSEL_SIDE_SCALE, CAROUSEL_FAR_SCALE], Extrapolation.CLAMP) },
      ],
    };
  });
  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(index * step - scrollX.value) / step, [0, 1], [0, CAROUSEL_SIDE_DIM], Extrapolation.CLAMP),
  }));

  return (
    <Reanimated.View style={[{ width: step, height: cardHeight, alignItems: 'center' }, stackStyle]}>
      <View style={{ width: cardWidth, height: cardHeight }}>
        <DeckCard
          deck={deck}
          colors={colors}
          typography={typography}
          variant="featured"
          width={cardWidth}
          height={cardHeight}
          onPress={() => onItemPress(index, deck)}
        />
        <Reanimated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000', borderRadius: CAROUSEL_RADIUS }, dimStyle]}
        />
      </View>
    </Reanimated.View>
  );
});

// One indicator mark, placed by its distance from the front deck (rel, in
// decks): a line at 0, a faint dot at ±1, faded out past that (UI thread).
const DeckStackDot = memo(({ index, scrollX, step, activeColor, inactiveColor }) => {
  const dotStyle = useAnimatedStyle(() => {
    const rel = Math.max(-2, Math.min(2, index - scrollX.value / step));
    const d = Math.abs(rel);
    const width = interpolate(d, [0, 1], [CAROUSEL_ACTIVE_DOT_WIDTH, CAROUSEL_DOT_SIZE], Extrapolation.CLAMP);
    return {
      width,
      opacity: interpolate(d, [0, 1, 1.6], [1, 0.45, 0], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(Math.min(1, d), [0, 1], [activeColor, inactiveColor]),
      transform: [{ translateX: CAROUSEL_DOTS_WIDTH / 2 + rel * CAROUSEL_DOT_SPACING - width / 2 }],
    };
  });
  return <Reanimated.View style={[styles.carouselDot, dotStyle]} />;
});

export function DeckStackCarousel({ decks, colors, typography, onPress }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef(null);
  const scrollX = useSharedValue(0);

  const cardWidth = Math.min(CAROUSEL_CARD_MAX_WIDTH, containerWidth * CAROUSEL_CARD_WIDTH_RATIO);
  const cardHeight = cardWidth * DECK_CARD_ASPECT_RATIO;
  const step = cardWidth * CAROUSEL_STEP_RATIO;

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  // A light tick each time a new deck comes to the front.
  const handleFrontChange = useCallback(() => triggerHaptic('selection'), []);
  useAnimatedReaction(
    () => (step > 0 ? Math.round(scrollX.value / step) : 0),
    (index, previous) => {
      if (previous !== null && index !== previous) runOnJS(handleFrontChange)();
    },
    [step]
  );

  const handleItemPress = useCallback((index, deck) => {
    const front = step > 0 ? Math.round(scrollX.value / step) : 0;
    if (index === front) onPress(deck);
    else scrollRef.current?.scrollTo({ x: index * step, animated: true });
  }, [onPress, scrollX, step]);

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={{ paddingTop: CAROUSEL_VERTICAL_PADDING }}
    >
      {containerWidth > 0 ? (
        <Reanimated.ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          disableIntervalMomentum
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: (containerWidth - step) / 2 }}
        >
          {decks.map((deck, index) => (
            <DeckStackItem
              key={deck.id}
              deck={deck}
              index={index}
              scrollX={scrollX}
              step={step}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              colors={colors}
              typography={typography}
              onItemPress={handleItemPress}
            />
          ))}
        </Reanimated.ScrollView>
      ) : null}
      {containerWidth > 0 && decks.length > 1 ? (
        <View style={styles.carouselDots}>
          {decks.map((deck, index) => (
            <DeckStackDot
              key={deck.id}
              index={index}
              scrollX={scrollX}
              step={step}
              activeColor={colors.buttonColor}
              inactiveColor={colors.muted}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  deckCardModern: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    marginRight: 10,
    marginBottom: 8,
    overflow: 'hidden', // Taşan kısımları gizle
  },
  touchableContainer: {
    flex: 1,
    borderRadius: 18,
  },
  deckCardGradient: {
    flex: 1,
    borderRadius: 18,
    padding: 8,
    justifyContent: 'space-between',
  },
  deckCardContentModern: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  deckHeaderModern: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  deckCardFeatured: {
    marginRight: 0,
    marginBottom: 0,
  },
  // Fixed width, centred; marks are positioned inside it by DeckStackDot.
  carouselDots: {
    width: CAROUSEL_DOTS_WIDTH,
    height: CAROUSEL_DOT_SIZE,
    alignSelf: 'center',
    marginTop: CAROUSEL_DOTS_GAP,
  },
  carouselDot: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: CAROUSEL_DOT_SIZE,
    borderRadius: CAROUSEL_DOT_SIZE / 2,
  },
  deckTitleFeatured: {
    fontSize: fontSizes.title3,
  },
  deckTitleModern: {
    fontSize: fontSizes.body,
    fontFamily: fonts.semibold,
    color: '#F98A21',
    maxWidth: '95%',
    textAlign: 'center',
  },
  deckStatsModern: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -18,
    left: 2,
    bottom: 1,
  },
  deckCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  deckCountBadgeText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: fontSizes.body,
  },
  popularityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  popularityBadgeText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: fontSizes.caption,
  },
  deckProfileRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    maxWidth: 120,
  },
  deckProfileAvatar: {
    width: 27,
    height: 27,
    borderRadius: 11,
    marginRight: 6,
  },
  deckProfileUsername: {
    fontSize: fontSizes.subhead,
    color: '#BDBDBD',
    fontFamily: fonts.bold,

  },
  backgroundCategoryIcon: {
    position: 'absolute',
    left: -60, // İkonun yarısının taşması için
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0, // En altta kalması için
    overflow: 'hidden', // Taşan kısmı gizle
    top: 5
  },
  categoryIconStyle: {
    // Subtle background effect için
    opacity: 0.8,
  },
  // Fade efekti için stiller
  fadeTextContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  fadeText: {
    // Text stilleri buraya gelecek
  },
  maskedView: {
    // flex: 1 kaldırıldı
  },
  maskGradient: {
    flexDirection: 'row',
    height: '100%',
  },
  progressBadgeContainer: {
    position: 'absolute',
    left: 16,
    right: 46,
    bottom: 14,
    zIndex: 10,
  },
  progressBottomBadge: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 999,
    paddingLeft: 24,
    paddingRight: 6,
    paddingVertical: 6,
    overflow: 'visible',
  },
  progressBarRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  progressPercentChip: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#F98A21',
    position: 'absolute',
    left: -8,
    top: '50%',
    transform: [{ translateY: -20 }],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.38)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
  },
  progressPercentChipGradient: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 999,
  },
  progressPercentChipInner: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    zIndex: 1,
  },
  progressPercentChipNumber: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: fontSizes.subhead,
    letterSpacing: -0.38,
  },
  progressPercentSign: {
    fontSize: fontSizes.micro,
    fontFamily: fonts.bold,
    color: 'rgba(255, 255, 255, 0.92)',
    marginLeft: 0,
    marginBottom: 2,
  },
  progressBottomTrack: {
    flex: 1,
    minWidth: 0,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
    marginRight: 2,
  },
  progressBottomFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  progressBottomFillCompleted: {
    backgroundColor: '#FFFFFF',
  },
  progressPercentChipNearComplete: {
    shadowColor: '#FB7B0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 7,
    elevation: 4,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  progressPercentChipCompleted: {
    shadowColor: '#FF7505',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 7,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
});

export default React.memo(DeckCard);
