import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';

export default function SearchBar({ value, onChangeText, placeholder, style, variant = 'default' }) {
  const { colors } = useTheme();
  
  const isLight = variant === 'light';
  const borderColor = isLight ? 'rgba(255, 255, 255, 0.3)' : '#4A4A4A';
  const iconColor = isLight ? '#fff' : '#B0B0B0';
  const textColor = isLight ? '#fff' : colors.text;
  const placeholderColor = isLight ? 'rgba(255, 255, 255, 0.7)' : '#A0A0A0';
  const backgroundColor = isLight ? 'rgba(255, 255, 255, 0.15)' : 'transparent';

  return (
    <View style={[styles.wrapper, { borderColor, backgroundColor }, style]}>
      <Iconify icon="iconamoon:search" size={20} color={iconColor} style={styles.icon} />
      <TextInput
        style={[styles.input, typography.styles.body, { color: textColor }]}
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
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 48,
  },
  icon: {
    marginRight: 6,
    marginLeft: 4,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 16,
  },
});


