import React, {
    forwardRef,
    memo,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
  } from 'react';
  import { StyleSheet, View } from 'react-native';
  import { Gesture, GestureDetector } from 'react-native-gesture-handler';
  import Reanimated, {
    cancelAnimation,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
  } from 'react-native-reanimated';
  
  const DEFAULT_STACK_COUNT = 4;
  const DEFAULT_SWIPE_DURATION = 450;
  const DEFAULT_SWIPE_THRESHOLD_RATIO = 0.24;
  const DEFAULT_VELOCITY_THRESHOLD = 650;
  const DEFAULT_ROTATION_DEG = 9;
  const HORIZONTAL_ACTIVATION_PX = 10;
  const VERTICAL_FAIL_PX = 6;
  const TAP_MAX_DISTANCE_PX = 8;
  const TAP_MAX_DURATION_MS = 280;
  
  const SwipeCardLayer = forwardRef(function SwipeCardLayerImpl({
    card,
    cardIndex,
    isActive,
    disabled,
    cardWidth,
    cardHeight,
    renderCard,
    renderCardActions = null,
    onSwipeStart,
    onSwiped,
    onSwipeCancelled,
    onCardTap,
    swipeThreshold,
    activeSwipeX,
    velocityThreshold,
    swipeAnimationDuration,
    maxRotation,
  }, ref) {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const isAnimating = useSharedValue(0);
    const swipeMetaRef = useRef(null);
  
    // Shared by the card and its action row so the favorite controls use the
    // exact same entrance/exit and flip timeline as the card itself.
    const flipProgress = useSharedValue(0);
    const entranceProgress = useSharedValue(0);
    const entranceOpacity = useSharedValue(0);
  
    const reset = useCallback(() => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      translateX.value = 0;
      translateY.value = 0;
      isAnimating.value = 0;
      swipeMetaRef.current = null;
      cancelAnimation(flipProgress);
      cancelAnimation(entranceProgress);
      cancelAnimation(entranceOpacity);
      flipProgress.value = 0;
      entranceProgress.value = 0;
      entranceOpacity.value = 0;
      if (activeSwipeX) activeSwipeX.value = 0;
    }, [activeSwipeX, entranceOpacity, entranceProgress, flipProgress, isAnimating, translateX, translateY]);
  
    useEffect(() => {
      // The layer is keyed by card id at the parent level, so this runs only
      // when this physical React layer receives a truly different card.
      reset();
    }, [card?.card_id, reset]);
  
    useEffect(() => {
      cancelAnimation(entranceProgress);
      cancelAnimation(entranceOpacity);
  
      if (!isActive || !card) {
        entranceProgress.value = 0;
        entranceOpacity.value = 0;
        return;
      }
  
      entranceProgress.value = withSpring(1, {
        damping: 12,
        stiffness: 400,
        mass: 0.45,
        overshootClamping: false,
      });
      entranceOpacity.value = withTiming(1, { duration: 30 });
    }, [card, entranceOpacity, entranceProgress, isActive]);
  
    const completeSwipe = useCallback((direction) => {
      const meta = swipeMetaRef.current;
      swipeMetaRef.current = null;
      onSwiped?.(cardIndex, direction, meta);
  
      // Let React process the synchronous counter update first, then return the
      // shared progress to zero so the new number appears without a stale-value frame.
      if (activeSwipeX) {
        requestAnimationFrame(() => {
          activeSwipeX.value = 0;
        });
      }
    }, [activeSwipeX, cardIndex, onSwiped]);
  
    const cancelSwipe = useCallback(() => {
      swipeMetaRef.current = null;
      onSwipeCancelled?.(cardIndex);
    }, [cardIndex, onSwipeCancelled]);
  
    const animateOut = useCallback((direction, meta = null) => {
      if (!isActive || disabled || !card) return;
      if (isAnimating.value) return;
  
      swipeMetaRef.current = meta;
      isAnimating.value = 1;
      onSwipeStart?.(cardIndex, direction > 0 ? 'right' : 'left', meta);
  
      const targetX = direction > 0
        ? cardWidth + 220
        : -(cardWidth + 220);
  
      const timingConfig = { duration: swipeAnimationDuration };
      translateX.value = withTiming(
        targetX,
        timingConfig,
        (finished) => {
          'worklet';
          if (!finished) {
            isAnimating.value = 0;
            if (activeSwipeX) activeSwipeX.value = 0;
            return;
          }
          // Keep the swipe progress at the outgoing position until the JS-side
          // commit updates the counter value. This prevents one frame where the
          // icon disappears and the old numeric count is visible again.
          runOnJS(completeSwipe)(direction > 0 ? 'right' : 'left');
        }
      );
      if (activeSwipeX) {
        activeSwipeX.value = withTiming(targetX, timingConfig);
      }
  
      translateY.value = 0;
    }, [activeSwipeX, card, cardIndex, cardWidth, completeSwipe, disabled, isActive, isAnimating, onSwipeStart, swipeAnimationDuration, translateX, translateY]);
  
    const handleTap = useCallback(() => {
      if (!isActive || disabled || !card || isAnimating.value) return;
      onCardTap?.(cardIndex);
    }, [card, cardIndex, disabled, isActive, isAnimating, onCardTap]);
  
    useImperativeHandle(ref, () => ({
      swipeLeft: (meta = null) => animateOut(-1, meta),
      swipeRight: (meta = null) => animateOut(1, meta),
      reset,
    }), [animateOut, reset]);
  
    const panGesture = useMemo(() => {
      return Gesture.Pan()
        .enabled(Boolean(isActive && !disabled && card))
        .activeOffsetX([-HORIZONTAL_ACTIVATION_PX, HORIZONTAL_ACTIVATION_PX])
        .failOffsetY([-VERTICAL_FAIL_PX, VERTICAL_FAIL_PX])
        .onUpdate((event) => {
          'worklet';
          if (isAnimating.value) return;
          translateX.value = event.translationX;
          if (activeSwipeX) activeSwipeX.value = event.translationX;
          translateY.value = 0;
        })
        .onEnd((event) => {
          'worklet';
          if (isAnimating.value) return;
  
          const x = translateX.value;
          const absX = Math.abs(x);
          const velocityX = event.velocityX || 0;
          const velocityY = event.velocityY || 0;
          const direction = x >= 0 ? 1 : -1;
          const farEnough = absX >= swipeThreshold;
          const fastEnough =
            Math.abs(velocityX) >= velocityThreshold &&
            Math.abs(velocityX) > Math.abs(velocityY);
  
          if (farEnough || fastEnough) {
            isAnimating.value = 1;
            runOnJS(onSwipeStart)(cardIndex, direction > 0 ? 'right' : 'left', null);
  
            const targetX = direction > 0
              ? cardWidth + 220
              : -(cardWidth + 220);
  
            const timingConfig = { duration: swipeAnimationDuration };
            translateX.value = withTiming(
              targetX,
              timingConfig,
              (finished) => {
                'worklet';
                if (!finished) {
                  isAnimating.value = 0;
                  if (activeSwipeX) activeSwipeX.value = 0;
                  return;
                }
                // Keep the outgoing swipe progress until the JS commit updates
                // the counter, then completeSwipe resets it on the next frame.
                runOnJS(completeSwipe)(direction > 0 ? 'right' : 'left');
              }
            );
            if (activeSwipeX) {
              activeSwipeX.value = withTiming(targetX, timingConfig);
            }
            translateY.value = 0;
            return;
          }
  
          isAnimating.value = 1;
          translateX.value = withSpring(
            0,
            {
              damping: 24,
              stiffness: 310,
              mass: 0.7,
            },
            (finished) => {
              'worklet';
              isAnimating.value = 0;
              if (activeSwipeX) activeSwipeX.value = 0;
              if (finished) runOnJS(cancelSwipe)();
            }
          );
          if (activeSwipeX) {
            activeSwipeX.value = withSpring(0, {
              damping: 24,
              stiffness: 310,
              mass: 0.7,
            });
          }
          translateY.value = 0;
        });
    }, [activeSwipeX, cancelSwipe, card, cardIndex, cardWidth, completeSwipe, disabled, isActive, isAnimating, onSwipeStart, swipeAnimationDuration, swipeThreshold, translateX, translateY, velocityThreshold]);
  
    const tapGesture = useMemo(() => {
      return Gesture.Tap()
        .enabled(Boolean(isActive && !disabled && card))
        .maxDistance(TAP_MAX_DISTANCE_PX)
        .maxDuration(TAP_MAX_DURATION_MS)
        .onEnd((_event, success) => {
          'worklet';
          if (success && !isAnimating.value) {
            runOnJS(handleTap)();
          }
        });
    }, [card, disabled, handleTap, isActive, isAnimating]);
  
    const composedGesture = useMemo(
      () => Gesture.Race(tapGesture, panGesture),
      [panGesture, tapGesture]
    );
  
    // IMPORTANT: zIndex is derived from the card's absolute index, not its
    // The next card keeps the same native stacking order (e.g. 99 stays
    // 99) instead of changing 99 -> 100. This avoids an Android compositor
    // reorder/repaint at the exact frame where the old top card disappears.
    const layerZIndex = 100000 - cardIndex;
  
    const activeStyle = useAnimatedStyle(() => {
      const rotation = (translateX.value / Math.max(1, cardWidth)) * maxRotation;
      return {
        transform: [
          { translateX: translateX.value },
          // No base vertical movement: every card remains on the exact same
          // center line. Swipe is horizontal only; rotation stays unchanged.
          { rotateZ: `${rotation}deg` },
        ],
        zIndex: layerZIndex,
        // Same compositor elevation for every card. There is no depth-based
        // elevation, so the cards cannot visually float relative to each other.
        elevation: 10,
      };
    }, [cardWidth, layerZIndex, maxRotation]);
  
    const stackStyle = useMemo(() => ({
      // Every card uses the exact same x/y/size/scale. Only the stable absolute
      // card index determines stacking order. The zIndex does not change when
      // this card moves from preview to active.
      zIndex: layerZIndex,
      elevation: 10,
    }), [layerZIndex]);
  
    const content = renderCard?.(card, {
      isActive,
      isPreview: !isActive,
      index: cardIndex,
      swipeX: translateX,
      flipProgress,
      entranceProgress,
      entranceOpacity,
    });
  
    // Actions deliberately stay outside GestureDetector. They are still inside
    // the same transformed physical card layer, so they move with the card, but
    // a press on the favorite button cannot win the card's flip Tap gesture.
    const actions = isActive
      ? renderCardActions?.(card, {
          isActive,
          index: cardIndex,
          swipeX: translateX,
          flipProgress,
          entranceProgress,
          entranceOpacity,
        })
      : null;
  
    const layerStyle = isActive ? activeStyle : stackStyle;
  
    return (
      <Reanimated.View
        style={[
          styles.layer,
          { width: cardWidth, height: cardHeight },
          layerStyle,
        ]}
        pointerEvents={isActive ? 'auto' : 'none'}
      >
        <GestureDetector gesture={composedGesture}>
          <Reanimated.View
            style={styles.gestureSurface}
            pointerEvents={isActive ? 'auto' : 'none'}
          >
            {content}
          </Reanimated.View>
        </GestureDetector>
  
        {actions}
      </Reanimated.View>
    );
  });
  
  const MemoizedSwipeCardLayer = memo(SwipeCardLayer, (prev, next) => {
    return (
      prev.card === next.card &&
      prev.cardIndex === next.cardIndex &&
      prev.isActive === next.isActive &&
      prev.disabled === next.disabled &&
      prev.cardWidth === next.cardWidth &&
      prev.cardHeight === next.cardHeight &&
      prev.renderCard === next.renderCard &&
      prev.renderCardActions === next.renderCardActions &&
      prev.onSwipeStart === next.onSwipeStart &&
      prev.onSwiped === next.onSwiped &&
      prev.onSwipeCancelled === next.onSwipeCancelled &&
      prev.onCardTap === next.onCardTap &&
      prev.activeSwipeX === next.activeSwipeX &&
      prev.swipeThreshold === next.swipeThreshold &&
      prev.velocityThreshold === next.velocityThreshold &&
      prev.swipeAnimationDuration === next.swipeAnimationDuration &&
      prev.maxRotation === next.maxRotation
    );
  });
  
  const SwipeCardDeck = forwardRef(function SwipeCardDeck({
    cards,
    currentIndex = 0,
    disabled = false,
    cardWidth,
    cardHeight,
    renderCard,
    renderCardActions = null,
    onSwipeStart = () => {},
    onSwiped = () => {},
    onSwipeCancelled = () => {},
    onCardTap = () => {},
    activeSwipeX,
    stackSize = DEFAULT_STACK_COUNT,
    swipeThreshold = Math.max(80, cardWidth * DEFAULT_SWIPE_THRESHOLD_RATIO),
    velocityThreshold = DEFAULT_VELOCITY_THRESHOLD,
    swipeAnimationDuration = DEFAULT_SWIPE_DURATION,
    maxRotation = DEFAULT_ROTATION_DEG,
    style,
  }, ref) {
    const activeIndexRef = useRef(currentIndex);
    const transitionLockRef = useRef(false);
    const layerRefs = useRef(new Map());
  
    useEffect(() => {
      if (transitionLockRef.current) return;
      activeIndexRef.current = currentIndex;
  
      // Each physical card layer owns its own reset/entrance lifecycle.
      // Do not reset every layer here: on currentIndex changes that would run
      // immediately after the new active layer starts its entrance animation,
      // leaving entranceOpacity at 0 and making the card content invisible.
      if (activeSwipeX) activeSwipeX.value = 0;
    }, [activeSwipeX, currentIndex]);
  
    const handleSwipeStart = useCallback((index, direction, meta) => {
      if (index !== activeIndexRef.current) return;
      if (transitionLockRef.current) return;
      transitionLockRef.current = true;
      onSwipeStart?.(index, direction, meta);
    }, [onSwipeStart]);
  
    const handleSwipeCancelled = useCallback((index) => {
      if (index !== activeIndexRef.current) return;
      transitionLockRef.current = false;
      onSwipeCancelled?.(index);
    }, [onSwipeCancelled]);
  
    const handleSwiped = useCallback((index, direction, meta) => {
      if (index !== activeIndexRef.current) return;
  
      const nextIndex = index + 1;
      activeIndexRef.current = nextIndex;
  
      // React updates currentIndex only after the off-screen animation has
      // completed. The next card was already mounted in this render window.
      onSwiped?.(index, direction, meta);
      transitionLockRef.current = false;
    }, [onSwiped]);
  
    const handleCardTap = useCallback((index) => {
      if (index !== activeIndexRef.current) return;
      onCardTap?.(index);
    }, [onCardTap]);
  
    const startImperativeSwipe = useCallback((direction, meta = null) => {
      if (transitionLockRef.current || disabled) return;
      const index = activeIndexRef.current;
      if (!cards?.[index]) return;
  
      const layerRef = layerRefs.current.get(index);
      if (direction < 0) layerRef?.current?.swipeLeft?.(meta);
      else layerRef?.current?.swipeRight?.(meta);
    }, [cards, disabled]);
  
    useImperativeHandle(ref, () => ({
      swipeLeft: (meta = null) => startImperativeSwipe(-1, meta),
      swipeRight: (meta = null) => startImperativeSwipe(1, meta),
      reset: () => {
        transitionLockRef.current = false;
        activeIndexRef.current = currentIndex;
        layerRefs.current.forEach((layerRef) => layerRef.current?.reset?.());
      },
    }), [currentIndex, startImperativeSwipe]);
  
    const visibleCount = Math.max(1, Math.min(stackSize, 5));
    const visibleCards = useMemo(() => {
      return cards?.slice(currentIndex, currentIndex + visibleCount) || [];
    }, [cards, currentIndex, visibleCount]);
  
    const getLayerRef = useCallback((index) => {
      if (!layerRefs.current.has(index)) {
        layerRefs.current.set(index, React.createRef());
      }
      return layerRefs.current.get(index);
    }, []);
  
    // Clean refs for cards that are no longer in the visible window.
    useEffect(() => {
      const validIndexes = new Set(visibleCards.map((_, offset) => currentIndex + offset));
      layerRefs.current.forEach((_value, index) => {
        if (!validIndexes.has(index)) layerRefs.current.delete(index);
      });
    }, [currentIndex, visibleCards]);
  
    const safeRender = useCallback((card, params) => {
      if (!card) return null;
      return renderCard?.(card, params);
    }, [renderCard]);
  
    return (
      <View style={[styles.deck, { width: cardWidth, height: cardHeight }, style]}>
        {visibleCards.map((card, offset) => {
          const cardIndex = currentIndex + offset;
          const isActive = offset === 0;
          const layerRef = getLayerRef(cardIndex);
  
          return (
            <MemoizedSwipeCardLayer
              key={String(card?.queue_id ?? card?.card_id ?? `card-${cardIndex}`)}
              ref={layerRef}
              card={card}
              cardIndex={cardIndex}
              isActive={isActive}
              disabled={disabled}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              renderCard={safeRender}
              renderCardActions={renderCardActions}
              onSwipeStart={handleSwipeStart}
              onSwiped={handleSwiped}
              onSwipeCancelled={handleSwipeCancelled}
              onCardTap={handleCardTap}
              activeSwipeX={activeSwipeX}
              swipeThreshold={swipeThreshold}
              velocityThreshold={velocityThreshold}
              swipeAnimationDuration={swipeAnimationDuration}
              maxRotation={maxRotation}
            />
          );
        })}
      </View>
    );
  });
  
  SwipeCardDeck.displayName = 'SwipeCardDeck';
  
  const styles = StyleSheet.create({
    deck: {
      position: 'relative',
      alignSelf: 'center',
      overflow: 'visible',
    },
    layer: {
      position: 'absolute',
      left: 0,
      top: 0,
      overflow: 'visible',
    },
    gestureSurface: {
      width: '100%',
      height: '100%',
    },});
  
  export default memo(SwipeCardDeck);
  