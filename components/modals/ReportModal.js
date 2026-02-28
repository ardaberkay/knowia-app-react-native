import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { Iconify } from 'react-native-iconify';

export const REPORT_REASON_OPTIONS = {
  user: ['harassment', 'spam', 'hate_speech', 'inappropriate', 'impersonation', 'other'],
  deck: ['spam', 'inappropriate', 'hate_speech', 'copyright', 'misleading', 'other'],
  card: ['spam', 'inappropriate', 'hate_speech', 'copyright', 'misleading', 'other'],
};

export default function ReportModal({
  visible,
  onClose,
  reportType,
  alreadyReportedCodes = [],
  onSubmit,
}) {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const screenHeight = Dimensions.get('screen').height;
  const [selectedCode, setSelectedCode] = useState(null);
  const [loading, setLoading] = useState(false);

  // Marka ikincil rengi (Uyarı/Şikayet hissiyatı için)
  const secondaryColor = colors.secondary || '#FF3B30';

  const options = REPORT_REASON_OPTIONS[reportType] || REPORT_REASON_OPTIONS.deck;
  const alreadySet = new Set(alreadyReportedCodes || []);

  useEffect(() => {
    if (visible) setSelectedCode(null);
  }, [visible]);

  const handleSubmit = async () => {
    if (!selectedCode) return;
    setLoading(true);
    try {
      await onSubmit(selectedCode, undefined);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const titleKey = reportType === 'user' ? 'moderation.reportUser' : reportType === 'deck' ? 'moderation.reportDeck' : 'moderation.reportCard';
  const canSubmit = !!selectedCode;

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropTransitionOutTiming={150}
      animationInTiming={200}
      animationOutTiming={200}
      backdropTransitionInTiming={200}
      hardwareAccelerated={true}
      useNativeDriver
      useNativeDriverForBackdrop
      statusBarTranslucent
      deviceHeight={screenHeight}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>{t(titleKey)}</Text>
          <TouchableOpacity 
            onPress={onClose} 
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            style={styles.closeBtnWrapper}
          >
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.hintText, { color: colors.muted }]}>
          {t('moderation.reportReasonHint', 'Lütfen bir sebep seçin. Aynı sebeple tekrar şikayet edemezsiniz.')}
        </Text>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {options.map((code) => {
            const disabled = alreadySet.has(code);
            const isSelected = selectedCode === code;
            const labelKey = `moderation.reason.${code}`;

            return (
              <TouchableOpacity
                key={code}
                onPress={() => !disabled && setSelectedCode(code)}
                disabled={disabled}
                // Dalgalanmayı (Flicker) önlemek için activeOpacity 1 yapıldı
                activeOpacity={1}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isSelected ? (isDarkMode ? `${secondaryColor}20` : `${secondaryColor}15`) : (isDarkMode ? '#2A2A2A' : '#F5F5F5'),
                    borderColor: isSelected ? secondaryColor : 'transparent',
                  },
                  disabled && styles.optionDisabled
                ]}
              >
                <Text style={[
                  styles.optionText,
                  { 
                    color: disabled ? colors.muted : (isSelected ? secondaryColor : colors.text),
                    fontWeight: isSelected ? '700' : '500',
                    textDecorationLine: disabled ? 'line-through' : 'none' 
                  }
                ]}>
                  {t(labelKey, code)}
                </Text>

                {/* İçi Dolan Yuvarlak (Radio) veya Kilit İkonu */}
                {!disabled ? (
                  <View style={[
                    styles.radioOuter, 
                    { 
                      borderColor: isSelected ? secondaryColor : (isDarkMode ? '#555' : '#CCC'),
                    }
                  ]}>
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: secondaryColor }]} />}
                  </View>
                ) : (
                  <Iconify icon="fontisto:locked" size={moderateScale(16)} color={colors.muted} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? secondaryColor : (isDarkMode ? '#333' : '#E5E7EB') },
          ]}
          activeOpacity={0.8}
        > 
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.submitBtnText, { color: canSubmit ? '#fff' : colors.muted }]}>
              {t('moderation.submitReport', 'Gönder')}
            </Text>
          )}
        </TouchableOpacity>
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
    marginBottom: verticalScale(12),
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: moderateScale(6),
    borderRadius: 99,
  },
  hintText: {
    fontSize: moderateScale(14),
    marginBottom: verticalScale(20),
    fontFamily: typography.primary?.regular || undefined,
    lineHeight: verticalScale(20),
  },
  scrollView: {
    maxHeight: verticalScale(420),
  },
  scrollContent: {
    gap: verticalScale(12),
    paddingBottom: verticalScale(16),
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionText: {
    fontSize: moderateScale(16),
    flex: 1,
  },
  
  // Kusursuz Ortalama İçin Matematiksel Olarak Eşitlenmiş Değerler
  radioOuter: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    borderWidth: moderateScale(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: moderateScale(6),
  },
  
  submitBtn: {
    paddingVertical: verticalScale(16),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: verticalScale(54),
    marginTop: verticalScale(8),
  },
  submitBtnText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  }
});