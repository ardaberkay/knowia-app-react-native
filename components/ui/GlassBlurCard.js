import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/theme';

export default function GlassBlurCard({ children, style, intensity = 50 }) {
  const { colors, isDarkMode } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <BlurView
        intensity={intensity}
        tint={isDarkMode ? 'dark' : 'light'}
        style={styles.blurView}
      >
        <View style={[
          styles.content,
          { backgroundColor: isDarkMode ? 'rgba(50, 50, 50, 0.5)' : 'rgba(50, 50, 50, 0.1)' }
        ]}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 40,
    overflow: 'hidden',
    marginHorizontal: 10,
    marginVertical: 8,
  },
  blurView: {
    borderRadius: 28,
  },
  content: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 180,
  },
});
