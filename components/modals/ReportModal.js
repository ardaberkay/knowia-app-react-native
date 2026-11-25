import React, { useRef, useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../ui/AppText';
import { useTheme } from '../../theme/theme';
import { BottomSheetModal, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
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
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const SHEET_MAX_HEIGHT = Math.round(SCREEN_HEIGHT * 0.85);
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  
  const [selectedCode, setSelectedCode] = useState(null);
  const [loading, setLoading] = useState(false);

  

  // Marka ikincil rengi (Uyarı/Şikayet hissiyatı için)
  const secondaryColor = colors.secondary || '#FF3B30';

  const options = REPORT_REASON_OPTIONS[reportType] || REPORT_REASON_OPTIONS.deck;
  const alreadySet = new Set(alreadyReportedCodes || []);

  // Native sheet: SwiftUI sheet on iOS, Material ModalBottomSheet on Android.
  const sheetRef = useRef(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    if (visible) {
      setSelectedCode(null);
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);
  // Swipe/backdrop dismiss tells the parent; skipped when the parent closed it.
  const handleSheetDismiss = () => {
    if (visibleRef.current) onClose();
  };

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
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={handleSheetDismiss}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.background }}
    >
      <BottomSheetView style={[styles.sheetContent, { maxHeight: SHEET_MAX_HEIGHT }]}>
          
          {/* Header Row */}
          <View style={styles.headerRow}>
            <Text style={[typography.styles.h2, { color: colors.text }]}>{t(titleKey)}</Text>
            <TouchableOpacity 
              onClose={onClose} // HitSlop sorunu olmaması için onPress yerine propu doğrudan kullan
              onPress={onClose}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              style={styles.closeBtnWrapper}
            >
              <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.hintText, { color: colors.muted }]}>
            {t('moderation.reportReasonHint', 'Lütfen bir sebep seçin. Aynı sebeple tekrar şikayet edemezsiniz.')}
          </Text>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
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
                    <Iconify icon="fontisto:locked" size={16} color={colors.muted} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Submit Butonu */}
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

      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: 6,
    borderRadius: 99,
  },
  hintText: {
    fontSize: 14,
    marginBottom: 20,
    fontFamily: typography.primary?.regular || undefined,
    lineHeight: 20,
  },
  scrollView: {
    flexShrink: 1,
    maxHeight: 420,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionText: {
    fontSize: 16,
    flex: 1,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    marginTop: 12,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
  }
});