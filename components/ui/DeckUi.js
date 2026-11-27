import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { TouchableOpacity, View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { triggerHaptic } from '../../lib/hapticManager';
import { fontSizes, fonts } from '../../theme/typography';
import { getCategoryColors } from '../../theme/colors';
import { getCategoryIcon, ICONS } from '../../theme/icons';
import PhosphorIcon from './PhosphorIcon';
import StackCarousel from './StackCarousel';

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


  const gradientColors = getCategoryColors(colors, deck.categories?.sort_order);
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
            <PhosphorIcon
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
                    ? require('../../assets/images/app_icon.png')
                    : deck.profiles?.image_url
                      ? { uri: deck.profiles.image_url }
                      : require('../../assets/images/avatar_default.webp')
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
                    <PhosphorIcon icon={ICONS.trending} size={12} color="#fff" style={{ marginRight: 3 }} />
                    <Text style={[styles.popularityBadgeText, { color: '#fff' }]}>
                      {Math.round(deck.popularity_score)}
                    </Text>
                  </View>
                )}
                <View style={styles.deckCountBadge}>
                  <PhosphorIcon icon={ICONS.stack} size={15} color="#fff" style={{ marginRight: 3 }} />
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
                      <PhosphorIcon
                        icon={ICONS.check}
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
              <PhosphorIcon
                icon={localFavorite ? ICONS.favorite : ICONS.favoriteOff} // ARTIK LOKAL STATE'İ DİNLİYOR
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

// Favourite decks in a stacked carousel (see StackCarousel): large deck
// cards; tapping the front deck opens it.
export function DeckStackCarousel({ decks, colors, typography, onPress }) {
  // Taps are handled by the carousel (onFrontPress); the card gets none.
  const renderItem = useCallback(({ item, width, height }) => (
    <DeckCard
      deck={item}
      colors={colors}
      typography={typography}
      variant="featured"
      width={width}
      height={height}
      onPress={noop}
    />
  ), [colors, typography]);

  return (
    <StackCarousel
      items={decks}
      keyExtractor={deckKey}
      renderItem={renderItem}
      variant="stack"
      onFrontPress={onPress}
      widthRatio={0.46}
      maxWidth={190}
      aspectRatio={DECK_CARD_ASPECT_RATIO}
      activeColor={colors.buttonColor}
      inactiveColor={colors.muted}
      paddingTop={16}
    />
  );
}
const deckKey = (deck) => String(deck.id);
const noop = () => {};

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
