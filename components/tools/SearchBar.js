import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput } from '../ui/AppText';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';

const searchBarDimensions = {
  height: 48,
  paddingHorizontal: 10,
  paddingVertical: 10,
  fontSize: 16,
  iconSize: 20,
  borderRadius: 24,
  borderWidth: 1,
  iconMarginRight: 6,
  iconMarginLeft: 4,
  inputPaddingHorizontal: 8,
};

export default function SearchBar({ value, onChangeText, placeholder, style, variant }) {
  const { colors, isDarkMode } = useTheme(); 
  const { t } = useTranslation();
  
  
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