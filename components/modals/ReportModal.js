import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { Iconify } from 'react-native-iconify';

/** Store uyumlu şikayet sebep kodları - reportType'a göre listelenir */
export const REPORT_REASON_OPTIONS = {
  user: ['harassment', 'spam', 'hate_speech', 'inappropriate', 'impersonation', 'other'],
  deck: ['spam', 'inappropriate', 'hate_speech', 'copyright', 'misleading', 'other'],
  card: ['spam', 'inappropriate', 'hate_speech', 'copyright', 'misleading', 'other'],
};

/**
 * Özelleştirilebilir şikayet modalı. Kullanıcı / deste / kart şikayeti için kullanılır.
 * @param {boolean} visible
 * @param {() => void} onClose
 * @param {'user'|'deck'|'card'} reportType
 * @param {string[]} alreadyReportedCodes - Bu hedef için daha önce kullanılan reason_code listesi (aynı madde tekrar seçilemez)
 * @param {(reasonCode: string, reasonText?: string) => Promise<void>} onSubmit
 */
export default function ReportModal({
  visible,
  onClose,
  reportType,
  alreadyReportedCodes = [],
  onSubmit,
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [selectedCode, setSelectedCode] = useState(null);
  const [loading, setLoading] = useState(false);

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
      useNativeDriver
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      backdropTransitionOutTiming={0}
      statusBarTranslucent
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>{t(titleKey)}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}>
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={[typography.styles.body, { color: colors.subtext, marginBottom: verticalScale(12) }]}>
          {t('moderation.reportReasonHint', 'Lütfen bir sebep seçin. Aynı sebeple tekrar şikayet edemezsiniz.')}
        </Text>

        <ScrollView
          style={styles.scrollContent}
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
                style={[
                  styles.option,
                  { borderColor: colors.border, backgroundColor: isSelected ? colors.iconBackground || colors.buttonColor + '18' : 'transparent' },
                  disabled && styles.optionDisabled,
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, { borderColor: disabled ? colors.border : colors.buttonColor }]}>
                  {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.buttonColor }]} />}
                </View>
                <Text style={[typography.styles.body, { color: disabled ? colors.subtext : colors.text }]}>
                  {t(labelKey, code)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? colors.buttonColor : colors.border },
          ]}
          activeOpacity={0.8}
        > 
            <Text style={[typography.styles.button, { color: '#fff' }]}>{t('moderation.submitReport', 'Gönder')}</Text>
          
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    borderRadius: moderateScale(32),
    padding: scale(24),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(16),
  },
  scrollContent: {
    maxHeight: verticalScale(400),
    height: verticalScale(400),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(6),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    marginBottom: verticalScale(8),
  },
  optionDisabled: {
    opacity: 0.7,
  },
  radioOuter: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(10),
    borderWidth: 2,
    marginRight: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
  },
  submitBtn: {
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: verticalScale(48),
  },
});
