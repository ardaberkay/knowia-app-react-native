import React from 'react';
import { Image as ExpoImage } from 'expo-image';

// App-wide image (expo-image). Remote images (card images, avatars) are kept
// in memory and on disk: shown again without a download (Supabase egress) and
// without a blank frame when a screen re-renders (disk-only caching made the
// DeckDetail creator avatar blink while opening another screen).
// Accepts the React Native Image props used in the app (source, style,
// resizeMode, onLoadEnd, …); import Image from here instead of 'react-native'.
export function Image({ cachePolicy = 'memory-disk', transition = 0, ...props }) {
  return <ExpoImage cachePolicy={cachePolicy} transition={transition} {...props} />;
}
