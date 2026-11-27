import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../ui/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import PhosphorIcon from '../ui/PhosphorIcon';
import { fontSizes, fonts } from '../../theme/typography';

// icon: an ICONS entry from theme/icons.js, shown before the text when showIcon.
export default function CreateButton({ onPress, disabled = false, text, loading = false, style, textStyle, colors, showIcon = false, icon }) {
  const { colors: themeColors } = useTheme();
  const { t } = useTranslation();

  const gradientColors = colors || ['#F98A21', '#FF6B35'];

  return (
    <TouchableOpacity
      style={[
        styles.createButton,
        { backgroundColor: gradientColors[0] },
        style
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.99]}
        style={styles.gradientButton}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {showIcon && icon && (
          <PhosphorIcon icon={icon} size={20} color="#fff" style={{ marginRight: 6 }} />
        )}
        <Text style={[
          styles.createButtonText,
          textStyle
        ]}>
          {loading ? t('create.creating', 'Oluşturuluyor...') : (text || t('create.create', 'Oluştur'))}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  createButton: {
    flex: 2,
    borderRadius: 99,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  createButtonText: {
    fontSize: fontSizes.bodyLarge,
    fontFamily: fonts.medium,
    color: '#FFFFFF',
  },
  gradientButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 99,
  },
});
