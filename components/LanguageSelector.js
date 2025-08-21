import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { useTranslation } from 'react-i18next';

export default function LanguageSelector({ isVisible, onClose, onLanguageChange }) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const selectedLanguage = i18n.language;

  const languages = [
    { code: 'tr', name: 'Türkçe' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ar', name: 'Arabic' },
  ];

  const handleLanguageSelect = async (languageCode) => {
    await onLanguageChange(languageCode);
  };

  return (
    <Modal isVisible={isVisible} onBackdropPress={onClose}>
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
          >
            <Text style={[
              styles.languageText,
              { 
                color: selectedLanguage === language.code ? colors.secondary : colors.text,
                fontWeight: selectedLanguage === language.code ? 'bold' : 'normal'
              }
            ]}>
              {language.name}
            </Text>
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
});
