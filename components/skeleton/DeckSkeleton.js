import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/theme';

export function ProfileSkeleton() {
  const { isDarkMode } = useTheme();
  const skeletonColor = isDarkMode ? '#444' : '#e0e0e0';
  return (
    <View style={profileSkeletonStyles.row}>
      <View style={[profileSkeletonStyles.avatarSkeleton, { backgroundColor: skeletonColor }]} />
      <View style={profileSkeletonStyles.infoColumn}>
        <View style={[profileSkeletonStyles.nameSkeleton, { backgroundColor: skeletonColor }]} />
        <View style={[profileSkeletonStyles.emailSkeleton, { backgroundColor: skeletonColor }]} />
      </View>
    </View>
  );
}

const profileSkeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
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
    height: 24,
    borderRadius: 6,
    marginBottom: 8,
  },
  emailSkeleton: {
    width: '80%',
    height: 16,
    borderRadius: 6,
  },
});

export default function DeckSkeleton() {
  const { isDarkMode } = useTheme();
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  return (
    <View style={[styles.skeletonCard, { backgroundColor: bgColor }]}>
      <View style={[styles.avatar, { backgroundColor: lineColor }]} />
      <View style={[styles.line, { backgroundColor: lineColor }]} />
      <View style={[styles.lineShort, { backgroundColor: lineColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    width: 130,
    height: 180,
    borderRadius: 18,
    marginRight: 8,
    marginBottom: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  line: {
    width: 80,
    height: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  lineShort: {
    width: 50,
    height: 12,
    borderRadius: 6,
  },
}); 