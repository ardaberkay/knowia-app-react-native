import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function CreateButton({ onPress, disabled = false, text, loading = false, style, textStyle, colors, showIcon = false, iconName }) {
  const { colors: themeColors } = useTheme();
  const { t } = useTranslation();

  const gradientColors = colors || ['#F98A21', '#FF6B35'];

  return (
    <TouchableOpacity
      style={[
        styles.createButton,
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
        {showIcon && iconName && (
          <Iconify 
            icon={iconName} 
            size={moderateScale(20)} 
            color="#fff" 
            style={{ marginRight: scale(6) }} 
          />
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
    shadowOffset: { width: 0, height: verticalScale(1) },
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(2),
    elevation: 1,
  },
  createButtonText: {
    fontSize: moderateScale(17),
    fontWeight: '500',
    color: '#FFFFFF',
  },
  gradientButton: {
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(18),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 99,
  },
});
