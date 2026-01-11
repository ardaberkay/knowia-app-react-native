import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

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
    borderWidth: moderateScale(1.5),
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '500',
  },
});
