import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, TextInput } from 'react-native';

/**
 * ScrollView for form screens: the focused input stays above the keyboard.
 *
 * iOS: UIKit's own behaviour via `automaticallyAdjustKeyboardInsets` (content
 * insets follow the keyboard animation, the first responder is scrolled into
 * view, switching inputs scrolls natively).
 *
 * Android: the app runs with windowSoftInputMode="adjustNothing" (so the tab
 * bar never jumps), which means nothing resizes for the keyboard. Here the
 * ScrollView's bottom is pulled up to the keyboard's top edge, so its visible
 * area ends where the keyboard starts; Android then keeps a newly focused input
 * visible on its own. When the keyboard opens, the focused input is scrolled
 * into view once (`extraScrollHeight` above the keyboard).
 */
const FormScrollView = forwardRef(function FormScrollView(
  { extraScrollHeight = 24, style, onScroll, scrollEventThrottle, children, ...rest },
  ref
) {
  const scrollRef = useRef(null);
  useImperativeHandle(ref, () => scrollRef.current, []);
  const scrollYRef = useRef(0);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  const keyboardOverlapRef = useRef(0);

  const handleScroll = useCallback((e) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  }, [onScroll]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      const scrollView = scrollRef.current;
      if (!scrollView) return;
      scrollView.measureInWindow((x, y, width, height) => {
        // Bottom of the ScrollView as laid out without any keyboard margin.
        const overlap = Math.max(0, y + height + keyboardOverlapRef.current - keyboardTop);
        keyboardOverlapRef.current = overlap;
        setKeyboardOverlap(overlap);

        // Once the shorter ScrollView is laid out, bring the focused input up.
        requestAnimationFrame(() => {
          const input = TextInput.State.currentlyFocusedInput?.();
          if (!input?.measureInWindow) return;
          input.measureInWindow((ix, iy, iw, ih) => {
            const delta = iy + ih + extraScrollHeight - keyboardTop;
            if (delta > 0) {
              scrollRef.current?.scrollTo({ y: scrollYRef.current + delta, animated: true });
            }
          });
        });
      });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardOverlapRef.current = 0;
      setKeyboardOverlap(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [extraScrollHeight]);

  return (
    <ScrollView
      ref={scrollRef}
      style={keyboardOverlap ? [style, { marginBottom: keyboardOverlap }] : style}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle ?? 16}
      {...rest}
    >
      {children}
    </ScrollView>
  );
});

export default FormScrollView;
