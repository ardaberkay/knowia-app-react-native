import React from 'react';
import { TouchableOpacity, View, Image, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import MaskedView from '@react-native-masked-view/masked-view';

// Fade efekti için yardımcı bileşen
const FadeText = ({ text, style, maxWidth = 120, maxChars = 15 }) => {
  // Karakter sayısına göre fade gösterimi
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

export default function DeckCard({
  deck,
  colors,
  typography,
  onPress,
  onToggleFavorite,
  isFavorite = false,
  showPopularityBadge = false,
}) {
  // Kategoriye göre renkleri al (Supabase sort_order kullanarak)
  const getCategoryColors = (sortOrder) => {
    if (colors.categoryColors && colors.categoryColors[sortOrder]) {
      return colors.categoryColors[sortOrder];
    }
    // Varsayılan renkler (Tarih kategorisi - sort_order: 4)
    return ['#6F8EAD', '#3F5E78'];
  };

  // Kategori ikonunu sort_order değerine göre al
  const getCategoryIcon = (sortOrder) => {
    const icons = {
      1: "hugeicons:language-skill", // Dil
      2: "clarity:atom-solid", // Bilim
      3: "mdi:math-compass", // Matematik
      4: "game-icons:tied-scroll", // Tarih
      5: "arcticons:world-geography-alt", // Coğrafya
      6: "map:museum", // Sanat ve Kültür
      7: "ic:outline-self-improvement", // Kişisel Gelişim
      8: "streamline-ultimate:module-puzzle-2-bold" // Genel Kültür
    };
    return icons[sortOrder] || "material-symbols:category";
  };


  const gradientColors = getCategoryColors(deck.categories?.sort_order);
  const categoryIcon = getCategoryIcon(deck.categories?.sort_order);
  

  return (
    <View style={styles.deckCardModern}>
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
        {/* Background Category Icon - sadece yarısı görünecek şekilde */}
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
              source={deck.profiles?.image_url ? { uri: deck.profiles.image_url } : require('../../assets/avatar-default.png')}
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
                  <View style={{ width: 60, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 10 }} />
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
        </View>
        <TouchableOpacity
          style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: colors.iconBackground, padding: 5, borderRadius: 999, zIndex: 10 }}
          onPress={() => onToggleFavorite(deck.id)}
          activeOpacity={0.7}
        >
          <Iconify
            icon={isFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
            size={20}
            color={isFavorite ? '#F98A21' : colors.orWhite}
          />
        </TouchableOpacity>
      </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  deckCardModern: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    marginRight: 10,
    marginBottom: 8,
    width: 140,
    height: 196,
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
  deckHeaderModern: {
    alignItems: 'center',
  },
  deckTitleModern: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F98A21',
    maxWidth: '95%',
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
});


