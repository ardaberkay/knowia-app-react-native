import React, { memo } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Text, MAX_FONT_SIZE_MULTIPLIER } from '../ui/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import SegmentedControl from '../ui/SegmentedControl';
import { useTheme } from '../../theme/theme';
import { typography, fonts, lineHeights } from '../../theme/typography';
import { SCREEN_TITLE_HEIGHT, spacing } from '../../theme/layout';

/**
 * Library header: part of the page (no card surface), lit by a soft top glow
 * that takes the selected tab's colour (orange / pink, same strength as
 * Discover). Holds the page title ("Kitaplığım", same place and style as
 * Discover's), a per-tab intro (one short line, a summary line with real
 * counts, illustration) and the tabs under it. The tabs name the sections,
 * so the intro has no title of its own.
 *
 * `progress` = PagerView position + offset (native Animated value). The intro
 * cross-fades between tabs on that value, so swiping the pager animates the
 * header without any React re-render.
 */
function LibraryHeader({ progress, onTabPress, summary }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const tabs = [
    {
      key: 'myDecks',
      label: t('library.myDecks', 'Destelerim'),
      icon: 'ph:cards-fill',
      subtitle: t('library.myDecksHeroText', 'Kendi destelerinle öğrenmeye başla.'),
      summary: summary
        ? `${t('library.summaryDecks', { count: summary.myDecks })} · ${t('library.summaryCards', { count: summary.myCards })}`
        : null,
      glow: colors.buttonColor,
      image: require('../../assets/mydecks_item.webp'),
    },
    {
      key: 'favorites',
      label: t('library.favorites', 'Favorilerim'),
      icon: 'solar:heart-bold',
      subtitle: t('library.favoritesHeroText', 'Beğendiğin desteler ve kartlar.'),
      summary: summary
        ? `${t('library.summaryDecks', { count: summary.favoriteDecks })} · ${t('library.summaryCards', { count: summary.favoriteCards })}`
        : null,
      glow: '#F5576C',
      image: require('../../assets/shared.webp'),
      // This drawing sits right of centre with empty space top-left (its box
      // spans ~x 265-925, y 35-950 of 1024), so at the same size it read as
      // smaller and lower than Destelerim's full-bleed one. Scale it to fill
      // the frame and pull it back to centre.
      imageStyle: { transform: [{ scale: 1.12 }, { translateX: -10 }] },
    },
  ];

  return (
    <View style={[styles.surface, { paddingTop: insets.top }]}>
      {/* Soft light from the top centre, fading out by the tabs; one layer per
          tab, cross-faded on the pager position (native driver). */}
      {tabs.map((tab, index) => (
        <Animated.View
          key={`glow_${tab.key}`}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: progress.interpolate({
                inputRange: [index - 1, index, index + 1],
                outputRange: [0, 1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id={`libraryGlow_${tab.key}`} cx="50%" cy="0%" rx="70%" ry="100%" fx="50%" fy="0%">
                <Stop offset="0" stopColor={tab.glow} stopOpacity={GLOW_STRENGTH} />
                <Stop offset="0.5" stopColor={tab.glow} stopOpacity={GLOW_STRENGTH * 0.4} />
                <Stop offset="1" stopColor={tab.glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#libraryGlow_${tab.key})`} />
          </Svg>
        </Animated.View>
      ))}
      <View style={styles.titleRow}>
        <Text style={[typography.styles.screenTitle, { color: colors.text }]} numberOfLines={1}>
          {t('tabs.library', 'Kitaplığım')}
        </Text>
      </View>
      <View style={styles.introArea}>
        {tabs.map((tab, index) => {
          const opacity = progress.interpolate({
            inputRange: [index - 1, index - 0.5, index, index + 0.5, index + 1],
            outputRange: [0, 0, 1, 0, 0],
            extrapolate: 'clamp',
          });
          const translateY = progress.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [6, 0, 6],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={tab.key}
              pointerEvents="none"
              style={[styles.intro, { opacity, transform: [{ translateY }] }]}
            >
              <View style={styles.introText}>
                <Animated.Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                  style={[typography.styles.body, styles.subtitle, { color: colors.muted }]}
                  numberOfLines={SUBTITLE_LINES}
                >
                  {tab.subtitle?.trim()}
                </Animated.Text>
                {tab.summary ? (
                  <Animated.Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                    style={[typography.styles.subhead, styles.summary, { color: colors.buttonColor }]}
                    numberOfLines={1}
                  >
                    {tab.summary}
                  </Animated.Text>
                ) : null}
              </View>
              <Image source={tab.image} style={[styles.introImage, tab.imageStyle]} fadeDuration={0} />
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
        height={44}
        style={styles.segmented}
      />
    </View>
  );
}

const IMAGE_SIZE = 124;
const SUBTITLE_LINES = 2;
// Same as Discover's glow.
const GLOW_STRENGTH = 0.18;

const styles = StyleSheet.create({
  surface: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingBottom: 4,
  },
  // Same row as Discover's title: right under the safe area, same height.
  titleRow: {
    height: SCREEN_TITLE_HEIGHT,
    justifyContent: 'center',
  },
  // Both tab intros share one spot (each is full width with a -100% right
  // margin, so they overlap) but stay in the layout: the area takes the
  // tallest intro's height, so longer text (or a larger OS font) pushes the
  // tabs down instead of running into them.
  introArea: {
    flexDirection: 'row',
    minHeight: IMAGE_SIZE,
  },
  intro: {
    width: '100%',
    marginRight: '-100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Text + summary centred next to the illustration. The subtitle always takes
  // two lines of space, so the group has the same height on both tabs and the
  // text and summary sit in the same spots whatever the text length.
  introText: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  subtitle: {
    lineHeight: lineHeights.body,
    minHeight: lineHeights.body * SUBTITLE_LINES,
  },
  summary: {
    marginTop: spacing.sm,
    fontFamily: fonts.semibold,
  },
  introImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    resizeMode: 'contain',
  },
  segmented: {
    marginTop: 8,
  },
});

export default memo(LibraryHeader);
