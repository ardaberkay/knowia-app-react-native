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
  
  const deckSkeletonDimensions = useMemo(() => {
    const verticalHeight = isTablet ? height * 0.24 : height * 0.28;
    const horizontalHeight = isTablet ? height * 0.20 : height * 0.23;
    
    return { verticalHeight, horizontalHeight };
  }, [height, isTablet]);
  
  const DECK_SKELETON_VERTICAL_HEIGHT = deckSkeletonDimensions.verticalHeight;
  const DECK_SKELETON_HORIZONTAL_HEIGHT = deckSkeletonDimensions.horizontalHeight;
  
  const responsiveSpacing = useMemo(() => ({
    cardMargin: scale(5),
    listPaddingHorizontal: scale(12),
    listPaddingVertical: verticalScale(5),
  }), []);
  
  const SCREEN_WIDTH = width;
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: '10%', paddingTop: verticalScale(20) }}
      showsVerticalScrollIndicator={false}
    >
      {[1, 2, 3, 4].map((rowIndex) => (
        <View key={`skeleton_row_${rowIndex}`}>
          
          {/* --- DOUBLE ROW (DİKEY KARTLAR) --- */}
          <View style={[skeletonStyles.deckList, skeletonStyles.deckRow, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
            {[0, 1].map((cardIndex) => (
              <View
                key={`skeleton_double_${rowIndex}_${cardIndex}`}
                style={[
                  skeletonStyles.deckCardVertical,
                  { height: DECK_SKELETON_VERTICAL_HEIGHT, backgroundColor: bgColor },
                  cardIndex === 0 ? { marginRight: responsiveSpacing.cardMargin } : { marginLeft: responsiveSpacing.cardMargin }
                ]}
              >
                <View style={skeletonStyles.deckGradient}>
                  
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
                  
                  {/* Orta Kısım: Başlıklar ve Çizgi (Ortalanmış) */}
                  <View style={skeletonStyles.centerRow}>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 40} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.title, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                    
                    {/* DİKKAT: İnce Çizgiden Shimmer Kaldırıldı */}
                    <View style={[skeletonStyles.divider, { backgroundColor: lineColor }]} />
                    
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 80} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.subtitle, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                  </View>
                  
                  {/* Alt Kısım: Rozetler Solda, Favori Sağda */}
                  <View style={skeletonStyles.bottomRowBetween}>
                    <View style={skeletonStyles.badgeColumn}>
                      <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 100} isDarkMode={isDarkMode} borderRadius={99} style={{ marginBottom: verticalScale(6) }} screenWidth={SCREEN_WIDTH}>
                        <View style={[skeletonStyles.badgePop, { backgroundColor: lineColor }]} />
                      </ShimmerBox>
                      <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 110} isDarkMode={isDarkMode} borderRadius={moderateScale(14)} screenWidth={SCREEN_WIDTH}>
                        <View style={[skeletonStyles.badgeCount, { backgroundColor: lineColor }]} />
                      </ShimmerBox>
                    </View>
                    
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 120} isDarkMode={isDarkMode} borderRadius={999} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.favIcon, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                  </View>

                </View>
              </View>
            ))}
          </View>
          
          {/* --- SINGLE ROW (YATAY KART) --- */}
          <View style={[skeletonStyles.deckList, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
            <View style={[skeletonStyles.deckCardHorizontal, { height: DECK_SKELETON_HORIZONTAL_HEIGHT, backgroundColor: bgColor }]}>
              <View style={skeletonStyles.deckGradient}>
                
                {/* Üst Kısım: Popülerlik Rozeti Solda, Favori Sağda */}
                <View style={skeletonStyles.topRowBetween}>
                  <ShimmerBox delay={rowIndex * 100 + 240} isDarkMode={isDarkMode} borderRadius={99} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.badgePop, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                  
                  <ShimmerBox delay={rowIndex * 100 + 250} isDarkMode={isDarkMode} borderRadius={999} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.favIcon, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
                
                {/* Orta Kısım: Başlıklar ve Çizgi (Ortalanmış) */}
                <View style={skeletonStyles.centerRow}>
                  <ShimmerBox delay={rowIndex * 100 + 260} isDarkMode={isDarkMode} borderRadius={moderateScale(9)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.titleLarge, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                  
                  {/* DİKKAT: İnce Çizgiden Shimmer Kaldırıldı */}
                  <View style={[skeletonStyles.dividerLarge, { backgroundColor: lineColor }]} />
                  
                  <ShimmerBox delay={rowIndex * 100 + 300} isDarkMode={isDarkMode} borderRadius={moderateScale(9)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.subtitleLarge, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
                
                {/* Alt Kısım: Profil Solda, Kart Sayısı Sağda */}
                <View style={skeletonStyles.bottomRowBetween}>
                  <View style={skeletonStyles.profileRow}>
                    <ShimmerBox delay={rowIndex * 100 + 200} isDarkMode={isDarkMode} borderRadius={99} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.avatarSmall, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                    <ShimmerBox delay={rowIndex * 100 + 220} isDarkMode={isDarkMode} borderRadius={moderateScale(7)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.nameLarge, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                  </View>
                  
                  <ShimmerBox delay={rowIndex * 100 + 320} isDarkMode={isDarkMode} borderRadius={moderateScale(14)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.badgeCountLarge, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>

              </View>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const skeletonStyles = StyleSheet.create({
  deckList: {},
  deckRow: {
    flexDirection: 'row',
  },
  deckCardVertical: {
    flex: 1,
    borderRadius: moderateScale(18),
    overflow: 'hidden',
  },
  deckCardHorizontal: {
    borderRadius: moderateScale(18),
    overflow: 'hidden',
  },
  deckGradient: {
    flex: 1,
    padding: scale(12),
    justifyContent: 'space-between', // Absolute yerine Flexbox ile yukarı, ortaya ve aşağıya dağıtır
  },
  
  // Flex Layout Sınıfları
  topRowStart: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    width: '100%',
  },
  topRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  
  // İç Eleman Gruplamaları
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },

  // Ortak Boyutlar
  avatarSmall: {
    width: scale(32),
    height: scale(32),
    borderRadius: 99,
    marginRight: scale(6),
  },
  nameSmall: {
    width: scale(85),
    height: moderateScale(15),
    borderRadius: moderateScale(7),
  },
  nameLarge: {
    width: scale(95),
    height: moderateScale(15),
    borderRadius: moderateScale(7),
  },
  title: {
    width: scale(80),
    height: moderateScale(16),
    borderRadius: moderateScale(8),
  },
  titleLarge: {
    width: scale(140),
    height: moderateScale(18),
    borderRadius: moderateScale(9),
  },
  subtitle: {
    width: scale(70),
    height: moderateScale(16),
    borderRadius: moderateScale(8),
  },
  subtitleLarge: {
    width: scale(120),
    height: moderateScale(18),
    borderRadius: moderateScale(9),
  },
  badgePop: {
    width: scale(50),
    height: verticalScale(24),
    borderRadius: 99,
  },
  badgeCount: {
    width: scale(60),
    height: verticalScale(28),
    borderRadius: moderateScale(14),
  },
  badgeCountLarge: {
    width: scale(65),
    height: verticalScale(28),
    borderRadius: moderateScale(14),
  },
  favIcon: {
    width: moderateScale(37),
    height: moderateScale(37),
    borderRadius: 999,
  },
  divider: {
    width: scale(60),
    height: moderateScale(2),
    borderRadius: moderateScale(1),
    marginVertical: verticalScale(8),
    opacity: 0.5,
  },
  dividerLarge: {
    width: scale(70),
    height: moderateScale(2),
    borderRadius: moderateScale(1),
    marginVertical: verticalScale(10),
    opacity: 0.5,
  }
});