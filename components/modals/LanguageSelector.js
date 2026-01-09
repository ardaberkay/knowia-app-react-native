import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';

export default function LanguageSelector({ isVisible, onClose, onLanguageChange }) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const selectedLanguage = i18n.language;

  const languages = useMemo(() => [
    { code: 'tr', name: 'Türkçe', icon: 'twemoji:flag-for-flag-turkey' },
    { code: 'en', name: 'English', icon: 'twemoji:flag-england' },
    { code: 'es', name: 'Spanish', icon: 'twemoji:flag-spain' },
    { code: 'fr', name: 'French', icon: 'twemoji:flag-france' },
    { code: 'pt', name: 'Portuguese', icon: 'twemoji:flag-portugal' },
    { code: 'ar', name: 'Arabic', icon: 'twemoji:flag-saudi-arabia' },
  ], []);

  const handleLanguageSelect = async (languageCode) => {
    await onLanguageChange(languageCode);
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
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <Text style={[typography.styles.h2, { color: colors.text, marginBottom: 16 }]}>
          {t('profile.language')}
        </Text>
        
        {languages.map((language) => (
          <TouchableOpacity
            key={language.code}
            style={styles.languageOption}
            onPress={() => handleLanguageSelect(language.code)}
            disabled={selectedLanguage === language.code}
            activeOpacity={0.7}
          >
            <View style={styles.languageRow}>
            <Iconify icon={language.icon} size={24} />
            <Text style={[
              styles.languageText,
              { 
                color: selectedLanguage === language.code ? colors.secondary : colors.text,
                fontWeight: selectedLanguage === language.code ? 'bold' : 'normal'
              }
            ]}>
              {language.name}
            </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    borderRadius: 16,
    padding: 24,
  },
  languageOption: {
    paddingVertical: 12,
  },
  languageText: {
    fontSize: 16,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
