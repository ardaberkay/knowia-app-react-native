import React, { createContext, useContext } from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet } from 'react-native';
import { fonts } from '../../theme/typography';
import i18n from '../../lib/i18n';

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

// textTransform: 'uppercase' ignores the language: in Turkish "i" became "I"
// (ÖĞRENILDI). Upper-casing is done here with the app language instead
// (i → İ, ı → I in Turkish), and the native transform is switched off.
const NO_TRANSFORM = { textTransform: 'none' };
const upperForLanguage = (text) => {
  if (String(i18n.language || '').toLowerCase().startsWith('tr')) {
    return text.replace(/i/g, 'İ').toUpperCase();
  }
  return text.toUpperCase();
};
const upperChildren = (children) => React.Children.map(children, (child) => (
  typeof child === 'string' ? upperForLanguage(child) : child
));

// React 19 passes `ref` as a regular prop, so spreading props forwards it.
export function Text({ style, children, ...props }) {
  const nested = useContext(InsideText);
  const uppercase = style != null && StyleSheet.flatten(style)?.textTransform === 'uppercase';
  const text = (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
      {...props}
      style={[...(nested ? [] : [BASE_STYLE]), style, uppercase ? NO_TRANSFORM : null]}
    >
      {uppercase ? upperChildren(children) : children}
    </RNText>
  );
  return nested ? text : <InsideText.Provider value>{text}</InsideText.Provider>;
}

export function TextInput({ style, ...props }) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} {...props} style={[BASE_STYLE, style]} />;
}
