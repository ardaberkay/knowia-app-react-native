import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../theme/theme';

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
              <View style={[skeletonStyles.skeletonBox, { width: 26, height: 26, borderRadius: 13, backgroundColor: lineColor, marginRight: 6 }]} />
              <View style={[skeletonStyles.skeletonBox, { width: 120, height: 24, borderRadius: 8, backgroundColor: lineColor }]} />
            </View>
            <View style={[skeletonStyles.skeletonBox, { width: '95%', height: 16, borderRadius: 6, backgroundColor: lineColor, marginTop: 8 }]} />
            <View style={[skeletonStyles.skeletonBox, { width: '85%', height: 16, borderRadius: 6, backgroundColor: lineColor, marginTop: 4 }]} />
          </View>
          <View style={skeletonStyles.myDecksImageContainer}>
            <View style={[skeletonStyles.skeletonBox, { width: 160, height: 160, borderRadius: 12, backgroundColor: lineColor }]} />
          </View>
        </View>
        <View style={skeletonStyles.myDecksSearchContainer}>
          <View style={[skeletonStyles.skeletonBox, { flex: 1, height: 48, borderRadius: 24, backgroundColor: lineColor }]} />
          <View style={[skeletonStyles.skeletonBox, { width: 48, height: 48, borderRadius: 30, backgroundColor: lineColor, marginLeft: 10 }]} />
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
                <View style={[skeletonStyles.skeletonBox, { position: 'absolute', top: 10, right: 10, width: 37, height: 37, borderRadius: 999, backgroundColor: lineColor }]} />
                <View style={[skeletonStyles.skeletonBox, { position: 'absolute', bottom: 12, left: 12, width: 60, height: 28, borderRadius: 14, backgroundColor: lineColor }]} />
                <View style={[skeletonStyles.skeletonBox, { position: 'absolute', bottom: 7, right: 10, width: 37, height: 37, borderRadius: 999, backgroundColor: lineColor }]} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <View style={[skeletonStyles.skeletonBox, { width: 80, height: 16, borderRadius: 8, backgroundColor: lineColor, marginBottom: 8 }]} />
                  <View style={[skeletonStyles.skeletonBox, { width: 60, height: 2, borderRadius: 1, backgroundColor: lineColor, marginVertical: 8 }]} />
                  <View style={[skeletonStyles.skeletonBox, { width: 70, height: 16, borderRadius: 8, backgroundColor: lineColor }]} />
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
              <View style={[skeletonStyles.skeletonBox, { position: 'absolute', top: 8, right: 10, width: 38, height: 38, borderRadius: 999, backgroundColor: lineColor }]} />
              <View style={[skeletonStyles.skeletonBox, { position: 'absolute', bottom: 12, left: 12, width: 65, height: 28, borderRadius: 14, backgroundColor: lineColor }]} />
              <View style={[skeletonStyles.skeletonBox, { position: 'absolute', bottom: 8, right: 10, width: 38, height: 38, borderRadius: 999, backgroundColor: lineColor }]} />
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <View style={[skeletonStyles.skeletonBox, { width: 140, height: 18, borderRadius: 9, backgroundColor: lineColor, marginBottom: 10 }]} />
                <View style={[skeletonStyles.skeletonBox, { width: 70, height: 2, borderRadius: 1, backgroundColor: lineColor, marginVertical: 10 }]} />
                <View style={[skeletonStyles.skeletonBox, { width: 120, height: 18, borderRadius: 9, backgroundColor: lineColor }]} />
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

