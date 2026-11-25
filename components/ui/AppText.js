import React from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';

// App-wide Text / TextInput. They follow the OS accessibility text size but
// never grow past 1.2×, so large system font sizes can't break layouts.
// (Text.defaultProps no longer applies to function components under React 19,
// so the cap has to live in a wrapper.) Import Text / TextInput from here
// instead of 'react-native'. For Animated.Text / Reanimated.Text, pass
// maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} explicitly.
export const MAX_FONT_SIZE_MULTIPLIER = 1.2;

// React 19 passes `ref` as a regular prop, so spreading props forwards it.
export function Text(props) {
  return <RNText maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} {...props} />;
}

export function TextInput(props) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} {...props} />;
}
