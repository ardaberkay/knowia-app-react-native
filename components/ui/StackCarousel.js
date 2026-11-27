import React, {
  memo, startTransition, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
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
 * How it moves: a pan gesture (UI thread) drives one offset, and every
 * item's position is computed from it. One gesture moves at most one item:
 * past the neighbour of the item it started from, the drag rubber-bands. On
 * release the offset springs to the target item with the finger's velocity
 * (a flick is enough), and a new drag catches it mid-spring. A pan only
 * starts on a horizontal move, so a vertical list around it still scrolls.
 * (A scroll view used to track the finger: it let a fast drag pass several
 * items and settled with scroll deceleration instead of a spring.)
 *
 * Taps are mapped by position: on the front item → onFrontPress(item,
 * index, point) (point = { x, y, width, height }, in the item, for items
 * with their own hot spots); on a side item → it comes to the front.
 *
 * Sized from the window width on the first render (the carousel is full
 * width wherever it is used), then corrected by onLayout, so the page doesn't
 * jump when it mounts.
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
 * only items within the render window (WINDOWS) are rendered; those out of
 * sight skip their native updates.
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

// Items rendered around the front one (behind = lower indexes). The window
// follows the front item one step per item, as a low-priority (transition)
// update, so each step mounts one item at its far edge, out of sight. (Moving
// it in big jumps mounted several items at once and stalled the swipe.)
// Visible: the deck look shows front-1 .. front+2, the stack look front±1
// (±2 faintly mid-swipe), so the window keeps a spare item or two on each
// side for a late update.
//
// Items and marks out of sight return just { opacity: 0 } from their styles:
// the same shape every frame lets Reanimated skip the native update (its diff
// is shallow, so a new transform array would count as a change every frame).
const WINDOWS = {
  deck: { behind: 2, ahead: 4 },
  stack: { behind: 3, ahead: 3 },
};
const END_REACHED_THRESHOLD = 3; // items left before onEndReached
// React work (window move, onFrontChange) waits this long after the spring
// stops, and is dropped if a new drag starts, so it never lands mid-swipe and
// a quick run of swipes only does it once, at the end.
const SETTLE_DELAY_MS = 250;

// Gesture.
const PAN_ACTIVATION_PX = 10; // horizontal move before the carousel takes the touch
const PAN_FAIL_Y_PX = 12; // vertical move that leaves it to the list around it
const RUBBER_BAND = 0.22; // drag past the allowed range moves this much
// Where a release is heading: its offset plus velocity × this (seconds), so
// a short fast flick still reaches the next item.
const FLICK_PROJECTION_S = 0.12;
// px/s handed to the spring: a hard fling settles like a normal swipe.
const MAX_RELEASE_VELOCITY = 1200;
// Critically damped (damping ≈ 2·√(stiffness·mass)): settles without wobble.
const SETTLE_SPRING = { stiffness: 180, mass: 0.6, damping: 21 };
// After a swipe moves to another item, a new swipe within this time can't
// move again (the drag still follows the finger, then springs back), so a
// quick run of flings moves at most ~3-4 items a second.
const SWIPE_COOLDOWN_MS = 280;
const TAP_MAX_DISTANCE_PX = 10;

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
      if (rel <= -1 || rel >= 2.6) return { opacity: 0 }; // out of sight
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
    if (d >= 1.7) return { opacity: 0 }; // out of sight
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
    if (d >= 1) return { opacity: 0 }; // out of sight
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
    if (d >= 1.6) return { opacity: 0 }; // out of sight
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
  onFrontPress, // (item, index, { x, y, width, height }) => void, a tap on the front item
  onFrontChange, // (index) => void, once the scroll settles on another item
  onEndReached, // () => void, near the end of the list
  activeColor,
  inactiveColor,
  paddingTop = 0,
  dotsGap = 14, // between the items and the indicator
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const containerWidth = measuredWidth || windowWidth;
  const itemCount = items.length;
  // Only the first value counts; later moves go through ref.scrollToIndex.
  const startIndex = useRef(initialIndex).current;

  const width = Math.min(maxWidth, containerWidth * widthRatio);
  const height = width * aspectRatio;
  const step = width * STEP_RATIO;

  // The carousel position in px (step px per item), and the item it is at or
  // springing to (a drag may move one item from there). Starts at
  // initialIndex, so the first frame already shows it.
  const offset = useSharedValue(startIndex * step);
  const targetIndex = useSharedValue(startIndex);
  const dragStart = useSharedValue(0);
  const lastMoveAt = useSharedValue(0); // when a swipe last moved to another item
  const progress = useDerivedValue(() => (step > 0 ? offset.value / step : 0), [step]);

  const handleLayout = useCallback((e) => {
    const nextWidth = e.nativeEvent.layout.width;
    if (nextWidth > 0 && nextWidth !== containerWidth) setMeasuredWidth(nextWidth);
  }, [containerWidth]);

  // Which items are rendered: see WINDOWS. Follows the front item as a
  // transition (low priority) mid-swipe; a jump (tap, scrollToIndex) moves it
  // right away, before the scroll starts.
  const windowSpec = WINDOWS[variant] ?? WINDOWS.stack;
  const [windowCentre, setWindowCentre] = useState(startIndex);
  const windowCentreRef = useRef(startIndex);
  const moveWindow = useCallback((index, lowPriority = false) => {
    if (index === windowCentreRef.current) return;
    windowCentreRef.current = index;
    if (lowPriority) startTransition(() => setWindowCentre(index));
    else setWindowCentre(index);
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
  // A different size (the measured width differs from the window's) changes
  // the step: keep the same item in front.
  const stepRef = useRef(step);
  useEffect(() => {
    if (stepRef.current === step) return;
    stepRef.current = step;
    cancelAnimation(offset);
    targetIndex.value = frontRef.current;
    offset.value = frontRef.current * step;
  }, [offset, step, targetIndex]);
  const handleFrontCross = useCallback((index) => {
    if (index === frontRef.current) return;
    frontRef.current = index;
    triggerHaptic('selection');
    moveWindow(index, true);
  }, [moveWindow]);
  useAnimatedReaction(
    () => Math.round(progress.value),
    (index, previous) => {
      if (previous !== null && index !== previous) runOnJS(handleFrontCross)(index);
    },
    [handleFrontCross]
  );

  // Settled: move the render window and report onFrontChange (once per
  // change), SETTLE_DELAY_MS after the spring stops, unless a new drag
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

  // Springs to an item; settles (see emitSettled) once the spring is over.
  // Runs on either thread (gesture worklets and scrollToIndex).
  const springTo = useCallback((index, velocity = 0) => {
    'worklet';
    targetIndex.value = index;
    offset.value = withSpring(index * step, { ...SETTLE_SPRING, velocity }, (finished) => {
      'worklet';
      if (finished) runOnJS(emitSettled)(index);
    });
  }, [emitSettled, offset, step, targetIndex]);

  const panGesture = useMemo(() => Gesture.Pan()
    .enabled(itemCount > 1 && step > 0)
    .activeOffsetX([-PAN_ACTIVATION_PX, PAN_ACTIVATION_PX])
    .failOffsetY([-PAN_FAIL_Y_PX, PAN_FAIL_Y_PX])
    .onStart(() => {
      'worklet';
      // Catch the spring where it is.
      cancelAnimation(offset);
      dragStart.value = offset.value;
      runOnJS(cancelSettle)();
    })
    .onUpdate((e) => {
      'worklet';
      // One item from the target at most (and within the list); rubber band
      // past that.
      const min = Math.max(0, targetIndex.value - 1) * step;
      const max = Math.min(itemCount - 1, targetIndex.value + 1) * step;
      const raw = dragStart.value - e.translationX;
      if (raw > max) offset.value = max + (raw - max) * RUBBER_BAND;
      else if (raw < min) offset.value = min - (min - raw) * RUBBER_BAND;
      else offset.value = raw;
    })
    .onEnd((e) => {
      'worklet';
      const velocity = Math.max(-MAX_RELEASE_VELOCITY, Math.min(MAX_RELEASE_VELOCITY, -e.velocityX));
      const projected = Math.round((offset.value + velocity * FLICK_PROJECTION_S) / step);
      const from = targetIndex.value;
      let index = Math.max(0, Math.min(itemCount - 1, Math.max(from - 1, Math.min(from + 1, projected))));
      if (index !== from) {
        const now = Date.now();
        if (now - lastMoveAt.value < SWIPE_COOLDOWN_MS) index = from;
        else lastMoveAt.value = now;
      }
      springTo(index, velocity);
    }), [cancelSettle, dragStart, itemCount, lastMoveAt, offset, springTo, step, targetIndex]);

  const scrollToIndex = useCallback((index, animated = true) => {
    if (step <= 0) return;
    // Render the target's neighbourhood first (it may be far away).
    moveWindow(index);
    frontRef.current = index;
    if (animated) {
      springTo(index);
    } else {
      cancelAnimation(offset);
      targetIndex.value = index;
      offset.value = index * step;
    }
  }, [moveWindow, offset, springTo, step, targetIndex]);
  useImperativeHandle(ref, () => ({ scrollToIndex }), [scrollToIndex]);

  // The list got shorter (a delete, a new search) past the front item: go to
  // its new last item.
  useEffect(() => {
    if (itemCount > 0 && frontRef.current > itemCount - 1) {
      scrollToIndex(itemCount - 1, false);
      emitSettled(itemCount - 1, 0);
    }
  }, [emitSettled, itemCount, scrollToIndex]);

  // Taps: map the point (in the stage) to the item under it.
  const onFrontPressRef = useRef(onFrontPress);
  onFrontPressRef.current = onFrontPress;
  const handleTap = useCallback((tapX, tapY) => {
    if (step <= 0 || itemCount === 0) return;
    const front = Math.max(0, Math.min(itemCount - 1, Math.round(progress.value)));
    const x = tapX - containerWidth / 2; // from the centre
    let target = front;
    if (x > width / 2) target = front + 1;
    else if (x < -width / 2) target = variant === 'stack' ? front - 1 : -1;
    if (target < 0 || target >= itemCount) return;
    if (target === front) {
      onFrontPressRef.current?.(items[front], front, { x: x + width / 2, y: tapY, width, height });
      return;
    }
    triggerHaptic('selection');
    scrollToIndex(target);
  }, [containerWidth, height, itemCount, items, progress, scrollToIndex, step, variant, width]);

  const tapGesture = useMemo(() => Gesture.Tap()
    .maxDistance(TAP_MAX_DISTANCE_PX)
    .onEnd((e, success) => {
      'worklet';
      if (success) runOnJS(handleTap)(e.x, e.y);
    }), [handleTap]);
  const gesture = useMemo(() => Gesture.Race(panGesture, tapGesture), [panGesture, tapGesture]);

  // Window items, last one first: later siblings draw on top, so in the deck
  // look earlier items lie on the deck above later ones.
  const renderedIndexes = [];
  for (
    let i = Math.min(itemCount - 1, windowCentre + windowSpec.ahead);
    i >= Math.max(0, windowCentre - windowSpec.behind);
    i--
  ) {
    renderedIndexes.push(i);
  }

  return (
    <View onLayout={handleLayout} style={{ paddingTop }}>
      {itemCount > 0 ? (
        <>
          <GestureDetector gesture={gesture}>
          <View style={{ height }} collapsable={false}>
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
          </View>
          </GestureDetector>
          {/* shown for one item too, so the layout doesn't change */}
          {itemCount > 0 ? (
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
