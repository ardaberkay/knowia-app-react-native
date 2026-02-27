import React, { useMemo, useState, useEffect } from 'react';
import { TouchableOpacity, View, Image, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import MaskedView from '@react-native-masked-view/masked-view';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';
import { triggerHaptic } from '../../lib/hapticManager'; // Titreşim yöneticimizi ekledik

// Fade efekti için yardımcı bileşen
const FadeText = ({ text, style, maxWidth = 120, maxChars = 15 }) => {
  const shouldShowFade = text && text.length > maxChars;
  
  if (!shouldShowFade) {
    return (
      <Text 
        style={[style, { maxWidth }]} 
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {text}
      </Text>
    );
  }
  
  return (
    <MaskedView
      style={[styles.maskedView, { maxWidth }]}
      maskElement={
        <LinearGradient
          colors={['black', 'black', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1.15, y: 0 }}
          style={styles.maskGradient}
        />
      }
    >
      <Text 
        style={style} 
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {text}
      </Text>
    </MaskedView>
  );
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
                  ? require('../../assets/app-icon.png')
                  : deck.profiles?.image_url 
                    ? { uri: deck.profiles.image_url } 
                    : require('../../assets/avatar-default.png')
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
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={styles.deckHeaderModern}>
              {deck.to_name ? (
                <>
                  <FadeText 
                    text={deck.name} 
                    style={[typography.styles.body, styles.deckTitleModern, { color: colors.headText }]} 
                    maxWidth={'95%'}
                    maxChars={12}
                  />
                  <View style={{ width: scale(60), height: moderateScale(2), backgroundColor: colors.divider, borderRadius: moderateScale(1), marginVertical: verticalScale(10) }} />
                  <FadeText 
                    text={deck.to_name} 
                    style={[typography.styles.body, styles.deckTitleModern, { color: colors.headText }]} 
                    maxWidth={'95%'}
                    maxChars={12}
                  />
                </>
              ) : (
                <FadeText 
                  text={deck.name} 
                  style={[typography.styles.body, styles.deckTitleModern, { color: colors.headText }]} 
                  maxWidth={'95%'}
                  maxChars={12}
                />
              )}
            </View>
          </View>
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
        </View>

        {/* HIZLANDIRILMIŞ FAVORİ BUTONU */}
        <TouchableOpacity
          style={{ position: 'absolute', bottom: verticalScale(8), right: scale(8), backgroundColor: colors.iconBackground, padding: moderateScale(5), borderRadius: 999, zIndex: 10 }}
          onPress={handleFavoritePress} // YENİ FONKSİYONUMUZA BAĞLADIK
          activeOpacity={0.7}
        >
          <Iconify
            icon={localFavorite ? 'solar:heart-bold' : 'solar:heart-broken'} // ARTIK LOKAL STATE'İ DİNLİYOR
            size={moderateScale(20)}
            color={localFavorite ? '#F98A21' : colors.orWhite} // ARTIK LOKAL STATE'İ DİNLİYOR
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
  deckHeaderModern: {
    alignItems: 'center',
  },
  deckTitleModern: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#F98A21',
    maxWidth: '95%',
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
});

export default React.memo(DeckCard);
