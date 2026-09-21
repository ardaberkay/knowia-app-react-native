import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Animated, Dimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';

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

export default function DiscoverDecksSkeleton() {
  const { colors, isDarkMode } = useTheme();
  
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  const deckSkeletonHeight = useMemo(() => {
    return isTablet ? height * 0.24 : height * 0.28;
  }, [height, isTablet]);
  
  const responsiveSpacing = useMemo(() => ({
    cardMargin: scale(5),
    listPaddingHorizontal: scale(12),
    listPaddingVertical: verticalScale(5),
  }), []);
  
  const SCREEN_WIDTH = width;
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  // 2-2-2 Izgara yapısı için satırlar
  const rows = [1, 2, 3];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: '10%', paddingTop: verticalScale(20) }}
      showsVerticalScrollIndicator={false}
    >
      {rows.map((rowIndex) => (
        <View 
          key={`skeleton_row_${rowIndex}`}
          style={[
            skeletonStyles.deckRow, 
            { 
              paddingHorizontal: responsiveSpacing.listPaddingHorizontal, 
              paddingVertical: responsiveSpacing.listPaddingVertical 
            }
          ]}
        >
          {[0, 1].map((cardIndex) => (
            <View
              key={`skeleton_card_${rowIndex}_${cardIndex}`}
              style={[
                skeletonStyles.deckCardVertical,
                { height: deckSkeletonHeight, backgroundColor: bgColor },
                cardIndex === 0 ? { marginRight: responsiveSpacing.cardMargin } : { marginLeft: responsiveSpacing.cardMargin }
              ]}
            >
              <View style={skeletonStyles.deckGradient}>
                
                {/* Mutlak Konumlandırılmış Popülerlik Rozeti Skeleton (Sağ Üst Köşe) */}
                <ShimmerBox
                  delay={rowIndex * 100 + cardIndex * 50 + 30}
                  isDarkMode={isDarkMode}
                  style={skeletonStyles.popularityBadgeWrapper}
                  screenWidth={SCREEN_WIDTH}
                >
                  <View style={[skeletonStyles.popularityBadge, { backgroundColor: lineColor }]} />
                </ShimmerBox>

                {/* Üst Kısım: Profil (Sola Dayalı) */}
                <View style={skeletonStyles.topRowStart}>
                  <View style={skeletonStyles.profileRow}>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50} isDarkMode={isDarkMode} borderRadius={99} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.avatarSmall, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 20} isDarkMode={isDarkMode} borderRadius={moderateScale(7)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.nameSmall, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                  </View>
                </View>

                {/* Orta Kısım: Başlıklar ve Ayırıcı Çizgi */}
                <View style={skeletonStyles.centerRow}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 40} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.title, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                  
                  <View style={[skeletonStyles.divider, { backgroundColor: lineColor }]} />
                  
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 80} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.subtitle, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>

                {/* Alt Kısım: Sol Rozet / Sayaç ve Sağ Favori Butonu */}
                <View style={skeletonStyles.bottomRowBetween}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 110} isDarkMode={isDarkMode} borderRadius={moderateScale(14)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.badgeCount, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                  
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 120} isDarkMode={isDarkMode} borderRadius={999} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.favIcon, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>

              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const skeletonStyles = StyleSheet.create({
  deckRow: {
    flexDirection: 'row',
  },
  deckCardVertical: {
    flex: 1,
    borderRadius: moderateScale(18),
    overflow: 'hidden',
    position: 'relative', // Mutlak rozet konumlandırması için
  },
  deckGradient: {
    flex: 1,
    padding: scale(12),
    justifyContent: 'space-between',
  },
  
  // Popülerlik Rozeti (Birebir orjinal stillerinizle eşleşti)
  popularityBadgeWrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 20,
    borderBottomLeftRadius: moderateScale(14),
  },
  popularityBadge: {
    width: scale(62),
    height: verticalScale(28),
    borderBottomLeftRadius: moderateScale(14),
  },

  // Layout Hizamaları
  topRowStart: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
  },
  centerRow: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
  },
  
  // İç Elemanlar
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '65%', // Sağ üstteki rozetin altına girmemesi için genişlik sınırı
  },
  avatarSmall: {
    width: scale(28),
    height: scale(28),
    borderRadius: 99,
    marginRight: scale(6),
  },
  nameSmall: {
    width: scale(60),
    height: moderateScale(13),
    borderRadius: moderateScale(6),
  },
  title: {
    width: scale(80),
    height: moderateScale(16),
    borderRadius: moderateScale(8),
  },
  subtitle: {
    width: scale(65),
    height: moderateScale(14),
    borderRadius: moderateScale(7),
  },
  badgeCount: {
    width: scale(55),
    height: verticalScale(24),
    borderRadius: moderateScale(12),
  },
  favIcon: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: 999,
  },
  divider: {
    width: scale(50),
    height: moderateScale(2),
    borderRadius: moderateScale(1),
    marginVertical: verticalScale(8),
    opacity: 0.5,
  },
});