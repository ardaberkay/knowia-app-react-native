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

export default function MyDecksSkeleton({ ListHeaderComponent }) {
  const { colors, isDarkMode } = useTheme();
  
  // useWindowDimensions hook'u - ekran döndürme desteği
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
  
  // Shimmer animasyonu için ekran genişliği
  const SCREEN_WIDTH = width;
  
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: '25%', paddingTop: '25%' }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Component */}
      {ListHeaderComponent && (typeof ListHeaderComponent === 'function' ? ListHeaderComponent() : ListHeaderComponent)}
      
      {/* Skeleton Rows - Double + Single pattern */}
      {[1, 2, 3].map((rowIndex) => (
        <View key={`skeleton_row_${rowIndex}`}>
          {/* Double Row */}
          <View style={[skeletonStyles.myDecksList, skeletonStyles.myDeckRow, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
            {[0, 1].map((cardIndex) => (
              <View
                key={`skeleton_double_${rowIndex}_${cardIndex}`}
                style={[
                  skeletonStyles.myDeckCardVertical,
                  { height: DECK_SKELETON_VERTICAL_HEIGHT, backgroundColor: bgColor },
                  cardIndex === 0 ? { marginRight: responsiveSpacing.cardMargin } : { marginLeft: responsiveSpacing.cardMargin }
                ]}
              >
                <View style={skeletonStyles.myDeckGradient}>
                  {/* Favorite Button Skeleton - Top Right */}
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50} isDarkMode={isDarkMode} borderRadius={999} style={{ position: 'absolute', top: verticalScale(10), right: scale(10), zIndex: 10 }} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: moderateScale(37), height: moderateScale(37), borderRadius: 999, backgroundColor: lineColor, padding: moderateScale(8) }]} />
                  </ShimmerBox>
                  
                  {/* Badge Section Skeleton - Bottom Left */}
                  <View style={{ position: 'absolute', bottom: verticalScale(12), left: scale(12) }}>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 20} isDarkMode={isDarkMode} borderRadius={moderateScale(14)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.skeletonBox, { width: scale(60), height: verticalScale(28), borderRadius: moderateScale(14), backgroundColor: lineColor, paddingHorizontal: scale(8), paddingVertical: verticalScale(2) }]} />
                    </ShimmerBox>
                  </View>
                  
                  {/* Delete Button Skeleton - Bottom Right */}
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 40} isDarkMode={isDarkMode} borderRadius={999} style={{ position: 'absolute', bottom: verticalScale(7), right: scale(10) }} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: moderateScale(37), height: moderateScale(37), borderRadius: 999, backgroundColor: lineColor, padding: moderateScale(8) }]} />
                  </ShimmerBox>
                  
                  {/* Title Section Skeleton */}
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 60} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.skeletonBox, { width: scale(90), height: moderateScale(16), borderRadius: moderateScale(8), backgroundColor: lineColor }]} />
                    </ShimmerBox>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 80} isDarkMode={isDarkMode} borderRadius={moderateScale(1)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.skeletonBox, { width: scale(60), height: moderateScale(2), borderRadius: moderateScale(1), backgroundColor: lineColor, marginVertical: verticalScale(8) }]} />
                    </ShimmerBox>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 100} isDarkMode={isDarkMode} borderRadius={moderateScale(8)} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.skeletonBox, { width: scale(80), height: moderateScale(16), borderRadius: moderateScale(8), backgroundColor: lineColor }]} />
                    </ShimmerBox>
                  </View>
                </View>
              </View>
            ))}
          </View>
          {/* Single Row */}
          <View style={[skeletonStyles.myDecksList, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
            <View
              style={[
                skeletonStyles.myDeckCardHorizontal,
                { height: DECK_SKELETON_HORIZONTAL_HEIGHT, backgroundColor: bgColor }
              ]}
            >
              <View style={skeletonStyles.myDeckGradient}>
                {/* Favorite Button Skeleton - Top Right */}
                <ShimmerBox delay={rowIndex * 100 + 200} isDarkMode={isDarkMode} borderRadius={999} style={{ position: 'absolute', top: verticalScale(8), right: scale(10), zIndex: 10 }} screenWidth={SCREEN_WIDTH}>
                  <View style={[skeletonStyles.skeletonBox, { width: moderateScale(38), height: moderateScale(38), borderRadius: 999, backgroundColor: lineColor, padding: moderateScale(8) }]} />
                </ShimmerBox>
                
                {/* Badge Section Skeleton - Bottom Left */}
                <View style={{ position: 'absolute', bottom: verticalScale(12), left: scale(12) }}>
                  <ShimmerBox delay={rowIndex * 100 + 220} isDarkMode={isDarkMode} borderRadius={moderateScale(14)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: scale(65), height: verticalScale(28), borderRadius: moderateScale(14), backgroundColor: lineColor, paddingHorizontal: scale(8), paddingVertical: verticalScale(2) }]} />
                  </ShimmerBox>
                </View>
                
                {/* Delete Button Skeleton - Bottom Right */}
                <ShimmerBox delay={rowIndex * 100 + 240} isDarkMode={isDarkMode} borderRadius={999} style={{ position: 'absolute', bottom: verticalScale(8), right: scale(10) }} screenWidth={SCREEN_WIDTH}>
                  <View style={[skeletonStyles.skeletonBox, { width: moderateScale(38), height: moderateScale(38), borderRadius: 999, backgroundColor: lineColor, padding: moderateScale(8) }]} />
                </ShimmerBox>
                
                {/* Title Section Skeleton */}
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ShimmerBox delay={rowIndex * 100 + 260} isDarkMode={isDarkMode} borderRadius={moderateScale(9)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: scale(140), height: moderateScale(18), borderRadius: moderateScale(9), backgroundColor: lineColor }]} />
                  </ShimmerBox>
                  <ShimmerBox delay={rowIndex * 100 + 280} isDarkMode={isDarkMode} borderRadius={moderateScale(1)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: scale(70), height: moderateScale(2), borderRadius: moderateScale(1), backgroundColor: lineColor, marginVertical: verticalScale(10) }]} />
                  </ShimmerBox>
                  <ShimmerBox delay={rowIndex * 100 + 300} isDarkMode={isDarkMode} borderRadius={moderateScale(9)} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.skeletonBox, { width: scale(120), height: moderateScale(18), borderRadius: moderateScale(9), backgroundColor: lineColor }]} />
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
  skeletonBox: {
    // Skeleton placeholder için stil
  },
  myDecksList: {
    // paddingHorizontal ve paddingVertical dinamik olarak uygulanacak
  },
  myDeckRow: {
    flexDirection: 'row',
  },
  myDeckCardVertical: {
    flex: 1,
    borderRadius: moderateScale(18),
    overflow: 'hidden',
  },
  myDeckCardHorizontal: {
    borderRadius: moderateScale(18),
    overflow: 'hidden',
  },
  myDeckGradient: {
    flex: 1,
    borderRadius: moderateScale(18),
    padding: scale(16),
    justifyContent: 'center',
  },
});

