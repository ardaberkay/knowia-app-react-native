import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, UIManager, Platform, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { Iconify } from 'react-native-iconify';
import { triggerHaptic } from '../../lib/hapticManager';

// Android cihazlarda LayoutAnimation'ın çalışması için bu ayar zorunludur
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DeckLanguageModal({
  isVisible,
  onClose,
  languages = [],
  selectedLanguage,
  onSelectLanguage,
}) {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const screenHeight = Dimensions.get('screen').height;

  // Optimistic UI için yerel state
  const [localSelected, setLocalSelected] = useState([]);
  const [error, setError] = useState('');

  // Hata mesajı için animasyon değeri
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // Marka Rengi Fallback
  const primaryColor = colors.buttonColor || colors.primary || '#F98A21';

  // Modal açıldığında, üst bileşenden gelen veriyi yerel state'e kopyala
  useEffect(() => {
    if (isVisible) {
      setLocalSelected(selectedLanguage || []);
      setError('');
    }
  }, [isVisible]);

  // Hata tetiklendiğinde titreme animasyonu oynat
  useEffect(() => {
    if (error) {
      triggerHaptic('error');
      Animated.sequence([
        Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true })
      ]).start();
    }
  }, [error, shakeAnimation]);

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
    return t(`languages.${language.sort_order}`, null);
  };

  const handleToggle = (languageId) => {
    // Üst bileşen yerine, anında tepki veren yerel state'i kontrol ediyoruz
    const isCurrentlySelected = localSelected.includes(languageId);

    if (isCurrentlySelected) {
      // Seçimi kaldır: Anında yerel state'i güncelle, sonra parent'a haber ver
      const newList = localSelected.filter(id => id !== languageId);
      setLocalSelected(newList);
      if (error) setError('');
      onSelectLanguage(languageId);
    } else {
      // Yeni seçim ekle
      if (localSelected.length >= 2) {
        setError(t('create.maxLanguage', 'En fazla 2 dil seçebilirsiniz.'));
      } else {
        const newList = [...localSelected, languageId];
        setLocalSelected(newList);
        if (error) setError('');
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
      backdropTransitionOutTiming={150}
      animationInTiming={200}
      animationOutTiming={200}
      backdropTransitionInTiming={200}
      hardwareAccelerated={true}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      statusBarTranslucent
      deviceHeight={screenHeight}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>
            {t('create.languageHeading', 'İçerik Dili')}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            style={styles.closeButton}
          >
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Bilgilendirme Metni */}
        <Text style={[styles.infoText, { color: isDarkMode ? '#aaa' : '#666' }]}>
          {t('create.languageSub', 'Destenin içerik dillerini seçin (Maksimum 2)')}
        </Text>

        {/* List of Languages */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        >
          {languages.map((language) => {
            // Artık props'tan gelen 'selectedLanguage' yerine 'localSelected' kullanıyoruz
            const isChecked = localSelected.includes(language.id);

            return (
              <TouchableOpacity
                key={language.id}
                onPress={() => {
                  triggerHaptic('selection');
                  handleToggle(language.id);
                }}
                activeOpacity={0.8} // Tıklama hissiyatını biraz daha toklaştırdık (0.7 -> 0.8)
                style={[
                  styles.languageCard,
                  {
                    backgroundColor: isChecked ? (isDarkMode ? `${primaryColor}20` : `${primaryColor}15`) : (isDarkMode ? '#2A2A2A' : '#F5F5F5'),
                    borderColor: isChecked ? primaryColor : 'transparent',
                  }
                ]}
              >
                <View style={styles.cardLeft}>
                  <View style={styles.iconWrapper}>
                    <Iconify icon={getDeckLanguageIcon(language.sort_order)} size={moderateScale(28)} />
                  </View>
                  <Text style={[styles.languageName, { color: isChecked ? primaryColor : colors.text, fontWeight: isChecked ? '700' : '500' }]}>
                    {getDeckLanguageName(language)}
                  </Text>
                </View>

                {/* Modern Yuvarlak Radio/Check İkonu */}
                <View style={[
                  styles.radioCircle,
                  {
                    borderColor: isChecked ? primaryColor : (isDarkMode ? '#555' : '#CCC'),
                    backgroundColor: isChecked ? primaryColor : 'transparent'
                  }
                ]}>
                  {/* İKON DÜZELTMESİ: Mount/Unmount yerine Opacity kullanıyoruz. Gecikme ve kalıntı ortadan kalkar! */}
                  <View style={{ opacity: isChecked ? 1 : 0 }}>
                    <Iconify icon="hugeicons:tick-01" size={moderateScale(20)} color="#FFF" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Animasyonlu Hata Mesajı */}
        {error ? (
          <Animated.View style={[styles.errorContainer, { transform: [{ translateX: shakeAnimation }] }]}>
            <View style={styles.errorIconBg}>
              <Iconify icon="material-symbols:info-outline" size={moderateScale(20)} color="#FF3B30" />
            </View>
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        ) : null}

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    borderRadius: moderateScale(32),
    padding: scale(20),
    paddingBottom: verticalScale(32),
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(8),
  },
  closeButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: moderateScale(6),
    borderRadius: 99,
  },
  infoText: {
    fontSize: moderateScale(14),
    marginBottom: verticalScale(20),
    fontFamily: typography.primary?.regular || undefined,
  },
  scrollView: {
    maxHeight: verticalScale(420),
  },
  listContainer: {
    gap: verticalScale(12),
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    marginRight: scale(14),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  languageName: {
    fontSize: moderateScale(16),
  },
  radioCircle: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B3015',
    padding: moderateScale(12),
    borderRadius: moderateScale(12),
    marginTop: verticalScale(20),
  },
  errorIconBg: {
    marginRight: scale(8),
  },
  errorText: {
    color: '#FF3B30',
    fontSize: moderateScale(14),
    fontWeight: '600',
    flex: 1,
  }
});