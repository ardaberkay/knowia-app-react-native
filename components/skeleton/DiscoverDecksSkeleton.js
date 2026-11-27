import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme/theme';
import { ShimmerBox as BaseShimmerBox } from './DeckSkeleton';
import { useDeckGridCardHeight } from '../lists/DeckList';
import { useListBottomInset } from '../ui/TabBarInset';

// Same shimmer as DeckSkeleton, with a faster 2s sweep.
const ShimmerBox = (props) => <BaseShimmerBox duration={2000} {...props} />;


export default function DiscoverDecksSkeleton() {
  const { colors, isDarkMode } = useTheme();
  const listBottomInset = useListBottomInset();
  
  const { width } = useWindowDimensions();
  const deckSkeletonHeight = useDeckGridCardHeight();

  const responsiveSpacing = useMemo(() => ({
    cardMargin: 6,
    listPaddingHorizontal: 12,
    listPaddingVertical: 5,
  }), []);
  
  const SCREEN_WIDTH = width;
  const bgColor = isDarkMode ? '#222' : '#ececec';
  const lineColor = isDarkMode ? '#333' : '#ddd';

  // 2-2-2 Izgara yapısı için satırlar
  const rows = [1, 2, 3];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: listBottomInset }} /* top offset comes from the screen, same as the real list */
      showsVerticalScrollIndicator={false}
    >
      {rows.map((rowIndex) => (
        <View 
          key={`skeleton_row_${rowIndex}`}
          style={[
            skeletonStyles.deckRow, 
            { 
              paddingHorizontal: responsiveSpacing.listPaddingHorizontal, 
              paddingVertical: responsiveSpacing.listPaddingVertical 
            }
          ]}
        >
          {[0, 1].map((cardIndex) => (
            <View
              key={`skeleton_card_${rowIndex}_${cardIndex}`}
              style={[
                skeletonStyles.deckCardVertical,
                { height: deckSkeletonHeight, backgroundColor: bgColor },
                cardIndex === 0 ? { marginRight: responsiveSpacing.cardMargin } : { marginLeft: responsiveSpacing.cardMargin }
              ]}
            >
              <View style={skeletonStyles.deckGradient}>
                
                {/* Mutlak Konumlandırılmış Popülerlik Rozeti Skeleton (Sağ Üst Köşe) */}
                <ShimmerBox
                  delay={rowIndex * 100 + cardIndex * 50 + 30}
                  isDarkMode={isDarkMode}
                  style={skeletonStyles.popularityBadgeWrapper}
                  screenWidth={SCREEN_WIDTH}
                >
                  <View style={[skeletonStyles.popularityBadge, { backgroundColor: lineColor }]} />
                </ShimmerBox>

                {/* Üst Kısım: Profil (Sola Dayalı) */}
                <View style={skeletonStyles.topRowStart}>
                  <View style={skeletonStyles.profileRow}>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50} isDarkMode={isDarkMode} borderRadius={99} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.avatarSmall, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                    <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 20} isDarkMode={isDarkMode} borderRadius={7} screenWidth={SCREEN_WIDTH}>
                      <View style={[skeletonStyles.nameSmall, { backgroundColor: lineColor }]} />
                    </ShimmerBox>
                  </View>
                </View>

                {/* Orta Kısım: Başlıklar ve Ayırıcı Çizgi */}
                <View style={skeletonStyles.centerRow}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 40} isDarkMode={isDarkMode} borderRadius={8} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.title, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                  
                  <View style={[skeletonStyles.divider, { backgroundColor: lineColor }]} />
                  
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 80} isDarkMode={isDarkMode} borderRadius={8} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.subtitle, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>

                {/* Alt Kısım: Sol Rozet / Sayaç ve Sağ Favori Butonu */}
                <View style={skeletonStyles.bottomRowBetween}>
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 110} isDarkMode={isDarkMode} borderRadius={14} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.badgeCount, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                  
                  <ShimmerBox delay={rowIndex * 100 + cardIndex * 50 + 120} isDarkMode={isDarkMode} borderRadius={999} screenWidth={SCREEN_WIDTH}>
                    <View style={[skeletonStyles.favIcon, { backgroundColor: lineColor }]} />
                  </ShimmerBox>
                </View>

              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const skeletonStyles = StyleSheet.create({
  deckRow: {
    flexDirection: 'row',
  },
  deckCardVertical: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative', // Mutlak rozet konumlandırması için
  },
  deckGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  
  // Popülerlik Rozeti (Birebir orjinal stillerinizle eşleşti)
  popularityBadgeWrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 20,
    borderBottomLeftRadius: 14,
  },
  popularityBadge: {
    width: 62,
    height: 28,
    borderBottomLeftRadius: 14,
  },

  // Layout Hizamaları
  topRowStart: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
  },
  centerRow: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
  },
  
  // İç Elemanlar
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '65%', // Sağ üstteki rozetin altına girmemesi için genişlik sınırı
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 99,
    marginRight: 6,
  },
  nameSmall: {
    width: 60,
    height: 13,
    borderRadius: 6,
  },
  title: {
    width: 80,
    height: 16,
    borderRadius: 8,
  },
  subtitle: {
    width: 65,
    height: 14,
    borderRadius: 7,
  },
  badgeCount: {
    width: 55,
    height: 24,
    borderRadius: 12,
  },
  favIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
  },
  divider: {
    width: 50,
    height: 2,
    borderRadius: 1,
    marginVertical: 8,
    opacity: 0.5,
  },
});