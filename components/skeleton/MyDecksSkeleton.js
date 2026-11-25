import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { ShimmerBox as BaseShimmerBox } from './DeckSkeleton';
import { useDeckGridCardHeight } from '../lists/DeckList';
import { useListBottomInset } from '../ui/CustomTabBar';

// Same shimmer as DeckSkeleton, with a faster 2s sweep.
const ShimmerBox = (props) => <BaseShimmerBox duration={2000} {...props} />;


export default function MyDecksSkeleton({ ListHeaderComponent, contentPaddingTop }) {
  const { colors, isDarkMode } = useTheme();
  const listBottomInset = useListBottomInset();

  const { width, height } = useWindowDimensions();

  const DECK_SKELETON_VERTICAL_HEIGHT = useDeckGridCardHeight();
  const DECK_SKELETON_HORIZONTAL_HEIGHT = DECK_SKELETON_VERTICAL_HEIGHT * 0.82;

  const responsiveSpacing = useMemo(() => ({
    cardMargin: 6,
    listPaddingHorizontal: 12,
    listPaddingVertical: 5,
  }), []);

  const SCREEN_WIDTH = width;
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  const listTopClearance = contentPaddingTop != null ? contentPaddingTop : height * 0.11;

  const listHeader =
    ListHeaderComponent == null
      ? null
      : typeof ListHeaderComponent === 'function'
        ? ListHeaderComponent()
        : ListHeaderComponent;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: listTopClearance }}>
      {listHeader}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: listBottomInset, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      >
      {/* Skeleton Rows */}
      {[1, 2, 3].map((rowIndex) => (
        <View key={`skeleton_row_${rowIndex}`}>

          {/* --- DOUBLE ROW (İKİLİ KARTLAR) --- */}
          <View style={[skeletonStyles.myDecksList, skeletonStyles.myDeckRow, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
            {[0, 1].map((cardIndex) => (
              <View
                key={`skeleton_double_${rowIndex}_${cardIndex}`}
                style={[
                  skeletonStyles.myDeckCardVertical,
                  { height: DECK_SKELETON_VERTICAL_HEIGHT, backgroundColor: bgColor },
                  cardIndex === 0 ? { marginRight: responsiveSpacing.cardMargin } : { marginLeft: responsiveSpacing.cardMargin }
                ]}
              >
                <View style={skeletonStyles.myDeckGradient}>

                  {/* Üst Kısım: Favori Butonu Sağda */}
                  <View style={skeletonStyles.topRow}>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50} isDarkMode={isDarkMode} borderRadius={999} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.iconSkeleton, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                  </View>

                  {/* Orta Kısım: Başlıklar ve Çizgi */}
                  <View style={skeletonStyles.centerRow}>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 60} isDarkMode={isDarkMode} borderRadius={8} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.titleSkeleton, { backgroundColor: lineColor }]} />
                    </ShimmerBox>

                    <View style={[skeletonStyles.divider, { backgroundColor: lineColor }]} />

                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 100} isDarkMode={isDarkMode} borderRadius={8} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.subtitleSkeleton, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                  </View>

                  {/* Alt Kısım: Rozet ve Sil Butonu */}
                  <View style={skeletonStyles.bottomRow}>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 20} isDarkMode={isDarkMode} borderRadius={14} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.badgeSkeleton, { backgroundColor: lineColor }]} />
                    </ShimmerBox>

                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 40} isDarkMode={isDarkMode} borderRadius={999} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.iconSkeleton, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                  </View>

                </View>
              </View>
            ))}
          </View>

          {/* --- SINGLE ROW (TEKLİ KART) --- */}
          <View style={[skeletonStyles.myDecksList, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
            <View style={[skeletonStyles.myDeckCardHorizontal, { height: DECK_SKELETON_HORIZONTAL_HEIGHT, backgroundColor: bgColor }]}>
              <View style={skeletonStyles.myDeckGradient}>

                {/* Üst Kısım: Favori Butonu */}
                <View style={skeletonStyles.topRow}>
                  <ShimmerBox delay={rowIndex * 100 + 200} isDarkMode={isDarkMode} borderRadius={999} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.iconSkeleton, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>

                {/* Orta Kısım: Başlıklar ve Çizgi */}
                <View style={skeletonStyles.centerRow}>
                  <ShimmerBox delay={rowIndex * 100 + 260} isDarkMode={isDarkMode} borderRadius={9} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.titleSkeletonLarge, { backgroundColor: lineColor }]} />
                  </ShimmerBox>

                  <View style={[skeletonStyles.dividerLarge, { backgroundColor: lineColor }]} />

                  <ShimmerBox delay={rowIndex * 100 + 300} isDarkMode={isDarkMode} borderRadius={9} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.subtitleSkeletonLarge, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>

                {/* Alt Kısım: Rozet ve Sil Butonu */}
                <View style={skeletonStyles.bottomRow}>
                  <ShimmerBox delay={rowIndex * 100 + 220} isDarkMode={isDarkMode} borderRadius={14} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.badgeSkeletonLarge, { backgroundColor: lineColor }]} />
                  </ShimmerBox>

                  <ShimmerBox delay={rowIndex * 100 + 240} isDarkMode={isDarkMode} borderRadius={999} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.iconSkeleton, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>

              </View>
            </View>
          </View>
        </View>
      ))}
      </ScrollView>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  myDecksList: {},
  myDeckRow: {
    flexDirection: 'row',
  },
  myDeckCardVertical: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  myDeckCardHorizontal: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  myDeckGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },

  // Flex Layout Sınıfları
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
  centerRow: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },

  // Ortak Boyutlar
  iconSkeleton: {
    width: 37,
    height: 37,
    borderRadius: 999,
  },
  badgeSkeleton: {
    width: 60,
    height: 28,
    borderRadius: 14,
  },
  badgeSkeletonLarge: {
    width: 65,
    height: 28,
    borderRadius: 14,
  },
  titleSkeleton: {
    width: 90,
    height: 16,
    borderRadius: 8,
  },
  titleSkeletonLarge: {
    width: 140,
    height: 18,
    borderRadius: 9,
  },
  subtitleSkeleton: {
    width: 80,
    height: 16,
    borderRadius: 8,
  },
  subtitleSkeletonLarge: {
    width: 120,
    height: 18,
    borderRadius: 9,
  },
  divider: {
    width: 60,
    height: 2,
    borderRadius: 1,
    marginVertical: 10,
    opacity: 0.5,
  },
  dividerLarge: {
    width: 70,
    height: 2,
    borderRadius: 1,
    marginVertical: 12,
    opacity: 0.5,
  }
});