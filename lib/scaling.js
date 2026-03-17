import { Dimensions } from 'react-native';
import { useState, useEffect } from 'react';

const { width, height } = Dimensions.get('window');
const [shortDimension, longDimension] = width < height ? [width, height] : [height, width];

// Tablet algılama (600dp üzeri genellikle tablet)
const isTablet = shortDimension >= 600;

// Pixel 7 referans cihaz: 411dp width, 915dp height (yaklaşık)
// Tablet için iPad referans: 768dp width, 1024dp height
const guidelineBaseWidth = isTablet ? 768 : 411;
const guidelineBaseHeight = isTablet ? 1024 : 915;

export const scale = size => shortDimension / guidelineBaseWidth * size;
export const verticalScale = size => longDimension / guidelineBaseHeight * size;
export const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;
export const moderateVerticalScale = (size, factor = 0.5) => size + (verticalScale(size) - size) * factor;

// Tablet kontrolü için export
export const getIsTablet = () => isTablet;

// Ekran boyutlarını dinleyen hook - ekran döndürme desteği
export const useWindowDimensions = () => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    // Eski ve yeni API desteği
    let subscription;
    
    if (Dimensions.addEventListener) {
      // Yeni API (React Native 0.65+)
      subscription = Dimensions.addEventListener('change', ({ window }) => {
        setDimensions(window);
      });
    } else {
      // Eski API (React Native < 0.65)
      subscription = Dimensions.addListener('change', ({ window }) => {
        setDimensions(window);
      });
    }
    
    return () => {
      if (subscription) {
        if (typeof subscription.remove === 'function') {
          subscription.remove();
        } else if (typeof subscription === 'function') {
          subscription();
        }
      }
    };
  }, []);

  return dimensions;
};
