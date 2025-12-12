import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/theme';

export default function DeckSkeleton() {
  const { isDarkMode } = useTheme();
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  return (
    <View style={[styles.skeletonCard, { backgroundColor: bgColor }]}>
      {/* Profil kısmı - üstte */}
      <View style={styles.profileRow}>
        <View style={[styles.avatar, { backgroundColor: lineColor }]} />
        <View style={[styles.usernameLine, { backgroundColor: lineColor }]} />
      </View>
      
      {/* Başlık kısmı - ortada */}
      <View style={styles.titleSection}>
        <View style={[styles.titleLine, { backgroundColor: lineColor }]} />
        <View style={[styles.divider, { backgroundColor: lineColor }]} />
        <View style={[styles.subtitleLine, { backgroundColor: lineColor }]} />
      </View>
      
      {/* İstatistik kısmı - altta */}
      <View style={styles.statsSection}>
        <View style={[styles.badge, { backgroundColor: lineColor }]} />
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