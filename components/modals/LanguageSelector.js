import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function LanguageSelector({ isVisible, onClose, onLanguageChange }) {
  const { colors, isDarkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const screenHeight = Dimensions.get('screen').height;
  const selectedLanguage = i18n.language;

  // Marka Rengi Fallback
  const primaryColor = colors.buttonColor || colors.primary || '#F98A21';

  const languages = useMemo(() => [
    { code: 'tr', name: 'Türkçe', icon: 'twemoji:flag-for-flag-turkey' },
    { code: 'en', name: 'English', icon: 'twemoji:flag-england' },
    { code: 'es', name: 'Spanish', icon: 'twemoji:flag-spain' },
    { code: 'fr', name: 'French', icon: 'twemoji:flag-france' },
    { code: 'pt', name: 'Portuguese', icon: 'twemoji:flag-portugal' },
    { code: 'de', name: 'German', icon: 'twemoji:flag-germany' },
  ], []);

  const handleLanguageSelect = async (languageCode) => {
    if (selectedLanguage !== languageCode) {
      await onLanguageChange(languageCode);
    }
  };

  return (
    <Modal 
      isVisible={isVisible} 
      onBackdropPress={onClose}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={300}
      animationOutTiming={300}
      backdropTransitionInTiming={300}
      backdropTransitionOutTiming={300}
      hideModalContentWhileAnimating={true}
      useNativeDriver={true}
      useNativeDriverForBackdrop={true}
      avoidKeyboard={true}
      statusBarTranslucent={true}
      deviceHeight={screenHeight}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        
        {/* Header Alanı */}
        <View style={styles.headerRow}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>
            {t('profile.language')}
          </Text>
          <TouchableOpacity 
            onPress={onClose} 
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            style={styles.closeBtnWrapper}
          >
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.listContainer}>
          {languages.map((language) => {
            const isSelected = selectedLanguage === language.code;
            
            return (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.languageCard,
                  {
                    backgroundColor: isSelected ? (isDarkMode ? `${primaryColor}20` : `${primaryColor}15`) : (isDarkMode ? '#2A2A2A' : '#F5F5F5'),
                    borderColor: isSelected ? primaryColor : 'transparent',
                  }
                ]}
                onPress={() => handleLanguageSelect(language.code)}
                disabled={isSelected} // Seçili olana tekrar basılmasını engeller
                activeOpacity={0.7}
              >
                <View style={styles.iconWrapper}>
                  <Iconify icon={language.icon} size={moderateScale(28)} />
                </View>
                <Text style={[
                  styles.languageText,
                  { 
                    color: isSelected ? primaryColor : colors.text,
                    fontWeight: isSelected ? '700' : '500'
                  }
                ]}>
                  {language.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    borderRadius: moderateScale(32),
    padding: scale(20),
    paddingBottom: verticalScale(32),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(20),
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: moderateScale(6),
    borderRadius: 99,
  },
  listContainer: {
    gap: verticalScale(12),
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
  },
  iconWrapper: {
    marginRight: scale(14),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  languageText: {
    fontSize: moderateScale(16),
  },
});