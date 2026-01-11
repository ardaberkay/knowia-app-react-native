import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const [shortDimension, longDimension] = width < height ? [width, height] : [height, width];

// Pixel 7 referans cihaz: 411dp width, 915dp height (yaklaşık)
const guidelineBaseWidth = 411; // Pixel 7 genişlik
const guidelineBaseHeight = 915; // Pixel 7 yükseklik (yaklaşık)

export const scale = size => shortDimension / guidelineBaseWidth * size;
export const verticalScale = size => longDimension / guidelineBaseHeight * size;
export const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;
export const moderateVerticalScale = (size, factor = 0.5) => size + (verticalScale(size) - size) * factor;
