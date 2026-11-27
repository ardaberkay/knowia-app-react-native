import React from 'react';
import { Text } from 'react-native';
import glyphs from '../../assets/phosphor-glyphs.json';

// Phosphor icons drawn as font glyphs (much lighter than SVG). The fonts are
// embedded from assets/ (expo-font plugin, app.config.js) under these family
// names. Phosphor 2.1.2; every weight uses the same
// codepoints, so one glyph map (assets/phosphor-glyphs.json, generated from
// Phosphor's regular style.css) covers all of them.
// Usage: <PhosphorIcon name="house" weight="fill" size={24} color={colors.text} />
// Names are the kebab-case names from phosphoricons.com.
export const PHOSPHOR_FAMILIES = {
  regular: 'Phosphor',
  fill: 'Phosphor-Fill',
};
const FAMILIES = PHOSPHOR_FAMILIES;

// The glyph (single character) for an icon name, or null if unknown.
export function phosphorGlyph(name) {
  const code = glyphs[name];
  return code == null ? null : String.fromCodePoint(code);
}

export default function PhosphorIcon({ name, weight = 'regular', size = 24, color, style, ...props }) {
  const code = glyphs[name];
  if (code == null) {
    if (__DEV__) console.warn(`PhosphorIcon: unknown icon "${name}"`);
    return null;
  }
  return (
    <Text
      allowFontScaling={false}
      accessible={false}
      {...props}
      style={[
        { fontFamily: FAMILIES[weight] ?? FAMILIES.regular, fontSize: size, lineHeight: size, color, includeFontPadding: false },
        style,
      ]}
    >
      {String.fromCodePoint(code)}
    </Text>
  );
}
