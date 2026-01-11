import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { scale, moderateScale, verticalScale } from 'react-native-size-matters';
import { typography } from '../../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Shimmer efekti için component
const ShimmerView = ({ style, isDarkMode }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
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
          ...StyleSheet.absoluteFillObject,
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
    width: scale(80),
    height: scale(80),
    borderRadius: moderateScale(99),
    marginRight: scale(20),
  },
  userInfo: {
    flex: 1,
  },
  name: {
    width: '80%',
    height: typography.styles.h2.fontSize,
    borderRadius: 4,
    marginBottom: verticalScale(8),
  },
  email: {
    width: '90%',
    height: typography.styles.body.fontSize,
    borderRadius: 4,
  },
});
