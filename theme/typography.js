import { moderateScale } from '../lib/scaling';

export const typography = {
  // Font aileleri
  fontFamily: {
    regular: 'Inter',
    light: 'Inter-Light',
    medium: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  // Font boyutları - Responsive (Pixel 7 base cihaz)
  fontSize: {
    xs: moderateScale(12),
    sm: moderateScale(14),
    base: moderateScale(16),
    lg: moderateScale(18),
    xl: moderateScale(24),
    '2xl': moderateScale(32),
    '3xl': moderateScale(40),
  },
  // Hazır stil kombinasyonları - Responsive
  styles: {
    h1: {
      fontFamily: 'Inter-Bold',
      fontSize: moderateScale(32),
    },
    h2: {
      fontFamily: 'Inter-SemiBold',
      fontSize: moderateScale(22),
    },
    subtitle: {
      fontFamily: 'Inter',
      fontSize: moderateScale(18),
    },
    body: {
      fontFamily: 'Inter',
      fontSize: moderateScale(16),
    },
    button: {
      fontFamily: 'Inter-SemiBold',
      fontSize: moderateScale(16),
    },
    caption: {
      fontFamily: 'Inter-Light',
      fontSize: moderateScale(14),
    },
    link: {
      fontFamily: 'Inter',
      fontSize: moderateScale(16),
    },
    linkBold: {
      fontFamily: 'Inter-SemiBold',
      fontSize: moderateScale(16),
    },
  },
};
