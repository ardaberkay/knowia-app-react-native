import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Animated, Dimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Shimmer overlay component
const ShimmerOverlay = ({ style, delay = 0, isDarkMode = false, borderRadius = 0 }) => {
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
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
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
        style={{ flex: 1, width: SCREEN_WIDTH, borderRadius: borderRadius }}
      />
    </Animated.View>
  );
};

// Shimmer wrapper for skeleton boxes
const ShimmerBox = ({ children, style, delay = 0, isDarkMode = false, borderRadius = 0 }) => {
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
      />
    </View>
  );
};

export default function DiscoverDecksSkeleton() {
  const { colors, isDarkMode } = useTheme();
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: '10%', paddingTop: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Skeleton Rows - Double + Single pattern (DeckList layout'una uygun) */}
      {[1, 2, 3, 4].map((rowIndex) => (
        <View key={`skeleton_row_${rowIndex}`}>
          {/* Double Row */}
          <View style={[skeletonStyles.deckList, skeletonStyles.deckRow]}>
            {[0, 1].map((cardIndex) => (
              <View
                key={`skeleton_double_${rowIndex}_${cardIndex}`}
                style={[
                  skeletonStyles.deckCardVertical,
                  { backgroundColor: bgColor },
                  cardIndex === 0 ? { marginRight: 5 } : { marginLeft: 5 }
                ]}
              >
                {/* Profile Section Skeleton - Top Left */}
                <View style={skeletonStyles.deckProfileRow}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50} isDarkMode={isDarkMode} borderRadius={16}>
                    <View style={[skeletonStyles.skeletonBox, { width: 32, height: 32, borderRadius: 16, backgroundColor: lineColor, marginRight: 6 }]} />
                  </ShimmerBox>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 20} isDarkMode={isDarkMode} borderRadius={7}>
                    <View style={[skeletonStyles.skeletonBox, { width: 60, height: 14, borderRadius: 7, backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
                
                {/* Title Section Skeleton */}
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 40} isDarkMode={isDarkMode} borderRadius={8}>
                    <View style={[skeletonStyles.skeletonBox, { width: 80, height: 16, borderRadius: 8, backgroundColor: lineColor, marginBottom: 8 }]} />
                  </ShimmerBox>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 60} isDarkMode={isDarkMode} borderRadius={1}>
                    <View style={[skeletonStyles.skeletonBox, { width: 60, height: 2, borderRadius: 1, backgroundColor: lineColor, marginVertical: 8 }]} />
                  </ShimmerBox>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 80} isDarkMode={isDarkMode} borderRadius={8}>
                    <View style={[skeletonStyles.skeletonBox, { width: 70, height: 16, borderRadius: 8, backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
                
                {/* Badge Section Skeleton */}
                <View style={{ position: 'absolute', bottom: 12, left: 12 }}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 100} isDarkMode={isDarkMode} borderRadius={14}>
                    <View style={[skeletonStyles.skeletonBox, { width: 60, height: 28, borderRadius: 14, backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
                
                {/* Favorite Button Skeleton - Bottom Right */}
                <View style={{ position: 'absolute', bottom: 8, right: 10 }}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 120} isDarkMode={isDarkMode} borderRadius={999}>
                    <View style={[skeletonStyles.skeletonBox, { width: 37, height: 37, borderRadius: 999, backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
              </View>
            ))}
          </View>
          
          {/* Single Row */}
          <View style={skeletonStyles.deckList}>
            <View style={[skeletonStyles.deckCardHorizontal, { backgroundColor: bgColor }]}>
              {/* Profile Section Skeleton - Bottom Left */}
              <View style={[skeletonStyles.deckProfileRow, { top: 'auto', bottom: 8 }]}>
                <ShimmerBox delay={rowIndex * 100 + 200} isDarkMode={isDarkMode} borderRadius={16}>
                  <View style={[skeletonStyles.skeletonBox, { width: 32, height: 32, borderRadius: 16, backgroundColor: lineColor, marginRight: 6 }]} />
                </ShimmerBox>
                <ShimmerBox delay={rowIndex * 100 + 220} isDarkMode={isDarkMode} borderRadius={7}>
                  <View style={[skeletonStyles.skeletonBox, { width: 70, height: 14, borderRadius: 7, backgroundColor: lineColor }]} />
                </ShimmerBox>
              </View>
              
              {/* Favorite Button Skeleton - Top Right */}
              <View style={{ position: 'absolute', top: 8, right: 10 }}>
                <ShimmerBox delay={rowIndex * 100 + 240} isDarkMode={isDarkMode} borderRadius={999}>
                  <View style={[skeletonStyles.skeletonBox, { width: 38, height: 38, borderRadius: 999, backgroundColor: lineColor }]} />
                </ShimmerBox>
              </View>
              
              {/* Title Section Skeleton */}
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ShimmerBox delay={rowIndex * 100 + 260} isDarkMode={isDarkMode} borderRadius={9}>
                  <View style={[skeletonStyles.skeletonBox, { width: 140, height: 18, borderRadius: 9, backgroundColor: lineColor, marginBottom: 10 }]} />
                </ShimmerBox>
                <ShimmerBox delay={rowIndex * 100 + 280} isDarkMode={isDarkMode} borderRadius={1}>
                  <View style={[skeletonStyles.skeletonBox, { width: 70, height: 2, borderRadius: 1, backgroundColor: lineColor, marginVertical: 10 }]} />
                </ShimmerBox>
                <ShimmerBox delay={rowIndex * 100 + 300} isDarkMode={isDarkMode} borderRadius={9}>
                  <View style={[skeletonStyles.skeletonBox, { width: 120, height: 18, borderRadius: 9, backgroundColor: lineColor }]} />
                </ShimmerBox>
              </View>
              
              {/* Badge Section Skeleton - Bottom Right */}
              <View style={{ position: 'absolute', bottom: 10, right: 12 }}>
                <ShimmerBox delay={rowIndex * 100 + 320} isDarkMode={isDarkMode} borderRadius={14}>
                  <View style={[skeletonStyles.skeletonBox, { width: 65, height: 28, borderRadius: 14, backgroundColor: lineColor }]} />
                </ShimmerBox>
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
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  deckRow: {
    flexDirection: 'row',
  },
  deckCardVertical: {
    flex: 1,
    height: 240,
    borderRadius: 18,
    overflow: 'hidden',
  },
  deckCardHorizontal: {
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
  },
  deckProfileRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    top: 8,
    left: 10,
  },
  skeletonBox: {
    // Skeleton placeholder için stil
  },
});

