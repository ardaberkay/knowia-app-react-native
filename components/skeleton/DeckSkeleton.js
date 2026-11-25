import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeckCardSize } from '../ui/DeckUi';

// Shared shimmer for the skeleton screens (DeckSkeleton, DiscoverDecksSkeleton,
// MyDecksSkeleton): a gradient band sweeping across the box every `duration` ms.
export const ShimmerOverlay = ({ style, delay = 0, duration = 4000, isDarkMode = false, borderRadius = 0, screenWidth }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, shimmerAnim]);

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

export const ShimmerBox = ({ children, style, delay = 0, duration, isDarkMode = false, borderRadius = 0, screenWidth }) => {
  return (
    <View style={[{ overflow: 'hidden', borderRadius: borderRadius }, style]}>
      {children}
      <ShimmerOverlay
        style={StyleSheet.absoluteFillObject}
        delay={delay}
        duration={duration}
        isDarkMode={isDarkMode}
        borderRadius={borderRadius}
        screenWidth={screenWidth}
      />
    </View>
  );
};

export default function DeckSkeleton({ progressMode = false }) {
  const { isDarkMode } = useTheme();
  
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const { width: DECK_SKELETON_WIDTH, height: DECK_SKELETON_HEIGHT } = useDeckCardSize();
  
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  return (
    <View style={[styles.skeletonCard, { width: DECK_SKELETON_WIDTH, height: DECK_SKELETON_HEIGHT }]}>
      <View style={[styles.skeletonCardGradient, { backgroundColor: bgColor }]}>
        
        {/* Üst Kısım: Profil */}
        <View style={styles.topRow}>
          <View style={styles.profileRow}>
            <ShimmerBox delay={0} isDarkMode={isDarkMode} borderRadius={11} screenWidth={SCREEN_WIDTH}>
              <View style={[styles.avatar, { backgroundColor: lineColor }]} />
            </ShimmerBox>
            <ShimmerBox delay={20} isDarkMode={isDarkMode} borderRadius={7} screenWidth={SCREEN_WIDTH}>
              <View style={[styles.usernameLine, { backgroundColor: lineColor }]} />
            </ShimmerBox>
          </View>
        </View>

        {/* Orta Kısım: Başlık ve Divider */}
        <View style={styles.centerRow}>
          <ShimmerBox delay={40} isDarkMode={isDarkMode} borderRadius={8} screenWidth={SCREEN_WIDTH}>
            <View style={[styles.titleLine, { backgroundColor: lineColor }]} />
          </ShimmerBox>
          
          {/* Divider: ShimmerBox'tan çıkarıldı, sadece sabit renkli bir çizgi olarak bırakıldı */}
          <View style={[styles.divider, { backgroundColor: lineColor }]} />
          
          <ShimmerBox delay={60} isDarkMode={isDarkMode} borderRadius={8} screenWidth={SCREEN_WIDTH}>
            <View style={[styles.subtitleLine, { backgroundColor: lineColor }]} />
          </ShimmerBox>
        </View>

        {/* Alt Kısım: kart sayısı badge VEYA chip+progress (Çalıştığım Desteler) + Favori */}
        {progressMode ? (
          <>
            <View style={styles.progressBadgeContainer}>
              <View style={styles.progressBottomBadgeSkeleton}>
                <ShimmerBox
                  delay={78}
                  isDarkMode={isDarkMode}
                  borderRadius={999}
                  screenWidth={SCREEN_WIDTH}
                  style={styles.progressBottomBadgeBaseShimmer}
                >
                  <View style={[styles.progressBottomBadgeBase, { backgroundColor: lineColor }]} />
                </ShimmerBox>
                <ShimmerBox
                  delay={84}
                  isDarkMode={isDarkMode}
                  borderRadius={999}
                  screenWidth={SCREEN_WIDTH}
                  style={styles.progressChipAbsoluteShimmer}
                >
                  <View style={[styles.progressChipPlaceholder, { backgroundColor: lineColor }]} />
                </ShimmerBox>
                <View style={styles.progressBarRowSkeleton}>
                  <View style={{ width: 12 }} />
                  <ShimmerBox
                    delay={92}
                    isDarkMode={isDarkMode}
                    borderRadius={999}
                    screenWidth={SCREEN_WIDTH}
                    style={styles.progressTrackShimmerGrow}
                  >
                    <View
                      style={[
                        styles.progressTrackPlaceholder,
                        { backgroundColor: isDarkMode ? '#3A3A3A' : '#D3D3D3' },
                      ]}
                    />
                  </ShimmerBox>
                </View>
              </View>
            </View>
            <ShimmerBox
              delay={100}
              isDarkMode={isDarkMode}
              borderRadius={999}
              screenWidth={SCREEN_WIDTH}
              style={styles.favoriteButtonProgressPosition}
            >
              <View style={[styles.favoriteButton, { backgroundColor: lineColor }]} />
            </ShimmerBox>
            <View style={styles.bottomRowReserve} />
          </>
        ) : (
          <View style={styles.bottomRow}>
            <ShimmerBox delay={80} isDarkMode={isDarkMode} borderRadius={12} screenWidth={SCREEN_WIDTH}>
              <View style={[styles.badge, { backgroundColor: lineColor }]} />
            </ShimmerBox>
            <ShimmerBox delay={100} isDarkMode={isDarkMode} borderRadius={999} screenWidth={SCREEN_WIDTH}>
              <View style={[styles.favoriteButton, { backgroundColor: lineColor }]} />
            </ShimmerBox>
          </View>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    marginRight: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  skeletonCardGradient: {
    flex: 1,
    borderRadius: 18,
    padding: 8, // DeckUi deckCardGradient ile uyumlu
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
    justifyContent: 'space-between',
  },
  progressBadgeContainer: {
    position: 'absolute',
    left: 16,
    right: 46,
    bottom: 14,
    zIndex: 10,
  },
  progressBottomBadgeSkeleton: {
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
  progressBottomBadgeBaseShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  progressBottomBadgeBase: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  progressChipAbsoluteShimmer: {
    position: 'absolute',
    left: -8,
    top: '50%',
    transform: [{ translateY: -19 }],
    zIndex: 2,
  },
  progressChipPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 999,
  },
  progressBarRowSkeleton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  progressTrackShimmerGrow: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  progressTrackPlaceholder: {
    width: '100%',
    height: 4,
    borderRadius: 999,
    marginRight: 2,
  },
  favoriteButtonProgressPosition: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    zIndex: 11,
  },
  bottomRowReserve: {
    height: 30,
  },

  // Elemanlar
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 27,
    height: 27, // height'ı da scale yaptım ki avatar tam yuvarlak/kare kalsın
    borderRadius: 11,
    marginRight: 8,
  },
  usernameLine: {
    width: 75,
    height: 14,
    borderRadius: 7,
  },
  titleLine: {
    width: 80,
    height: 16,
    borderRadius: 8,
  },
  divider: {
    width: 50, // Biraz kısalttım, daha şık durur
    height: 2,
    borderRadius: 1,
    marginVertical: 12,
    opacity: 0.5, // Çizgiyi iskelette biraz daha silik yapmak iyi bir numaradır
  },
  subtitleLine: {
    width: 65,
    height: 14, // Subtitle genelde title'dan biraz incedir
    borderRadius: 7,
  },
  badge: {
    width: 40,
    height: 24,
    borderRadius: 12,
  },
  favoriteButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
  },
});