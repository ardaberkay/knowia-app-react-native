import React, { memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Reanimated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { triggerHaptic } from '../../lib/hapticManager';

/**
 * Carousel of stacked items, one item per swipe, a light haptic tick when the
 * front item changes, and an indicator under it (a line for the front item,
 * dots for its neighbours). Two looks:
 *
 *   variant="stack" — the front item sits in the middle; its neighbours are
 *     smaller, dimmed and tucked behind it on both sides.
 *   variant="deck" — the next items are stacked behind the front one,
 *     peeking out on the right. Swiping left pulls the front item off the
 *     deck (it follows the finger, then flies off the left edge and fades);
 *     swiping back lays it on the deck again.
 *
 * How it moves: the items are NOT inside the scroll view. A transparent
 * scroll view on top only tracks the finger (native momentum and snapping);
 * every item's position is computed from that scroll offset alone. With the
 * items inside the scroll content, the native scroll moved them a frame
 * before their stacking transforms caught up, so they jittered.
 *
 * Taps also land on the scroll view and are mapped by position: on the front
 * item → onFrontPress(item, index); on a side item → it comes to the front.
 *
 * renderItem({ item, index, width, height, progress }): progress is a shared
 * value, the scroll position in items (2.5 = halfway between items 2 and 3).
 * Items get no touches of their own.
 *
 * onFrontChange(index) fires once the scroll has settled on a new item, not
 * mid-swipe, so a parent that re-renders a lot on it can't stall a swipe.
 * onEndReached() fires when the front item gets within END_REACHED_THRESHOLD
 * of the last one (once per list length), to load more.
 *
 * ref: { scrollToIndex(index, animated = true) }.
 *
 * Performance: per-frame styles are transform / opacity only (plus, in the
 * stack look, a zIndex that changes only when the front item changes), and
 * only items within WINDOW of the front are rendered.
 */

const STEP_RATIO = 0.62; // scroll distance per item, of the item width

// variant="stack"
const STACK_SIDE_OFFSET = 0.42; // neighbour's centre from the front's, of the width
const STACK_FAR_OFFSET = 0.46; // second neighbour: hidden behind the first
const STACK_SIDE_SCALE = 0.84;
const STACK_FAR_SCALE = 0.7;
const STACK_SIDE_DIM = 0.35;

// variant="deck": cards behind the front one, by depth (0 = front).
const DECK_BEHIND_OFFSETS = [0, 0.2, 0.36]; // centre shift to the right, of the width
const DECK_BEHIND_SCALES = [1, 0.88, 0.78];
const DECK_BEHIND_DIMS = [0, 0.3, 0.5];
// A passed card follows the finger for half a step, then flies off the left
// edge (in steps; fully off-screen at one step for both card sizes in use).
const DECK_PASSED_OFFSET_HALF = -0.5;
const DECK_PASSED_OFFSET_FULL = -2.8;
const DECK_PASSED_SCALE = 0.95;

const WINDOW = 4; // items rendered on each side of the front one
const END_REACHED_THRESHOLD = 3; // items left before onEndReached
const SETTLE_AFTER_TAP_MS = 400; // a tap-to-front scroll animation's length
// React work (window move, onFrontChange) waits this long after the scroll
// stops, and is dropped if a new drag starts, so it never lands mid-swipe and
// a quick run of swipes only does it once, at the end.
const SETTLE_DELAY_MS = 250;

// Indicator.
const DOT_SIZE = 6;
const LINE_WIDTH = 20;
const DOT_SPACING = 18; // between the centres of neighbouring marks
const DOTS_WIDTH = LINE_WIDTH + 4 * DOT_SPACING;

const StackItem = memo(({
  item, index, variant, left, progress, step, width, height, radius, renderItem,
}) => {
  // rel: position relative to the front, in items (0 = front, 1 = next,
  // -1 = previous).
  const stackStyle = useAnimatedStyle(() => {
    const rel = index - progress.value;
    if (variant === 'deck') {
      let offset;
      let scale;
      let opacity;
      if (rel >= 0) {
        offset = width * interpolate(rel, [0, 1, 2], DECK_BEHIND_OFFSETS, Extrapolation.CLAMP);
        scale = interpolate(rel, [0, 1, 2], DECK_BEHIND_SCALES, Extrapolation.CLAMP);
        opacity = interpolate(rel, [2, 2.6], [1, 0], Extrapolation.CLAMP);
      } else {
        offset = step * interpolate(rel, [-1, -0.5, 0], [DECK_PASSED_OFFSET_FULL, DECK_PASSED_OFFSET_HALF, 0], Extrapolation.CLAMP);
        scale = interpolate(rel, [-1, 0], [DECK_PASSED_SCALE, 1], Extrapolation.CLAMP);
        opacity = interpolate(rel, [-1, -0.5, 0], [0, 0.9, 1], Extrapolation.CLAMP);
      }
      return { opacity, transform: [{ translateX: offset }, { scale }] };
    }
    const d = Math.abs(rel);
    return {
      // Whole steps only: changes when the front item changes.
      zIndex: 100 - Math.round(d) * 10,
      opacity: interpolate(d, [1, 1.7], [1, 0], Extrapolation.CLAMP),
      transform: [
        {
          translateX: width * interpolate(
            rel,
            [-2, -1, 0, 1, 2],
            [-STACK_FAR_OFFSET, -STACK_SIDE_OFFSET, 0, STACK_SIDE_OFFSET, STACK_FAR_OFFSET],
            Extrapolation.CLAMP
          ),
        },
        { scale: interpolate(d, [0, 1, 2], [1, STACK_SIDE_SCALE, STACK_FAR_SCALE], Extrapolation.CLAMP) },
      ],
    };
  });
  const dimStyle = useAnimatedStyle(() => {
    const rel = index - progress.value;
    if (variant === 'deck') {
      return { opacity: interpolate(rel, [0, 1, 2], DECK_BEHIND_DIMS, Extrapolation.CLAMP) };
    }
    return { opacity: interpolate(Math.abs(rel), [0, 1], [0, STACK_SIDE_DIM], Extrapolation.CLAMP) };
  });

  return (
    <Reanimated.View pointerEvents="none" style={[styles.item, { left, width, height }, stackStyle]}>
      {renderItem({ item, index, width, height, progress })}
      <Reanimated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000', borderRadius: radius }, dimStyle]}
      />
    </Reanimated.View>
  );
});

// One indicator mark, placed by its distance from the front item. A dot and
// a line cross-fade (the line stretches out of the dot with scaleX), so
// nothing but transform and opacity changes per frame.
const StackDot = memo(({ index, progress, activeColor, inactiveColor }) => {
  const lineStyle = useAnimatedStyle(() => {
    const rel = Math.max(-2, Math.min(2, index - progress.value));
    const d = Math.abs(rel);
    const centre = DOTS_WIDTH / 2 + rel * DOT_SPACING;
    return {
      opacity: interpolate(d, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: centre - LINE_WIDTH / 2 },
        { scaleX: interpolate(d, [0, 1], [1, DOT_SIZE / LINE_WIDTH], Extrapolation.CLAMP) },
      ],
    };
  });
  const dotStyle = useAnimatedStyle(() => {
    const rel = Math.max(-2, Math.min(2, index - progress.value));
    const d = Math.abs(rel);
    return {
      opacity: interpolate(d, [0, 1, 1.6], [0, 0.45, 0], Extrapolation.CLAMP),
      transform: [{ translateX: DOTS_WIDTH / 2 + rel * DOT_SPACING - DOT_SIZE / 2 }],
    };
  });
  return (
    <>
      <Reanimated.View style={[styles.mark, styles.dot, { backgroundColor: inactiveColor }, dotStyle]} />
      <Reanimated.View style={[styles.mark, styles.line, { backgroundColor: activeColor }, lineStyle]} />
    </>
  );
});

// Not wrapped in memo: `ref` is a plain prop here (React 19).
export default function StackCarousel({
  ref,
  items,
  keyExtractor,
  renderItem,
  variant = 'stack', // 'stack' | 'deck'
  widthRatio, // item width, as a share of the carousel's width
  maxWidth,
  aspectRatio, // height / width
  radius = 18, // item corner radius (for the dim layer)
  initialIndex = 0,
  onFrontPress, // (item, index) => void, a tap on the front item
  onFrontChange, // (index) => void, once the scroll settles on another item
  onEndReached, // () => void, near the end of the list
  activeColor,
  inactiveColor,
  paddingTop = 0,
  dotsGap = 14, // between the items and the indicator
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef(null);
  const scrollX = useSharedValue(0);
  const itemCount = items.length;
  // Only the first value counts. A changing contentOffset prop makes the
  // native scroll view jump there, even mid-swipe; later moves go through
  // ref.scrollToIndex.
  const startIndex = useRef(initialIndex).current;

  const width = Math.min(maxWidth, containerWidth * widthRatio);
  const height = width * aspectRatio;
  const step = width * STEP_RATIO;

  const progress = useDerivedValue(() => (step > 0 ? scrollX.value / step : 0), [step]);

  const handleLayout = useCallback((e) => {
    const nextWidth = e.nativeEvent.layout.width;
    if (nextWidth === containerWidth) return;
    // Start at initialIndex right away, so the first frame (and the front
    // tracking below) already sees it.
    const nextStep = Math.min(maxWidth, nextWidth * widthRatio) * STEP_RATIO;
    scrollX.value = startIndex * nextStep;
    setContainerWidth(nextWidth);
  }, [containerWidth, maxWidth, scrollX, startIndex, widthRatio]);

  // Which items are rendered: WINDOW on each side of the front one. Moved
  // when the scroll settles, not mid-swipe; only a run of quick swipes that
  // gets close to the window's edge moves it right away.
  const [windowCentre, setWindowCentre] = useState(startIndex);
  const windowCentreRef = useRef(startIndex);
  const moveWindow = useCallback((index) => {
    if (index === windowCentreRef.current) return;
    windowCentreRef.current = index;
    setWindowCentre(index);
  }, []);

  // Near the end (also right away when opened near it): ask for more, once
  // per list length.
  const onEndReachedRef = useRef(onEndReached);
  onEndReachedRef.current = onEndReached;
  const endReachedForRef = useRef(-1);
  useEffect(() => {
    if (windowCentre >= itemCount - 1 - END_REACHED_THRESHOLD && endReachedForRef.current !== itemCount) {
      endReachedForRef.current = itemCount;
      onEndReachedRef.current?.();
    }
  }, [itemCount, windowCentre]);

  // The moment another item crosses into the front: haptic tick only.
  const frontRef = useRef(startIndex);
  const handleFrontCross = useCallback((index) => {
    if (index === frontRef.current) return;
    frontRef.current = index;
    triggerHaptic('selection');
    if (Math.abs(index - windowCentreRef.current) >= WINDOW - 2) moveWindow(index);
  }, [moveWindow]);
  useAnimatedReaction(
    () => Math.round(progress.value),
    (index, previous) => {
      if (previous !== null && index !== previous) runOnJS(handleFrontCross)(index);
    },
    [handleFrontCross]
  );

  // Settled: move the render window and report onFrontChange (once per
  // change), SETTLE_DELAY_MS after the scroll stops, unless a new drag
  // starts first.
  const settledRef = useRef(startIndex);
  const onFrontChangeRef = useRef(onFrontChange);
  onFrontChangeRef.current = onFrontChange;
  const settleTimerRef = useRef(null);
  const cancelSettle = useCallback(() => {
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
  }, []);
  const emitSettled = useCallback((index, delay = SETTLE_DELAY_MS) => {
    const clamped = Math.max(0, Math.min(itemCount - 1, index));
    cancelSettle();
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      moveWindow(clamped);
      if (clamped === settledRef.current) return;
      settledRef.current = clamped;
      onFrontChangeRef.current?.(clamped);
    }, delay);
  }, [cancelSettle, itemCount, moveWindow]);
  useEffect(() => cancelSettle, [cancelSettle]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
    onBeginDrag: () => {
      runOnJS(cancelSettle)();
    },
    // A release right on a snap point has no momentum phase; settle here.
    onEndDrag: (e) => {
      if (step <= 0) return;
      const index = Math.round(e.contentOffset.x / step);
      if (Math.abs(e.contentOffset.x - index * step) < 1) runOnJS(emitSettled)(index);
    },
    onMomentumEnd: (e) => {
      if (step > 0) runOnJS(emitSettled)(Math.round(e.contentOffset.x / step));
    },
  }, [step, emitSettled, cancelSettle]);

  const scrollToIndex = useCallback((index, animated = true) => {
    if (step <= 0) return;
    // Render the target's neighbourhood first (it may be far away).
    moveWindow(index);
    frontRef.current = index;
    scrollRef.current?.scrollTo({ x: index * step, animated });
    if (!animated) scrollX.value = index * step;
  }, [moveWindow, scrollX, step]);
  useImperativeHandle(ref, () => ({ scrollToIndex }), [scrollToIndex]);

  // Taps land on the scroll view; map the point to the item under it.
  const onFrontPressRef = useRef(onFrontPress);
  onFrontPressRef.current = onFrontPress;
  const handleTap = useCallback((e) => {
    if (step <= 0 || itemCount === 0) return;
    const front = Math.max(0, Math.min(itemCount - 1, Math.round(progress.value)));
    const x = e.nativeEvent.locationX - scrollX.value - containerWidth / 2; // from the centre
    let target = front;
    if (x > width / 2) target = front + 1;
    else if (x < -width / 2) target = variant === 'stack' ? front - 1 : -1;
    if (target < 0 || target >= itemCount) return;
    if (target === front) {
      onFrontPressRef.current?.(items[front], front);
      return;
    }
    triggerHaptic('selection');
    scrollToIndex(target);
    // A programmatic scroll may not report momentum end on every platform;
    // settle once the scroll animation is over (deduplicated).
    emitSettled(target, SETTLE_AFTER_TAP_MS);
  }, [containerWidth, emitSettled, itemCount, items, progress, scrollToIndex, scrollX, step, variant, width]);

  // Window items, last one first: later siblings draw on top, so in the deck
  // look earlier items lie on the deck above later ones.
  const renderedIndexes = [];
  for (let i = Math.min(itemCount - 1, windowCentre + WINDOW); i >= Math.max(0, windowCentre - WINDOW); i--) {
    renderedIndexes.push(i);
  }

  return (
    <View onLayout={handleLayout} style={{ paddingTop }}>
      {containerWidth > 0 ? (
        <>
          <View style={{ height }}>
            {renderedIndexes.map((index) => (
              <StackItem
                key={keyExtractor(items[index], index)}
                item={items[index]}
                index={index}
                variant={variant}
                left={(containerWidth - width) / 2}
                progress={progress}
                step={step}
                width={width}
                height={height}
                radius={radius}
                renderItem={renderItem}
              />
            ))}
            {/* Finger tracking only: transparent, on top of the items. */}
            <Reanimated.ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={step}
              decelerationRate="fast"
              disableIntervalMomentum
              contentOffset={{ x: startIndex * step, y: 0 }}
              onScroll={onScroll}
              scrollEventThrottle={16}
              style={styles.gestureLayer}
              contentContainerStyle={{ width: containerWidth - step + itemCount * step, height }}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />
            </Reanimated.ScrollView>
          </View>
          {itemCount > 1 ? (
            <View style={[styles.dots, { marginTop: dotsGap }]}>
              {renderedIndexes.map((index) => (
                <StackDot
                  key={keyExtractor(items[index], index)}
                  index={index}
                  progress={progress}
                  activeColor={activeColor}
                  inactiveColor={inactiveColor}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    position: 'absolute',
    top: 0,
  },
  gestureLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
  // Fixed width, centred; marks are positioned inside it by StackDot.
  dots: {
    width: DOTS_WIDTH,
    height: DOT_SIZE,
    alignSelf: 'center',
  },
  mark: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  dot: {
    width: DOT_SIZE,
  },
  line: {
    width: LINE_WIDTH,
  },
});
