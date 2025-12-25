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

export default function MyDecksSkeleton() {
  const { colors, isDarkMode } = useTheme();
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';
  const cardBgColor = isDarkMode ? 'rgba(50, 50, 50, 0.5)' : 'rgba(50, 50, 50, 0.1)';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: '25%', paddingTop: '25%' }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Card Skeleton */}
      <View style={[skeletonStyles.myDecksCard, skeletonStyles.myDecksCardContainer, { backgroundColor: cardBgColor }]}>
        <View style={skeletonStyles.myDecksContent}>
          <View style={skeletonStyles.myDecksTextContainer}>
            <View style={skeletonStyles.myDecksTitleContainer}>
              <ShimmerBox delay={0} isDarkMode={isDarkMode} borderRadius={13}>
                <View style={[skeletonStyles.skeletonBox, { width: 26, height: 26, borderRadius: 13, backgroundColor: lineColor, marginRight: 6 }]} />
              </ShimmerBox>
              <ShimmerBox delay={20} isDarkMode={isDarkMode} borderRadius={8}>
                <View style={[skeletonStyles.skeletonBox, { width: 120, height: 24, borderRadius: 8, backgroundColor: lineColor }]} />
              </ShimmerBox>
            </View>
            <ShimmerBox delay={40} isDarkMode={isDarkMode} borderRadius={6}>
              <View style={[skeletonStyles.skeletonBox, { width: '95%', height: 16, borderRadius: 6, backgroundColor: lineColor, marginTop: 8 }]} />
            </ShimmerBox>
            <ShimmerBox delay={60} isDarkMode={isDarkMode} borderRadius={6}>
              <View style={[skeletonStyles.skeletonBox, { width: '85%', height: 16, borderRadius: 6, backgroundColor: lineColor, marginTop: 4 }]} />
            </ShimmerBox>
          </View>
          <View style={skeletonStyles.myDecksImageContainer}>
            <ShimmerBox delay={80} isDarkMode={isDarkMode} borderRadius={12}>
              <View style={[skeletonStyles.skeletonBox, { width: 160, height: 160, borderRadius: 12, backgroundColor: lineColor }]} />
            </ShimmerBox>
          </View>
        </View>
        <View style={skeletonStyles.myDecksSearchContainer}>
          <ShimmerBox delay={100} isDarkMode={isDarkMode} borderRadius={24}>
            <View style={[skeletonStyles.skeletonBox, { flex: 1, height: 48, borderRadius: 24, backgroundColor: lineColor }]} />
          </ShimmerBox>
          <ShimmerBox delay={120} isDarkMode={isDarkMode} borderRadius={30}>
            <View style={[skeletonStyles.skeletonBox, { width: 48, height: 48, borderRadius: 30, backgroundColor: lineColor, marginLeft: 10 }]} />
          </ShimmerBox>
        </View>
      </View>

      {/* Skeleton Rows - Double + Single pattern */}
      {[1, 2, 3].map((rowIndex) => (
        <View key={`skeleton_row_${rowIndex}`}>
          {/* Double Row */}
          <View style={[skeletonStyles.myDecksList, skeletonStyles.myDeckRow]}>
            {[0, 1].map((cardIndex) => (
              <View
                key={`skeleton_double_${rowIndex}_${cardIndex}`}
                style={[
                  skeletonStyles.myDeckCardVertical,
                  { backgroundColor: bgColor },
                  cardIndex === 0 ? { marginRight: 5 } : { marginLeft: 5 }
                ]}
              >
                <View style={{ position: 'absolute', top: 10, right: 10 }}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50} isDarkMode={isDarkMode} borderRadius={999}>
                    <View style={[skeletonStyles.skeletonBox, { width: 37, height: 37, borderRadius: 999, backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
                <View style={{ position: 'absolute', bottom: 12, left: 12 }}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 20} isDarkMode={isDarkMode} borderRadius={14}>
                    <View style={[skeletonStyles.skeletonBox, { width: 60, height: 28, borderRadius: 14, backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
                <View style={{ position: 'absolute', bottom: 7, right: 10 }}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 40} isDarkMode={isDarkMode} borderRadius={999}>
                    <View style={[skeletonStyles.skeletonBox, { width: 37, height: 37, borderRadius: 999, backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 60} isDarkMode={isDarkMode} borderRadius={8}>
                    <View style={[skeletonStyles.skeletonBox, { width: 80, height: 16, borderRadius: 8, backgroundColor: lineColor, marginBottom: 8 }]} />
                  </ShimmerBox>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 80} isDarkMode={isDarkMode} borderRadius={1}>
                    <View style={[skeletonStyles.skeletonBox, { width: 60, height: 2, borderRadius: 1, backgroundColor: lineColor, marginVertical: 8 }]} />
                  </ShimmerBox>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 100} isDarkMode={isDarkMode} borderRadius={8}>
                    <View style={[skeletonStyles.skeletonBox, { width: 70, height: 16, borderRadius: 8, backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>
              </View>
            ))}
          </View>
          {/* Single Row */}
          <View style={skeletonStyles.myDecksList}>
            <View
              style={[
                skeletonStyles.myDeckCardHorizontal,
                { backgroundColor: bgColor }
              ]}
            >
              <View style={{ position: 'absolute', top: 8, right: 10 }}>
                <ShimmerBox delay={rowIndex * 100 + 200} isDarkMode={isDarkMode} borderRadius={999}>
                  <View style={[skeletonStyles.skeletonBox, { width: 38, height: 38, borderRadius: 999, backgroundColor: lineColor }]} />
                </ShimmerBox>
              </View>
              <View style={{ position: 'absolute', bottom: 12, left: 12 }}>
                <ShimmerBox delay={rowIndex * 100 + 220} isDarkMode={isDarkMode} borderRadius={14}>
                  <View style={[skeletonStyles.skeletonBox, { width: 65, height: 28, borderRadius: 14, backgroundColor: lineColor }]} />
                </ShimmerBox>
              </View>
              <View style={{ position: 'absolute', bottom: 8, right: 10 }}>
                <ShimmerBox delay={rowIndex * 100 + 240} isDarkMode={isDarkMode} borderRadius={999}>
                  <View style={[skeletonStyles.skeletonBox, { width: 38, height: 38, borderRadius: 999, backgroundColor: lineColor }]} />
                </ShimmerBox>
              </View>
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
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const skeletonStyles = StyleSheet.create({
  myDecksCard: {
    marginTop: '21%',
  },
  myDecksCardContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    marginHorizontal: 10,
    marginVertical: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 180,
  },
  myDecksContent: {
    flexDirection: 'row',
  },
  myDecksTextContainer: {
    flex: 1,
    marginRight: 15,
    gap: 5,
  },
  myDecksTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: '5%',
  },
  myDecksImageContainer: {
    width: 150,
    height: 150,
    marginTop: 12,
  },
  myDecksSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 8,
  },
  skeletonBox: {
    // Skeleton placeholder için stil
  },
  myDecksList: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  myDeckRow: {
    flexDirection: 'row',
  },
  myDeckCardVertical: {
    flex: 1,
    height: 240,
    borderRadius: 18,
    overflow: 'hidden',
  },
  myDeckCardHorizontal: {
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
  },
});

