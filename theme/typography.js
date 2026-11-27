// App-wide type system. Every font size and weight in the app comes from here.
//
// The scale follows the iOS / Material type ramps one step smaller, because
// Inter has a taller x-height than the system fonts (Inter 15 reads like
// SF 16–17). Weights are separate font files, so a weight is set with
// `fontFamily` (fonts.*), never `fontWeight`: Android fakes bold when a custom
// font gets `fontWeight`, and iOS only has the weights embedded in the app.

// Font files embedded from assets/ via the expo-font plugin in app.config.js
// (Inter 400 / 500 / 600 / 700).
export const fonts = {
  regular: 'Inter',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
};

// Font sizes (dp).
export const fontSizes = {
  micro: 11, // tiny labels; Apple's minimum readable size
  caption: 12, // badges, chips
  footnote: 13, // meta / info lines
  subhead: 14, // secondary text
  body: 15, // body text, list and deck titles, buttons
  bodyLarge: 17, // emphasised paragraphs, card back text
  title3: 19, // section titles
  title2: 22, // card question, sheet / modal titles, app bar title
  title1: 26, // screen titles
  largeTitle: 32, // hero titles and numbers
  display: 40, // the largest numbers (session completion)
};

// Line heights for multi-line text, per size. Not baked into textStyles: on a
// single line (buttons, badges, rows) an explicit lineHeight shifts the text
// off-centre, so add it only where text wraps.
export const lineHeights = {
  micro: 13,
  caption: 16,
  footnote: 18,
  subhead: 19,
  body: 21,
  bodyLarge: 24,
  title3: 24,
  title2: 28,
  title1: 32,
  largeTitle: 38,
  display: 46,
};

// Ready-made size + weight pairs.
export const textStyles = {
  // Large page title of the tab screens (Keşfet, Kitaplığım).
  screenTitle: { fontFamily: fonts.bold, fontSize: fontSizes.title1, letterSpacing: -0.5 },
  display: { fontFamily: fonts.bold, fontSize: fontSizes.display },
  largeTitle: { fontFamily: fonts.bold, fontSize: fontSizes.largeTitle },
  title1: { fontFamily: fonts.bold, fontSize: fontSizes.title1 },
  title2: { fontFamily: fonts.semibold, fontSize: fontSizes.title2 },
  title3: { fontFamily: fonts.semibold, fontSize: fontSizes.title3 },
  bodyLarge: { fontFamily: fonts.regular, fontSize: fontSizes.bodyLarge },
  headline: { fontFamily: fonts.semibold, fontSize: fontSizes.body },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.body },
  subhead: { fontFamily: fonts.regular, fontSize: fontSizes.subhead },
  footnote: { fontFamily: fonts.regular, fontSize: fontSizes.footnote },
  caption: { fontFamily: fonts.medium, fontSize: fontSizes.caption },
  micro: { fontFamily: fonts.semibold, fontSize: fontSizes.micro },
};

export const typography = {
  fonts,
  fontSizes,
  lineHeights,
  styles: textStyles,
};
