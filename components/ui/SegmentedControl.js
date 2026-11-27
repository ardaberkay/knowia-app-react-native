import React, { memo, useCallback, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import { typography, fontSizes } from '../../theme/typography';
import { triggerHaptic } from '../../lib/hapticManager';
import PhosphorIcon from './PhosphorIcon';
import { ICONS } from '../../theme/icons';

/**
 * Segmented tabs driven by a native Animated value.
 *
 * `progress` is an Animated value/node in the range [0, segments.length - 1]
 * (e.g. PagerView position + offset wired with useNativeDriver: true). The
 * thumb/indicator position and label colours are pure interpolations of it, so
 * dragging the pager or tapping a segment never re-renders mid-animation.
 *
 * Variants:
 *  - 'pill'      : bordered track with a sliding filled thumb.
 *  - 'underline' : bare labels with a short sliding bar under the active one.
 *
 * Label colour cannot be animated on the native driver, so each label is drawn
 * twice (inactive + active) and the active layer's opacity is interpolated.
 */
// Optional leading icon (segment.icon, an ICONS entry from theme/icons.js)
// + label, drawn in one colour.
function SegmentContent({ segment, color }) {
  return (
    <View style={styles.segmentContent}>
      {segment.icon ? (
        <PhosphorIcon icon={segment.icon} size={16} color={color} />
      ) : null}
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {segment.label}
      </Text>
    </View>
  );
}

function SegmentedControl({
  segments,
  progress,
  onChange,
  variant = 'pill',
  trackColor = 'rgba(255, 255, 255, 0.22)',
  thumbColor = '#FFFFFF',
  inactiveTextColor = '#FFFFFF',
  activeTextColor = '#F98A21',
  borderColor = null,
  height = DEFAULT_HEIGHT,
  style,
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const count = segments.length;
  const isUnderline = variant === 'underline';
  const padding = isUnderline ? 0 : TRACK_PADDING;
  const borderWidth = !isUnderline && borderColor ? TRACK_BORDER : 0;
  // onLayout width includes padding + border; segments live inside them.
  const segmentWidth = trackWidth > 0
    ? (trackWidth - padding * 2 - borderWidth * 2) / count
    : 0;
  const thumbWidth = isUnderline ? segmentWidth * INDICATOR_RATIO : segmentWidth;
  const thumbInset = (segmentWidth - thumbWidth) / 2;

  const onLayout = useCallback((e) => {
    const w = e.nativeEvent.layout.width;
    setTrackWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
  }, []);

  const inputRange = segments.map((_, i) => i);

  const thumbStyle = {
    width: thumbWidth,
    opacity: segmentWidth > 0 ? 1 : 0,
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: count > 1 ? inputRange : [0, 1],
          outputRange: count > 1 ? inputRange.map((i) => i * segmentWidth + thumbInset) : [thumbInset, thumbInset],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  const trackStyle = isUnderline
    ? { height }
    : [
      styles.pillTrack,
      { backgroundColor: trackColor, height, borderRadius: height / 2 },
      borderColor ? { borderWidth, borderColor } : null,
    ];

  const thumbBaseStyle = isUnderline
    ? [styles.indicator, { backgroundColor: thumbColor }]
    : [styles.pillThumb, { backgroundColor: thumbColor, borderRadius: height / 2 }];

  return (
    <View
      style={[styles.row, trackStyle, style]}
      onLayout={onLayout}
      accessibilityRole="tablist"
    >
      <Animated.View pointerEvents="none" style={[thumbBaseStyle, thumbStyle]} />

      {segments.map((segment, index) => {
        const activeOpacity = count > 1
          ? progress.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          })
          : 1;

        return (
          <Pressable
            key={segment.key}
            style={styles.segment}
            onPress={() => {
              triggerHaptic('selection');
              onChange?.(index);
            }}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            hitSlop={{ top: 6, bottom: 6 }}
          >
            <SegmentContent segment={segment} color={inactiveTextColor} />
            <Animated.View
              pointerEvents="none"
              style={[styles.labelOverlay, { opacity: activeOpacity }]}
            >
              <SegmentContent segment={segment} color={activeTextColor} />
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

const TRACK_PADDING = 4;
const TRACK_BORDER = 1;
const DEFAULT_HEIGHT = 44;
// Underline indicator width as a share of one segment.
const INDICATOR_RATIO = 0.5;
const INDICATOR_HEIGHT = 3;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  pillTrack: {
    padding: TRACK_PADDING,
  },
  pillThumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    ...typography.styles.headline,
    fontSize: fontSizes.body,
    flexShrink: 1,
  },
  labelOverlay: {
    position: 'absolute',
  },
});

export default memo(SegmentedControl);
