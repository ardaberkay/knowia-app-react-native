import React, { memo, useMemo } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Tallest pull we paint for; iOS rubber-banding rarely goes past this.
const BACKDROP_HEIGHT = 600;

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Exact colours of a linear gradient's top row (y = 0) for a view of size
 * w × h, returned as horizontal stops.
 *
 * `colors` are 6-digit hex, evenly spaced (no `locations`), and `start`/`end`
 * are in unit coordinates like expo-linear-gradient. Gradients are drawn in
 * pixel space, so the projection depends on the aspect ratio. t(x) along the
 * top row is linear in x and the colour is piecewise linear in t, so stops at
 * x = 0, x = 1 and every x where t crosses a colour stop reproduce it exactly.
 */
export function gradientTopEdgeStops(colors, start, end, w, h) {
  const rgb = colors.map(hexToRgb);
  const last = rgb.length - 1;
  const colorAt = (t) => {
    const pos = Math.min(Math.max(t, 0), 1) * last;
    const i = Math.min(Math.floor(pos), last - 1);
    const f = pos - i;
    const [r, g, b] = rgb[i].map((c, k) => Math.round(c + (rgb[i + 1][k] - c) * f));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const sx = start.x * w;
  const sy = start.y * h;
  const dx = end.x * w - sx;
  const dy = end.y * h - sy;
  const len2 = dx * dx + dy * dy || 1;
  const tAt = (x) => ((x * w - sx) * dx + (0 - sy) * dy) / len2;
  const a = tAt(0);
  const b = tAt(1) - a;

  const xs = [0, 1];
  if (b !== 0) {
    for (let i = 0; i <= last; i += 1) {
      const x = (i / last - a) / b;
      if (x > 0 && x < 1) xs.push(x);
    }
  }
  xs.sort((p, q) => p - q);
  return { colors: xs.map((x) => colorAt(a + b * x)), locations: xs };
}

/**
 * Pull-to-refresh backdrop for screens whose scroll content starts with a
 * gradient hero at the very top.
 *
 * Render it before (behind) a transparent ScrollView. It waits above the screen
 * and slides down exactly as far as the user over-scrolls (driven natively by
 * `scrollY`), painting a vertical continuation of the hero's top row. Pulling
 * then looks like the hero stretching, never like a gap. Because it sits behind
 * the ScrollView, the refresh spinner stays visible on top of it, and it never
 * shows through the content during normal scrolling.
 *
 * Props:
 *  - scrollY  : Animated.Value bound to the ScrollView's contentOffset.y
 *  - heroSize : { w, h } measured with onLayout on the hero gradient (null = skip)
 *  - colors / start / end : the hero gradient's own props
 */
function HeroPullBackdrop({ scrollY, heroSize, colors, start, end }) {
  const stops = useMemo(
    () => (heroSize ? gradientTopEdgeStops(colors, start, end, heroSize.w, heroSize.h) : null),
    // colors is usually a fresh array literal; compare by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroSize, colors.join(','), start.x, start.y, end.x, end.y]
  );

  const translateY = useMemo(
    () => scrollY.interpolate({
      inputRange: [-BACKDROP_HEIGHT, 0],
      outputRange: [0, -BACKDROP_HEIGHT],
      extrapolate: 'clamp',
    }),
    [scrollY]
  );

  if (!stops) return null;

  // The native-driven transform lives on a plain Animated.View: expo's
  // LinearGradient can't host a native-driver animation itself.
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.backdrop, { transform: [{ translateY }] }]}
    >
      <LinearGradient
        colors={stops.colors}
        locations={stops.locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BACKDROP_HEIGHT,
  },
});

export default memo(HeroPullBackdrop);
