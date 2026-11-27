import React from 'react';
import { Text } from 'react-native';
import glyphs from '../../assets/fonts/phosphor-glyphs.json';

// Phosphor icons (2.1.2) drawn as font glyphs, much lighter than SVG. The
// fonts are embedded from assets/fonts (expo-font plugin, app.config.js) under
// these family names. Every weight uses the same codepoints, so one glyph map
// (assets/fonts/phosphor-glyphs.json, generated from Phosphor's regular
// style.css) covers all of them.
//
// Usage: pick the icon from theme/icons.js,
//   <PhosphorIcon icon={ICONS.close} size={24} color={colors.text} />
// or name it directly (kebab-case names from phosphoricons.com):
//   <PhosphorIcon name="house" weight="fill" size={24} color={colors.text} />
export const PHOSPHOR_FAMILIES = {
  regular: 'Phosphor',
  fill: 'Phosphor-Fill',
  bold: 'Phosphor-Bold',
};

// The glyph (single character) for an icon name, or null if unknown.
export function phosphorGlyph(name) {
  const code = glyphs[name];
  return code == null ? null : String.fromCodePoint(code);
}

export default function PhosphorIcon({ icon, name = icon?.name, weight = icon?.weight ?? 'regular', size = 24, color, style, ...props }) {
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
        // A fixed size×size box with the glyph centred, so the icon centres in its
        // parent even when the parent is narrower than the icon.
        { width: size, height: size, textAlign: 'center', fontFamily: PHOSPHOR_FAMILIES[weight] ?? PHOSPHOR_FAMILIES.regular, fontSize: size, lineHeight: size, color, includeFontPadding: false },
        style,
      ]}
    >
      {String.fromCodePoint(code)}
    </Text>
  );
}
