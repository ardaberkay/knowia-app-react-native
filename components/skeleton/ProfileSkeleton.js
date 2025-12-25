import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/theme';

export default function ProfileSkeleton() {
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
