import React, { useMemo, useState, useEffect } from 'react';
import { TouchableOpacity, View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import MaskedView from '@react-native-masked-view/masked-view';
import { triggerHaptic } from '../../lib/hapticManager'; // Titreşim yöneticimizi ekledik

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
  variant = 'default',
}) => {
  const { width: DECK_CARD_WIDTH, height: DECK_CARD_HEIGHT } = useDeckCardSize();

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
        style={[typography.styles.body, styles.deckTitleModern, { color: colors.headText }]}
        maxWidth={'95%'}
        maxChars={12}
      />
    );
  };

  return (
    <View style={[styles.deckCardModern, { width: DECK_CARD_WIDTH, height: DECK_CARD_HEIGHT }]}>
      <TouchableOpacity
        key={`deck-${deck.id}`}
        style={styles.touchableContainer}
        onPress={() => onPress(deck)}
        activeOpacity={0.7}
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
              size={120}
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
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

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
  deckTitleModern: {
    fontSize: 16,
    fontWeight: '700',
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
    fontWeight: 'bold',
    fontSize: 15,
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
    fontWeight: 'bold',
    fontSize: 12,
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
    fontSize: 14,
    color: '#BDBDBD',
    fontWeight: '700',

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
    fontWeight: '800',
    fontSize: 14.5,
    letterSpacing: -0.38,
  },
  progressPercentSign: {
    fontSize: 9.75,
    fontWeight: '700',
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
