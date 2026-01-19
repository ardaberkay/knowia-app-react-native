import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { Iconify } from 'react-native-iconify';
import { useState, useEffect } from 'react';


const getDeckLanguageIcon = (sortOrder) => {
    const icons = {
      1: 'twemoji:flag-for-flag-turkey',
      2: 'twemoji:flag-england',
      3: 'twemoji:flag-spain',
      4: 'twemoji:flag-spain',
      5: 'twemoji:flag-france',
      6: 'twemoji:flag-portugal',
      7: 'twemoji:flag-saudi-arabia',
    };

    return icons[sortOrder] || 'twemoji:flag-for-flag-turkey';
  };


export default function DeckLanguageModal({
    isVisible,
    onClose,
    languages = [],
    selectedLanguage,
    onSelectLanguage,
}) {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const [error, setError] = useState('');

    const handleToggle = (languageId) => {
        // kaldırılıyorsa hata temizle
        if (selectedLanguage.includes(languageId)) {
          setError('');
          onSelectLanguage(languageId);
          return;
        }
      
        // limit aşıldı
        if (selectedLanguage.length >= 2) {
          setError(t('create.maxLanguage', 'En fazla 2 dil seçebilirsiniz.'));
          return;
        }
      
        // ekle
        setError('');
        onSelectLanguage(languageId);
      };
      

    return (
        <Modal
            isVisible={isVisible}
            onBackdropPress={onClose}
            onBackButtonPress={onClose}
            useNativeDriver
            useNativeDriverForBackdrop
            hideModalContentWhileAnimating
            backdropTransitionOutTiming={0}
            animationIn="slideInUp"
            animationOut="slideOutDown"
            statusBarTranslucent
        >
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <Text style={[typography.styles.h2, { color: colors.text, marginBottom: 16 }]}>
                    {t('profile.language')}
                </Text>
                <View>
                    {languages.map((language) => {
                        const isChecked = selectedLanguage.includes(language.id);


                        return (
                            <TouchableOpacity
                                key={language.id}
                                onPress={() => handleToggle(language.id)}
                                style={styles.optionRow}
                                activeOpacity={0.8}
                            >
                                {/* Checkbox */}
                                <View
                                    style={[
                                        styles.checkbox,
                                        {
                                            borderColor: colors.primary || '#007AFF',
                                            backgroundColor: isChecked
                                                ? colors.primary || '#007AFF'
                                                : 'transparent',
                                        },
                                    ]}
                                >
                                    {isChecked && <Text style={styles.checkmark}>✓</Text>}
                                </View>
                                <View style={styles.languageIcon}>
                                    <Iconify icon={getDeckLanguageIcon(language.sort_order)} size={24} />
                                </View>
                                {/* Language Name */}
                                <Text style={[styles.optionText, { color: colors.text }]}>
                                    {language.language_name}
                                </Text>
                            </TouchableOpacity>

                        );
                    })}
                                             <View style={styles.errorText}>
                                {error && (
                                    <Text style={[styles.errorText, { color: 'red' }]}>
                                        {error}
                                    </Text>
                                )}
                            </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        borderRadius: moderateScale(16),
        padding: scale(24),
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: verticalScale(10),
    },
    checkbox: {
        width: moderateScale(20),
        height: moderateScale(20),
        borderWidth: 2,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(12),
    },
    checkmark: {
        color: '#fff',
        fontSize: moderateScale(14),
        fontWeight: 'bold',
    },
    optionText: {
        fontSize: moderateScale(16),
    },
    languageIcon: {
        marginRight: scale(12),
    },
});
