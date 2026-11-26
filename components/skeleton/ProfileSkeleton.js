import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';


// Shimmer efekti için component
const ShimmerView = ({ style, isDarkMode }) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  const shimmerColors = isDarkMode
    ? ['#444', '#555', '#444']
    : ['#e0e0e0', '#f5f5f5', '#e0e0e0'];

  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: isDarkMode ? '#444' : '#e0e0e0' }]}>
      <Animated.View
        style={{
          ...StyleSheet.absoluteFill,
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={shimmerColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, width: SCREEN_WIDTH }}
        />
      </Animated.View>
    </View>
  );
};

export default function ProfileSkeleton() {
  const { isDarkMode } = useTheme();
  
  return (
    <>
      <ShimmerView style={styles.avatar} isDarkMode={isDarkMode} />
      <View style={styles.userInfo}>
        <ShimmerView style={styles.name} isDarkMode={isDarkMode} />
        <ShimmerView style={styles.email} isDarkMode={isDarkMode} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 99,
    marginRight: 20,
  },
  userInfo: {
    flex: 1,
  },
  name: {
    width: '80%',
    height: typography.styles.title2.fontSize,
    borderRadius: 24,
    marginBottom: 8,
  },
  email: {
    width: '90%',
    height: typography.styles.body.fontSize,
    borderRadius: 24,
  },
});
