import React, { useMemo } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { useTranslation } from 'react-i18next';

export default function SearchBar({ value, onChangeText, placeholder, style, variant = 'default' }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  // useWindowDimensions hook'u - ekran döndürme desteği
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
  
  const isLight = variant === 'light';
  const borderColor = isLight ? 'rgba(255, 255, 255, 0.3)' : '#4A4A4A';
  const iconColor = isLight ? '#fff' : '#B0B0B0';
  const textColor = isLight ? '#fff' : colors.text;
  const placeholderColor = isLight ? 'rgba(255, 255, 255, 0.7)' : '#A0A0A0';
  const backgroundColor = isLight ? 'rgba(255, 255, 255, 0.15)' : 'transparent';

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
        style={[
          styles.icon,
          {
            marginRight: searchBarDimensions.iconMarginRight,
            marginLeft: searchBarDimensions.iconMarginLeft,
          }
        ]} 
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
        placeholder={t('common.searchPlaceholder', 'Ara...')}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={placeholderColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    // height, paddingHorizontal, borderRadius, borderWidth dinamik olarak uygulanacak
  },
  icon: {
    // marginRight, marginLeft dinamik olarak uygulanacak
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    // fontSize, paddingHorizontal, paddingVertical dinamik olarak uygulanacak
  },
});


