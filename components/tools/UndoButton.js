import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';

export default function UndoButton({ onPress, disabled = false, text, style, textStyle }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={[
        styles.undoButton,
        { borderColor: colors.border },
        style
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[
        styles.undoButtonText,
        { color: colors.text },
        textStyle
      ]}>
        {text || t('create.removeChanges', 'Geri Al')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  undoButton: {
    flex: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
