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

export default function DeckSkeleton() {
  const { isDarkMode } = useTheme();
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  return (
    <View style={[styles.skeletonCard, { backgroundColor: bgColor }]}>
      {/* Profil kısmı - üstte */}
      <View style={styles.profileRow}>
        <ShimmerBox delay={0} isDarkMode={isDarkMode} borderRadius={11}>
          <View style={[styles.avatar, { backgroundColor: lineColor }]} />
        </ShimmerBox>
        <ShimmerBox delay={20} isDarkMode={isDarkMode} borderRadius={7}>
          <View style={[styles.usernameLine, { backgroundColor: lineColor }]} />
        </ShimmerBox>
      </View>
      
      {/* Başlık kısmı - ortada */}
      <View style={styles.titleSection}>
        <ShimmerBox delay={40} isDarkMode={isDarkMode} borderRadius={8}>
          <View style={[styles.titleLine, { backgroundColor: lineColor }]} />
        </ShimmerBox>
        <ShimmerBox delay={60} isDarkMode={isDarkMode} borderRadius={1}>
          <View style={[styles.divider, { backgroundColor: lineColor }]} />
        </ShimmerBox>
        <ShimmerBox delay={80} isDarkMode={isDarkMode} borderRadius={8}>
          <View style={[styles.subtitleLine, { backgroundColor: lineColor }]} />
        </ShimmerBox>
      </View>
      
      {/* İstatistik kısmı - altta */}
      <View style={styles.statsSection}>
        <ShimmerBox delay={100} isDarkMode={isDarkMode} borderRadius={12}>
          <View style={[styles.badge, { backgroundColor: lineColor }]} />
        </ShimmerBox>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    width: 140,
    height: 196,
    borderRadius: 18,
    marginRight: 10,
    marginBottom: 8,
    padding: 8,
    justifyContent: 'space-between',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 120,
  },
  avatar: {
    width: 27,
    height: 27,
    borderRadius: 11,
    marginRight: 6,
  },
  usernameLine: {
    width: 60,
    height: 14,
    borderRadius: 7,
  },
  titleSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleLine: {
    width: 80,
    height: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  divider: {
    width: 60,
    height: 2,
    borderRadius: 1,
    marginBottom: 8,
  },
  subtitleLine: {
    width: 70,
    height: 16,
    borderRadius: 8,
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -18,
    left: 2,
  },
  badge: {
    width: 40,
    height: 24,
    borderRadius: 12,
  },
}); 