import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';

// Shimmer overlay component (Aynı kalıyor)
const ShimmerOverlay = ({ style, delay = 0, isDarkMode = false, borderRadius = 0, screenWidth = Dimensions.get('window').width }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 4000,
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
  }, [delay, shimmerAnim]);

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

// Shimmer wrapper (Aynı kalıyor)
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
  
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  const deckSkeletonDimensions = useMemo(() => {
    const { DECK_CARD } = RESPONSIVE_CONSTANTS;
    const scaledWidth = scale(DECK_CARD.REFERENCE_WIDTH);
    const maxWidth = isTablet ? width * 0.20 : width * 0.36;
    const cardWidth = Math.min(scaledWidth, maxWidth);
    const cardHeight = cardWidth * DECK_CARD.ASPECT_RATIO;
    
    return { width: cardWidth, height: cardHeight };
  }, [width, isTablet]);
  
  const DECK_SKELETON_WIDTH = deckSkeletonDimensions.width;
  const DECK_SKELETON_HEIGHT = deckSkeletonDimensions.height;
  const SCREEN_WIDTH = width;
  
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  return (
    <View style={[styles.skeletonCard, { width: DECK_SKELETON_WIDTH, height: DECK_SKELETON_HEIGHT }]}>
      <View style={[styles.skeletonCardGradient, { backgroundColor: bgColor }]}>
        
        {/* Üst Kısım: Profil */}
        <View style={styles.topRow}>
          <View style={styles.profileRow}>
            <ShimmerBox delay={0} isDarkMode={isDarkMode} borderRadius={moderateScale(11)} screenWidth={SCREEN_WIDTH}>
              <View style={[styles.avatar, { backgroundColor: lineColor }]} />
            </ShimmerBox>
            <ShimmerBox delay={20} isDarkMode={isDarkMode} borderRadius={moderateScale(7)} screenWidth={SCREEN_WIDTH}>
              <View style={[styles.usernameLine, { backgroundColor: lineColor }]} />
            </ShimmerBox>
          </View>
        </View>

        {/* Orta Kısım: Başlık ve Divider */}
        <View style={styles.centerRow}>
          <ShimmerBox delay={40} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
            <View style={[styles.titleLine, { backgroundColor: lineColor }]} />
          </ShimmerBox>
          
          {/* Divider: ShimmerBox'tan çıkarıldı, sadece sabit renkli bir çizgi olarak bırakıldı */}
          <View style={[styles.divider, { backgroundColor: lineColor }]} />
          
          <ShimmerBox delay={60} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
            <View style={[styles.subtitleLine, { backgroundColor: lineColor }]} />
          </ShimmerBox>
        </View>

        {/* Alt Kısım: İstatistikler ve Favori Butonu */}
        <View style={styles.bottomRow}>
          <ShimmerBox delay={80} isDarkMode={isDarkMode} borderRadius={moderateScale(12)} screenWidth={SCREEN_WIDTH}>
            <View style={[styles.badge, { backgroundColor: lineColor }]} />
          </ShimmerBox>

          <ShimmerBox delay={100} isDarkMode={isDarkMode} borderRadius={999} screenWidth={SCREEN_WIDTH}>
            <View style={[styles.favoriteButton, { backgroundColor: lineColor }]} />
          </ShimmerBox>
        </View>

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
    padding: scale(12), // Padding'i biraz artırdım, kenarlara çok yapışmaması için
    justifyContent: 'space-between', // İçeriği yukarı, ortaya ve aşağıya eşit dağıtacak
  },
  
  // Satır Yapıları
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  centerRow: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Badge solda, Fav butonu sağda kalacak
  },

  // Elemanlar
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: scale(27),
    height: scale(27), // height'ı da scale yaptım ki avatar tam yuvarlak/kare kalsın
    borderRadius: moderateScale(11),
    marginRight: scale(8),
  },
  usernameLine: {
    width: scale(75),
    height: moderateScale(14),
    borderRadius: moderateScale(7),
  },
  titleLine: {
    width: scale(80),
    height: moderateScale(16),
    borderRadius: moderateScale(8),
  },
  divider: {
    width: scale(50), // Biraz kısalttım, daha şık durur
    height: moderateScale(2),
    borderRadius: moderateScale(1),
    marginVertical: verticalScale(12),
    opacity: 0.5, // Çizgiyi iskelette biraz daha silik yapmak iyi bir numaradır
  },
  subtitleLine: {
    width: scale(65),
    height: moderateScale(14), // Subtitle genelde title'dan biraz incedir
    borderRadius: moderateScale(7),
  },
  badge: {
    width: scale(40),
    height: verticalScale(24),
    borderRadius: moderateScale(12),
  },
  favoriteButton: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: 999,
  },
});