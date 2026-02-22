import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { Iconify } from 'react-native-iconify';
import { useState, useEffect } from 'react';

export default function DeckLanguageModal({
    isVisible,
    onClose,
    languages = [],
    selectedLanguage,
    onSelectLanguage,
}) {
    const { colors } = useTheme();
    const [error, setError] = useState('');
    const { t } = useTranslation();
    const screenHeight = Dimensions.get('screen').height;

    const getDeckLanguageIcon = (sortOrder) => {
        const icons = {
            1: 'twemoji:flag-for-flag-turkey',
            2: 'twemoji:flag-england',
            3: 'twemoji:flag-germany',
            4: 'twemoji:flag-spain',
            5: 'twemoji:flag-france',
            6: 'twemoji:flag-portugal',
            7: 'twemoji:flag-saudi-arabia',
        };

        return icons[sortOrder] || 'twemoji:flag-for-flag-turkey';
    };

    const getDeckLanguageName = (language) => {
        const translation = t(`languages.${language.sort_order}`, null);
        return translation;
    };

    const handleToggle = (languageId) => {
        const isCurrentlySelected = selectedLanguage.includes(languageId);
      
        if (isCurrentlySelected) {
          // 1. EĞER KALDIRILIYORSA: Hiçbir engel yok, direkt kaldır.
          setError('');
          onSelectLanguage(languageId);
        } else {
          // 2. EĞER EKLENİYORSA: Mevcut uzunluğu kontrol et.
          if (selectedLanguage.length >= 2) {
            setError(t('create.maxLanguage', 'En fazla 2 dil seçebilirsiniz.'));
          } else {
            setError('');
            onSelectLanguage(languageId);
          }
        }
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
            deviceHeight={screenHeight}
        >
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={styles.headerRow}>
                <Text style={[typography.styles.h2, { color: colors.text}]}>
                    {t('create.languageHeading', 'İçerik Dili')}
                </Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}>
                    <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
                </TouchableOpacity>
            </View>
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
                            <View style={[styles.checkboxContainer, { backgroundColor: isChecked ? '#007AFF'  + '40' : 'transparent' }]}>
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
                                {getDeckLanguageName(language)}
                            </Text>
                            </View>
                        </TouchableOpacity>

                    );
                })}
                <View style={styles.errorText}>
                    {error && (
                        <View style={styles.errorContainer}>
                            <Iconify icon="material-symbols:info-outline" size={24} color="red" />
                            <View>
                                <Text style={[styles.errorText, { color: 'red' }]}>
                                    {error}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </View>
        </Modal >
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        borderRadius: moderateScale(32),
        padding: scale(24),
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: verticalScale(12),
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: moderateScale(12),
        borderRadius: moderateScale(12),
        width: '100%',
    },
    checkbox: {
        width: moderateScale(22),
        height: moderateScale(22),
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
        textAlignVertical: 'center',
        textAlign: 'center',
    },
    optionText: {
        fontSize: moderateScale(16),
    },
    languageIcon: {
        marginRight: scale(12),
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
        marginTop: verticalScale(8),
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: verticalScale(16),
      },
});
