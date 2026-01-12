import React, { useMemo } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';

export default function SearchBar({ value, onChangeText, placeholder, style, variant = 'default' }) {
  const { colors } = useTheme();
  
  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  // Responsive boyutlar - useMemo ile optimize edilmiş
  const searchBarDimensions = useMemo(() => {
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    
    return {
      height: isSmallPhone ? verticalScale(48) : (isTablet ? verticalScale(52) : verticalScale(48)),
      paddingHorizontal: isSmallPhone ? scale(10) : (isTablet ? scale(14) : scale(10)),
      paddingVertical: isSmallPhone ? verticalScale(10) : (isTablet ? verticalScale(12) : verticalScale(10)),
      fontSize: isSmallPhone ? moderateScale(14) : (isTablet ? moderateScale(18) : moderateScale(16)),
      iconSize: isSmallPhone ? moderateScale(18) : (isTablet ? moderateScale(24) : moderateScale(20)),
      borderRadius: isSmallPhone ? moderateScale(20) : (isTablet ? moderateScale(28) : moderateScale(24)),
      borderWidth: isSmallPhone ? moderateScale(0.8) : moderateScale(1),
      iconMarginRight: isSmallPhone ? scale(4) : scale(6),
      iconMarginLeft: isSmallPhone ? scale(2) : scale(4),
      inputPaddingHorizontal: isSmallPhone ? scale(6) : (isTablet ? scale(10) : scale(8)),
    };
  }, [width, isTablet]);
  
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
        placeholder={placeholder}
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


