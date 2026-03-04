import React, { useMemo } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { useTranslation } from 'react-i18next';

export default function SearchBar({ value, onChangeText, placeholder, style, variant }) {
  const { colors, isDarkMode } = useTheme(); 
  const { t } = useTranslation();
  useWindowDimensions();
  const isTablet = getIsTablet();
  
  const searchBarDimensions = useMemo(() => ({
    height: isTablet ? verticalScale(52) : verticalScale(48),
    paddingHorizontal: isTablet ? scale(14) : scale(10),
    paddingVertical: isTablet ? verticalScale(12) : verticalScale(10),
    fontSize: isTablet ? moderateScale(18) : moderateScale(16),
    iconSize: isTablet ? moderateScale(24) : moderateScale(20),
    borderRadius: isTablet ? moderateScale(28) : moderateScale(24),
    borderWidth: moderateScale(1),
    iconMarginRight: scale(6),
    iconMarginLeft: scale(4),
    inputPaddingHorizontal: isTablet ? scale(10) : scale(8),
  }), [isTablet]);
  
  // Şalterimiz: Eğer variant="light" gönderildiyse beyaz/cam moduna geç
  const isLight = variant === 'light';

  // isLight aktifse senin filtre butonundaki gibi şeffaf beyazlar kullanılıyor.
  // Değilse, uygulamanın normal temasına (isDarkMode) göre çalışıyor.
  const borderColor = isLight ? 'rgba(255, 255, 255, 0.3)' : (isDarkMode ? '#4A4A4A' : colors.border);
  const iconColor = isLight ? '#ffffff' : (isDarkMode ? '#B0B0B0' : colors.subtext);
  const textColor = isLight ? '#ffffff' : colors.text;
  const placeholderColor = isLight ? 'rgba(255, 255, 255, 0.7)' : (isDarkMode ? '#A0A0A0' : colors.subtext);
  const backgroundColor = isLight ? 'rgba(255, 255, 255, 0.15)' : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)');
  return (
    <View style={[
      styles.wrapper, 
      { 
        borderColor, 
        backgroundColor,
        height: searchBarDimensions.height,
        paddingHorizontal: searchBarDimensions.paddingHorizontal,
        borderRadius: searchBarDimensions.borderRadius,
        borderWidth: searchBarDimensions.borderWidth,
      }, 
      style
    ]}>
      <Iconify 
        icon="iconamoon:search" 
        size={searchBarDimensions.iconSize} 
        color={iconColor} 
        style={[{ marginRight: searchBarDimensions.iconMarginRight, marginLeft: searchBarDimensions.iconMarginLeft }]} 
      />
      <TextInput
        style={[
          styles.input, 
          typography.styles.body, 
          { 
            color: textColor,
            fontSize: searchBarDimensions.fontSize,
            paddingHorizontal: searchBarDimensions.inputPaddingHorizontal,
            paddingVertical: searchBarDimensions.paddingVertical,
          }
        ]}
        placeholder={placeholder || t('common.searchPlaceholder', 'Ara...')}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={placeholderColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: 'transparent' },
});