import React, { useMemo, useState, useEffect } from 'react';
import { TouchableOpacity, View, Image, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import MaskedView from '@react-native-masked-view/masked-view';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';
import { triggerHaptic } from '../../lib/hapticManager'; // Titreşim yöneticimizi ekledik

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
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();
  
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

  const deckCardDimensions = useMemo(() => {
    const { DECK_CARD } = RESPONSIVE_CONSTANTS;
    const scaledWidth = scale(DECK_CARD.REFERENCE_WIDTH);
    const maxWidth = isTablet ? width * 0.20 : width * 0.36;
    const cardWidth = Math.min(scaledWidth, maxWidth);
    const cardHeight = cardWidth * DECK_CARD.ASPECT_RATIO;

    return { width: cardWidth, height: cardHeight };
  }, [width, isTablet]);

  const DECK_CARD_WIDTH = deckCardDimensions.width;
  const DECK_CARD_HEIGHT = deckCardDimensions.height;

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
  const progressChipOverlap = scale(11);
  const progressFillMinWidth = progressPercent > 0 ? scale(4) : 0;

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
            size={scale(120)}
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
                  <View style={{ width: scale(60), height: moderateScale(2), backgroundColor: colors.divider, borderRadius: moderateScale(1), marginVertical: verticalScale(10) }} />
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
                  <Iconify icon="mdi:fire" size={moderateScale(12)} color="#fff" style={{ marginRight: scale(3) }} />
                  <Text style={[styles.popularityBadgeText, { color: '#fff' }]}>
                    {Math.round(deck.popularity_score)}
                  </Text>
                </View>
              )}
              <View style={styles.deckCountBadge}>
                <Iconify icon="ri:stack-fill" size={moderateScale(15)} color="#fff" style={{ marginRight: scale(3) }} />
                <Text style={[typography.styles.body, styles.deckCountBadgeText]}>{deck.card_count || 0}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* HIZLANDIRILMIŞ FAVORİ BUTONU */}
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
                      size={moderateScale(16)}
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
            bottom: verticalScale(8),
            right: scale(8),
            backgroundColor: colors.iconBackground,
            padding: moderateScale(5),
            borderRadius: 999,
            zIndex: 10,
          }}
          onPress={handleFavoritePress} // YENİ FONKSİYONUMUZA BAĞLADIK
          activeOpacity={0.7}
        >
          <Iconify
            icon={localFavorite ? 'solar:heart-bold' : 'solar:heart-broken'} // ARTIK LOKAL STATE'İ DİNLİYOR
            size={moderateScale(20)}
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
    borderRadius: moderateScale(18),
    marginRight: scale(10),
    marginBottom: verticalScale(8),
    overflow: 'hidden', // Taşan kısımları gizle
  },
  touchableContainer: {
    flex: 1,
    borderRadius: moderateScale(18),
  },
  deckCardGradient: {
    flex: 1,
    borderRadius: moderateScale(18),
    padding: scale(8),
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
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(8),
  },
  deckHeaderModern: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  deckTitleModern: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#F98A21',
    maxWidth: '95%',
    textAlign: 'center',
  },
  deckStatsModern: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(-18),
    left: scale(2),
    bottom: verticalScale(1),
  },
  deckCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
  },
  deckCountBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: moderateScale(15),
  },
  popularityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(12),
    marginRight: scale(6),
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  popularityBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: moderateScale(12),
  },
  deckProfileRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    maxWidth: scale(120),
  },
  deckProfileAvatar: {
    width: scale(27),
    height: verticalScale(27),
    borderRadius: moderateScale(11),
    marginRight: scale(6),
  },
  deckProfileUsername: {
    fontSize: moderateScale(14),
    color: '#BDBDBD',
    fontWeight: '700',
 
  },
  backgroundCategoryIcon: {
    position: 'absolute',
    left: scale(-60), // İkonun yarısının taşması için
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0, // En altta kalması için
    overflow: 'hidden', // Taşan kısmı gizle
    top: verticalScale(5)
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
    left: scale(16),
    right: scale(46),
    bottom: verticalScale(14),
    zIndex: 10,
  },
  progressBottomBadge: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: moderateScale(999),
    paddingLeft: scale(24),
    paddingRight: scale(6),
    paddingVertical: verticalScale(6),
    overflow: 'visible',
  },
  progressBarRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  progressPercentChip: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(999),
    backgroundColor: '#F98A21',
    position: 'absolute',
    left: scale(-8),
    top: '50%',
    transform: [{ translateY: -scale(20) }],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    overflow: 'hidden',
    borderWidth: moderateScale(1.5),
    borderColor: 'rgba(255, 255, 255, 0.38)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.22,
    shadowRadius: moderateScale(4),
    elevation: 3,
  },
  progressPercentChipGradient: {
    position: 'absolute',
    top: -scale(2),
    left: -scale(2),
    right: -scale(2),
    bottom: -scale(2),
    borderRadius: moderateScale(999),
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
    fontSize: moderateScale(14.5),
    letterSpacing: moderateScale(-0.38),
  },
  progressPercentSign: {
    fontSize: moderateScale(9.75),
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.92)',
    marginLeft: 0,
    marginBottom: verticalScale(2),
  },
  progressBottomTrack: {
    flex: 1,
    minWidth: 0,
    height: verticalScale(4),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
    marginRight: scale(2),
  },
  progressBottomFill: {
    height: '100%',
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  progressBottomFillCompleted: {
    backgroundColor: '#FFFFFF',
  },
  progressPercentChipNearComplete: {
    shadowColor: '#FB7B0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: moderateScale(7),
    elevation: 4,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  progressPercentChipCompleted: {
    shadowColor: '#FF7505',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: moderateScale(12),
    elevation: 7,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
});

export default React.memo(DeckCard);
