import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
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

export default function ProfileSkeleton() {
  const { isDarkMode } = useTheme();
  const skeletonColor = isDarkMode ? '#444' : '#e0e0e0';
  return (
    <View style={profileSkeletonStyles.row}>
      <ShimmerBox delay={0} isDarkMode={isDarkMode} borderRadius={50}>
        <View style={[profileSkeletonStyles.avatarSkeleton, { backgroundColor: skeletonColor }]} />
      </ShimmerBox>
      <View style={profileSkeletonStyles.infoColumn}>
        <ShimmerBox delay={20} isDarkMode={isDarkMode} borderRadius={6}>
          <View style={[profileSkeletonStyles.nameSkeleton, { backgroundColor: skeletonColor }]} />
        </ShimmerBox>
        <ShimmerBox delay={40} isDarkMode={isDarkMode} borderRadius={6}>
          <View style={[profileSkeletonStyles.emailSkeleton, { backgroundColor: skeletonColor }]} />
        </ShimmerBox>
      </View>
    </View>
  );
}

const profileSkeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSkeleton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 20,
  },
  infoColumn: {
    flex: 1,
  },
  nameSkeleton: {
    width: '60%',
    height: 22,
    borderRadius: 6,
    marginBottom: 4,
  },
  emailSkeleton: {
    width: '80%',
    height: 16,
    borderRadius: 6,
  },
});
