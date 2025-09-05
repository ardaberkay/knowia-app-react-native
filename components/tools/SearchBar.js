import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';

export default function SearchBar({ value, onChangeText, placeholder, style }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrapper, { borderColor: '#4A4A4A'}, style]}>
      <Iconify icon="iconamoon:search" size={20} color="#B0B0B0" style={styles.icon} />
      <TextInput
        style={[styles.input, typography.styles.body, { color: colors.text }]}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={'#A0A0A0'}
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


