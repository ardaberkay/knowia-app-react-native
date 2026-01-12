import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';

// Shimmer overlay component
const ShimmerOverlay = ({ style, delay = 0, isDarkMode = false, borderRadius = 0, screenWidth = Dimensions.get('window').width }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 2000,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startAnimation();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenWidth, screenWidth],
  });

  const shimmerColors = isDarkMode
    ? ['transparent', 'rgba(255, 255, 255, 0.15)', 'transparent']
    : ['transparent', 'rgba(255, 255, 255, 0.4)', 'transparent'];

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateX }],
          borderRadius: borderRadius,
          overflow: 'hidden',
        },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={shimmerColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1, width: screenWidth, borderRadius: borderRadius }}
      />
    </Animated.View>
  );
};

// Shimmer wrapper for skeleton boxes
const ShimmerBox = ({ children, style, delay = 0, isDarkMode = false, borderRadius = 0, screenWidth }) => {
  return (
    <View style={[{ overflow: 'hidden', borderRadius: borderRadius }, style]}>
      {children}
      <ShimmerOverlay
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        delay={delay}
        isDarkMode={isDarkMode}
        borderRadius={borderRadius}
        screenWidth={screenWidth}
      />
    </View>
  );
};

export default function DeckSkeleton() {
  const { isDarkMode } = useTheme();
  
  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  // Responsive deck skeleton kart boyutları - useMemo ile optimize edilmiş
  // Hibrit yaklaşım: scale() (dp bazlı) + ekran boyutu sınırları (fiziksel boyut kontrolü)
  const deckSkeletonDimensions = useMemo(() => {
    const { DECK_CARD } = RESPONSIVE_CONSTANTS;
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    
    // scale() ile referans değer
    const scaledWidth = scale(DECK_CARD.REFERENCE_WIDTH);
    
    // Küçük telefonlarda biraz daha küçük yap
    let maxWidth;
    if (isSmallPhone) {
      maxWidth = width * 0.36;
    } else if (isTablet) {
      maxWidth = width * 0.20;
    } else {
      maxWidth = width * 0.34;
    }
    
    const cardWidth = Math.min(scaledWidth, maxWidth);
    const cardHeight = cardWidth * DECK_CARD.ASPECT_RATIO;
    
    return { width: cardWidth, height: cardHeight };
  }, [width, isTablet]);
  
  const DECK_SKELETON_WIDTH = deckSkeletonDimensions.width;
  const DECK_SKELETON_HEIGHT = deckSkeletonDimensions.height;
  
  // Shimmer animasyonu için ekran genişliği
  const SCREEN_WIDTH = width;
  
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  return (
    <View style={[styles.skeletonCard, { width: DECK_SKELETON_WIDTH, height: DECK_SKELETON_HEIGHT }]}>
      <View style={[styles.skeletonCardGradient, { backgroundColor: bgColor }]}>
        <View style={styles.deckCardContentModern}>
          {/* Profil kısmı - üstte */}
          <View style={styles.profileRow}>
            <ShimmerBox delay={0} isDarkMode={isDarkMode} borderRadius={moderateScale(11)} screenWidth={SCREEN_WIDTH}>
              <View style={[styles.avatar, { backgroundColor: lineColor }]} />
            </ShimmerBox>
            <ShimmerBox delay={20} isDarkMode={isDarkMode} borderRadius={moderateScale(7)} screenWidth={SCREEN_WIDTH}>
              <View style={[styles.usernameLine, { backgroundColor: lineColor }]} />
            </ShimmerBox>
          </View>
          
          {/* Başlık kısmı - ortada */}
          <View style={styles.titleSectionWrapper}>
            <View style={styles.deckHeaderModern}>
              <ShimmerBox delay={40} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
                <View style={[styles.titleLine, { backgroundColor: lineColor }]} />
              </ShimmerBox>
              <ShimmerBox delay={60} isDarkMode={isDarkMode} borderRadius={moderateScale(1)} screenWidth={SCREEN_WIDTH}>
                <View style={[styles.divider, { backgroundColor: lineColor }]} />
              </ShimmerBox>
              <ShimmerBox delay={80} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
                <View style={[styles.subtitleLine, { backgroundColor: lineColor }]} />
              </ShimmerBox>
            </View>
          </View>
          
          {/* İstatistik kısmı - altta */}
          <View style={styles.statsSection}>
            <ShimmerBox delay={100} isDarkMode={isDarkMode} borderRadius={moderateScale(12)} screenWidth={SCREEN_WIDTH}>
              <View style={[styles.badge, { backgroundColor: lineColor }]} />
            </ShimmerBox>
          </View>
        </View>
        {/* Favori butonu skeleton - sağ altta */}
        <ShimmerBox delay={120} isDarkMode={isDarkMode} borderRadius={999} style={styles.favoriteButtonContainer} screenWidth={SCREEN_WIDTH}>
          <View style={[styles.favoriteButton, { backgroundColor: lineColor }]} />
        </ShimmerBox>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    backgroundColor: 'transparent',
    borderRadius: moderateScale(18),
    marginRight: scale(10),
    marginBottom: verticalScale(8),
    overflow: 'hidden',
  },
  skeletonCardGradient: {
    flex: 1,
    borderRadius: moderateScale(18),
    padding: scale(8),
  },
  deckCardContentModern: {
    flex: 1,
    justifyContent: 'space-between',
  },
  profileRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    maxWidth: scale(120),
  },
  avatar: {
    width: scale(27),
    height: verticalScale(27),
    borderRadius: moderateScale(11),
    marginRight: scale(6),
  },
  usernameLine: {
    width: scale(75),
    height: moderateScale(14),
    borderRadius: moderateScale(7),
  },
  titleSectionWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckHeaderModern: {
    alignItems: 'center',
  },
  titleLine: {
    width: scale(80),
    height: moderateScale(16),
    borderRadius: moderateScale(8),
  },
  divider: {
    width: scale(60),
    height: moderateScale(2),
    borderRadius: moderateScale(1),
    marginVertical: verticalScale(10),
  },
  subtitleLine: {
    width: scale(70),
    height: moderateScale(16),
    borderRadius: moderateScale(8),
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(-18),
    left: scale(2),
    bottom: verticalScale(1),
  },
  badge: {
    width: scale(40),
    height: verticalScale(24),
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
  },
  favoriteButtonContainer: {
    position: 'absolute',
    bottom: verticalScale(8),
    right: scale(8),
    zIndex: 10,
  },
  favoriteButton: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: 999,
  },
}); 