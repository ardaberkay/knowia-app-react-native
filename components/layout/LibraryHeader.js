import React, { memo } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import SegmentedControl from '../ui/SegmentedControl';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { moderateScale, scale, verticalScale } from '../../lib/scaling';

/**
 * Library header: one flat surface (theme card colour) holding a per-tab intro
 * (title + text + illustration) and the segmented control under it.
 *
 * `progress` = PagerView position + offset (native Animated value). The intro
 * cross-fades between tabs on that value, so swiping the pager animates the
 * header without any React re-render.
 */
function LibraryHeader({ progress, onTabPress }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const tabs = [
    {
      key: 'myDecks',
      label: t('library.myDecks', 'Destelerim'),
      icon: 'ph:cards-fill',
      title: t('library.myDecksHeading', 'Destelerim'),
      subtitle: t('library.myDecksSubtitle', 'Oluşturduğun destelerle kendi öğrenme yolculuğunu tasarla; keşfet, pekiştir ve hedeflerine doğru ilerle'),
      image: require('../../assets/mydecks_item.webp'),
    },
    {
      key: 'favorites',
      label: t('library.favorites', 'Favorilerim'),
      icon: 'solar:heart-bold',
      title: t('library.favorites', 'Favorilerim'),
      subtitle: t('library.favoritesShortSubtitle', 'Beğendiğin desteler ve kartlar tek yerde.'),
      image: require('../../assets/shared.webp'),
    },
  ];

  return (
    <View
      style={[
        styles.surface,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
          paddingTop: insets.top + verticalScale(24),
        },
      ]}
    >
      <View style={styles.introArea}>
        {tabs.map((tab, index) => {
          const opacity = progress.interpolate({
            inputRange: [index - 1, index - 0.5, index, index + 0.5, index + 1],
            outputRange: [0, 0, 1, 0, 0],
            extrapolate: 'clamp',
          });
          const translateY = progress.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [verticalScale(6), 0, verticalScale(6)],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={tab.key}
              pointerEvents="none"
              style={[styles.intro, { opacity, transform: [{ translateY }] }]}
            >
              <View style={styles.introText}>
                <Animated.Text style={[typography.styles.h2, styles.title, { color: colors.text }]} numberOfLines={1}>
                  {tab.title}
                </Animated.Text>
                <Animated.Text
                  style={[typography.styles.caption, styles.subtitle, { color: colors.muted }]}
                  numberOfLines={4}
                >
                  {tab.subtitle?.trim()}
                </Animated.Text>
              </View>
              <Image source={tab.image} style={styles.introImage} fadeDuration={0} />
            </Animated.View>
          );
        })}
      </View>

      {/* Underline tabs sit on the hero's bottom edge as its "hinge" to the
          content: bare labels + a sliding orange bar, no extra container. */}
      <SegmentedControl
        variant="underline"
        segments={tabs}
        progress={progress}
        onChange={onTabPress}
        thumbColor={colors.buttonColor}
        inactiveTextColor={colors.muted}
        activeTextColor={colors.text}
        height={verticalScale(44)}
        style={styles.segmented}
      />
    </View>
  );
}

const IMAGE_SIZE = moderateScale(124, 0.3);

const styles = StyleSheet.create({
  surface: {
    width: '100%',
    // Same radius as the Home / Discover heroes. zIndex keeps the hero above
    // the pager, which is pulled up underneath it (see LibraryScreen
    // HERO_OVERLAP) so content scrolls behind the rounded corners.
    zIndex: 10,
    borderBottomLeftRadius: moderateScale(36),
    borderBottomRightRadius: moderateScale(36),
    borderWidth: 1,
    borderTopWidth: 0,
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(4),
  },
  introArea: {
    height: IMAGE_SIZE,
  },
  intro: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
  },
  introText: {
    flex: 1,
    marginRight: scale(12),
  },
  title: {
    marginBottom: verticalScale(6),
  },
  subtitle: {
    lineHeight: moderateScale(20),
  },
  introImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    resizeMode: 'contain',
  },
  segmented: {
    marginTop: verticalScale(8),
  },
});

export default memo(LibraryHeader);
