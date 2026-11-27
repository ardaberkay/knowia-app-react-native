import React, { memo, useRef } from 'react';
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
 *
 * It floats over the pages (absolute) and collapses like Discover's header:
 * `collapsed` (native Animated value, 0 .. collapseDistance) is how far the
 * lists have scrolled the header away. The title and intro slide up and fade
 * out, the glow fades, and a solid background fades in behind the tabs, which
 * stay pinned under the status bar. `onHeightChange(height)` reports the
 * header's full height (the lists' top padding).
 */
function LibraryHeader({ progress, onTabPress, summary, collapsed, collapseDistance, onHeightChange }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const notCollapsed = useRef(new Animated.Value(0)).current;
  if (!collapsed) collapsed = notCollapsed; // eslint-disable-line no-param-reassign
  const distance = Math.max(1, collapseDistance || 1);
  const translateY = collapsed.interpolate({ inputRange: [0, distance], outputRange: [0, -distance], extrapolate: 'clamp' });
  const contentOpacity = collapsed.interpolate({ inputRange: [0, distance * 0.7], outputRange: [1, 0], extrapolate: 'clamp' });
  const glowOpacity = collapsed.interpolate({ inputRange: [0, distance], outputRange: [1, 0], extrapolate: 'clamp' });
  const solidOpacity = collapsed.interpolate({ inputRange: [0, distance], outputRange: [0, 1], extrapolate: 'clamp' });

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
      image: require('../../assets/images/mydecks_item.webp'),
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
      image: require('../../assets/images/shared.webp'),
      // This drawing sits right of centre with empty space top-left (its box
      // spans ~x 265-925, y 35-950 of 1024), so at the same size it read as
      // smaller and lower than Destelerim's full-bleed one. Scale it to fill
      // the frame and pull it back to centre.
      imageStyle: { transform: [{ scale: 1.12 }, { translateX: -10 }] },
    },
  ];

  return (
    <Animated.View
      pointerEvents="box-none"
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[styles.surface, { paddingTop: insets.top, transform: [{ translateY }] }]}
    >
      {/* Solid background, visible once a list scrolls under the tabs. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: solidOpacity }]}
      />
      {/* Soft light from the top centre, fading out by the tabs; one layer per
          tab, cross-faded on the pager position (native driver). */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]}>
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
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ opacity: contentOpacity }}>
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
      </Animated.View>

      {/* Underline tabs sit on the hero's bottom edge as its "hinge" to the
          content: bare labels + a sliding orange bar, no extra container.
          They stay pinned when the rest scrolls away. */}
      <SegmentedControl
        variant="underline"
        segments={tabs}
        progress={progress}
        onChange={onTabPress}
        thumbColor={colors.buttonColor}
        inactiveTextColor={colors.muted}
        activeTextColor={colors.text}
        height={TABS_HEIGHT}
        style={styles.segmented}
      />
    </Animated.View>
  );
}

const IMAGE_SIZE = 124;
const TABS_HEIGHT = 44;
const TABS_MARGIN_TOP = 8;
const SURFACE_PADDING_BOTTOM = 4;
// What stays on screen when collapsed (under the status bar): the tabs.
export const LIBRARY_TABS_BLOCK_HEIGHT = TABS_MARGIN_TOP + TABS_HEIGHT + SURFACE_PADDING_BOTTOM;
// First-render guess of the full height (corrected by onHeightChange), so
// the lists don't jump when the header is measured.
export const LIBRARY_HEADER_ESTIMATED_HEIGHT = SCREEN_TITLE_HEIGHT + IMAGE_SIZE + LIBRARY_TABS_BLOCK_HEIGHT;
const SUBTITLE_LINES = 2;
// Same as Discover's glow.
const GLOW_STRENGTH = 0.18;

const styles = StyleSheet.create({
  // Floats over the pages (LibraryScreen pads its lists by its height).
  surface: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.lg,
    paddingBottom: SURFACE_PADDING_BOTTOM,
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
    marginTop: TABS_MARGIN_TOP,
  },
});

export default memo(LibraryHeader);
