import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Animated, Dimensions } from 'react-native';
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

export default function DiscoverDecksSkeleton() {
  const { colors, isDarkMode } = useTheme();
  
  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  // Responsive deck skeleton kart boyutları - useMemo ile optimize edilmiş
  const deckSkeletonDimensions = useMemo(() => {
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    const isSmallScreen = height < RESPONSIVE_CONSTANTS.SMALL_SCREEN_MAX_HEIGHT;
    
    // Vertical card height - referans: verticalScale(240)
    const baseVerticalHeight = verticalScale(240);
    let verticalHeight;
    if (isSmallPhone) {
      verticalHeight = height * 0.32;
    } else if (isSmallScreen) {
      verticalHeight = height * 0.30;
    } else if (isTablet) {
      // Tablet: ekran yüksekliğinin %28'i (artırıldı - DeckList ile eşleştirildi)
      verticalHeight = height * 0.28;
    } else {
      const maxHeight = height * 0.26;
      verticalHeight = Math.min(baseVerticalHeight, maxHeight);
    }
    
    // Horizontal card height - referans: verticalScale(180)
    const baseHorizontalHeight = verticalScale(180);
    let horizontalHeight;
    if (isSmallPhone) {
      horizontalHeight = height * 0.26;
    } else if (isSmallScreen) {
      horizontalHeight = height * 0.24;
    } else if (isTablet) {
      // Tablet: ekran yüksekliğinin %22'si (artırıldı - DeckList ile eşleştirildi)
      horizontalHeight = height * 0.22;
    } else {
      const maxHeight = height * 0.20;
      horizontalHeight = Math.min(baseHorizontalHeight, maxHeight);
    }
    
    return {
      verticalHeight,
      horizontalHeight,
    };
  }, [width, height, isTablet]);
  
  const DECK_SKELETON_VERTICAL_HEIGHT = deckSkeletonDimensions.verticalHeight;
  const DECK_SKELETON_HORIZONTAL_HEIGHT = deckSkeletonDimensions.horizontalHeight;
  
  // Responsive spacing
  const responsiveSpacing = useMemo(() => {
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    
    return {
      cardMargin: isSmallPhone ? scale(5) : scale(5),
      listPaddingHorizontal: isSmallPhone ? scale(12) : scale(12),
      listPaddingVertical: isSmallPhone ? verticalScale(5) : verticalScale(5),
    };
  }, [width]);
  
  // Shimmer animasyonu için ekran genişliği
  const SCREEN_WIDTH = width;
  
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: '10%', paddingTop: verticalScale(20) }}
      showsVerticalScrollIndicator={false}
    >
      {/* Skeleton Rows - Double + Single pattern (DeckList layout'una uygun) */}
      {[1, 2, 3, 4].map((rowIndex) => (
        <View key={`skeleton_row_${rowIndex}`}>
          {/* Double Row */}
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
                  {/* Profile Section Skeleton - Top Left */}
                  <View style={skeletonStyles.deckProfileRow}>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50} isDarkMode={isDarkMode} borderRadius={99} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.skeletonBox, { width: scale(32), height: verticalScale(32), borderRadius: 99, backgroundColor: lineColor, marginRight: scale(6) }]} />
                    </ShimmerBox>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 20} isDarkMode={isDarkMode} borderRadius={moderateScale(7)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.skeletonBox, { width: scale(85), height: moderateScale(15), borderRadius: moderateScale(7), backgroundColor: lineColor }]} />
                    </ShimmerBox>
                  </View>
                  
                  {/* Title Section Skeleton */}
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 40} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.skeletonBox, { width: scale(80), height: moderateScale(16), borderRadius: moderateScale(8), backgroundColor: lineColor }]} />
                    </ShimmerBox>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 60} isDarkMode={isDarkMode} borderRadius={moderateScale(1)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.skeletonBox, { width: scale(60), height: moderateScale(2), borderRadius: moderateScale(1), backgroundColor: lineColor, marginVertical: verticalScale(8) }]} />
                    </ShimmerBox>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 80} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.skeletonBox, { width: scale(70), height: moderateScale(16), borderRadius: moderateScale(8), backgroundColor: lineColor }]} />
                    </ShimmerBox>
                  </View>
                  
                  {/* Badge Section Skeleton */}
                  <View style={{ position: 'absolute', bottom: verticalScale(12), left: scale(12), flexDirection: 'column', alignItems: 'flex-start' }}>
                    {/* Popularity Badge Skeleton */}
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 100} isDarkMode={isDarkMode} borderRadius={99} style={{ marginBottom: verticalScale(6) }} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.skeletonBox, { width: scale(50), height: verticalScale(24), borderRadius: 99, backgroundColor: lineColor, paddingHorizontal: scale(7), paddingVertical: verticalScale(2) }]} />
                    </ShimmerBox>
                    {/* Card Count Badge Skeleton */}
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 110} isDarkMode={isDarkMode} borderRadius={moderateScale(14)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.skeletonBox, { width: scale(60), height: verticalScale(28), borderRadius: moderateScale(14), backgroundColor: lineColor, paddingHorizontal: scale(8), paddingVertical: verticalScale(2) }]} />
                    </ShimmerBox>
                  </View>
                  
                  {/* Favorite Button Skeleton - Bottom Right */}
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 120} isDarkMode={isDarkMode} borderRadius={999} style={{ position: 'absolute', bottom: verticalScale(8), right: scale(10), zIndex: 10 }} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: moderateScale(37), height: moderateScale(37), borderRadius: 999, backgroundColor: lineColor, padding: moderateScale(8) }]} />
                  </ShimmerBox>
                </View>
              </View>
            ))}
          </View>
          
          {/* Single Row */}
          <View style={[skeletonStyles.deckList, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
            <View style={[skeletonStyles.deckCardHorizontal, { height: DECK_SKELETON_HORIZONTAL_HEIGHT, backgroundColor: bgColor }]}>
              <View style={skeletonStyles.deckGradient}>
                {/* Profile Section Skeleton - Bottom Left */}
                <View style={[skeletonStyles.deckProfileRow, { top: 'auto', bottom: 8 }]}>
                  <ShimmerBox delay={rowIndex * 100 + 200} isDarkMode={isDarkMode} borderRadius={99} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: scale(32), height: verticalScale(32), borderRadius: 99, backgroundColor: lineColor, marginRight: scale(6) }]} />
                  </ShimmerBox>
                  <ShimmerBox delay={rowIndex * 100 + 220} isDarkMode={isDarkMode} borderRadius={moderateScale(7)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: scale(95), height: moderateScale(15), borderRadius: moderateScale(7), backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
                
                {/* Popularity Badge Skeleton - Top Left */}
                <View style={{ position: 'absolute', top: 8, left: 12, zIndex: 10 }}>
                  <ShimmerBox delay={rowIndex * 100 + 240} isDarkMode={isDarkMode} borderRadius={99} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: scale(50), height: verticalScale(24), borderRadius: 99, backgroundColor: lineColor, paddingHorizontal: scale(7), paddingVertical: verticalScale(2) }]} />
                  </ShimmerBox>
                </View>
                
                {/* Favorite Button Skeleton - Top Right */}
                <ShimmerBox delay={rowIndex * 100 + 250} isDarkMode={isDarkMode} borderRadius={999} style={{ position: 'absolute', top: 8, right: 10, zIndex: 10 }} screenWidth={SCREEN_WIDTH}>
                  <View style={[skeletonStyles.skeletonBox, { width: moderateScale(38), height: moderateScale(38), borderRadius: 999, backgroundColor: lineColor, padding: 8 }]} />
                </ShimmerBox>
                
                {/* Title Section Skeleton */}
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ShimmerBox delay={rowIndex * 100 + 260} isDarkMode={isDarkMode} borderRadius={moderateScale(9)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: scale(140), height: moderateScale(18), borderRadius: moderateScale(9), backgroundColor: lineColor }]} />
                  </ShimmerBox>
                  <ShimmerBox delay={rowIndex * 100 + 280} isDarkMode={isDarkMode} borderRadius={moderateScale(1)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: scale(70), height: moderateScale(2), borderRadius: moderateScale(1), backgroundColor: lineColor, marginVertical: 10 }]} />
                  </ShimmerBox>
                  <ShimmerBox delay={rowIndex * 100 + 300} isDarkMode={isDarkMode} borderRadius={moderateScale(9)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: scale(120), height: moderateScale(18), borderRadius: moderateScale(9), backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
                
                {/* Badge Section Skeleton - Bottom Right */}
                <View style={{ position: 'absolute', bottom: 10, right: 12 }}>
                  <ShimmerBox delay={rowIndex * 100 + 320} isDarkMode={isDarkMode} borderRadius={moderateScale(14)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: scale(65), height: verticalScale(28), borderRadius: moderateScale(14), backgroundColor: lineColor, paddingHorizontal: scale(8), paddingVertical: verticalScale(2) }]} />
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
  deckList: {
    // paddingHorizontal ve paddingVertical dinamik olarak uygulanacak
  },
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
    borderRadius: moderateScale(18),
    padding: scale(16),
    justifyContent: 'center',
  },
  deckProfileRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    top: verticalScale(8),
    left: scale(10),
  },
  skeletonBox: {
    // Skeleton placeholder için stil
  },
});

