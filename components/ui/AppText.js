import React, { createContext, useContext } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import { fonts } from '../../theme/typography';

// App-wide Text / TextInput. They follow the OS accessibility text size but
// never grow past 1.2×, so large system font sizes can't break layouts.
// (Text.defaultProps no longer applies to function components under React 19,
// so the cap has to live in a wrapper.) Import Text / TextInput from here
// instead of 'react-native'. For Animated.Text / Reanimated.Text, pass
// maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} explicitly.
export const MAX_FONT_SIZE_MULTIPLIER = 1.2;

// Text without a font of its own uses Inter instead of the system font.
// Only the outermost Text gets it: nested Text inherits from its parent, and a
// base font there would override the parent's weight.
const BASE_STYLE = { fontFamily: fonts.regular };
const InsideText = createContext(false);

// React 19 passes `ref` as a regular prop, so spreading props forwards it.
export function Text({ style, ...props }) {
  const nested = useContext(InsideText);
  const text = (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
      {...props}
      style={nested ? style : [BASE_STYLE, style]}
    />
  );
  return nested ? text : <InsideText.Provider value>{text}</InsideText.Provider>;
}

export function TextInput({ style, ...props }) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} {...props} style={[BASE_STYLE, style]} />;
}
