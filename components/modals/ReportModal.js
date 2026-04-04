import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  StyleSheet, 
  Dimensions,
  Modal,
  Pressable
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  runOnJS,
  Easing
} from 'react-native-reanimated';

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

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function ReportModal({
  visible,
  onClose,
  reportType,
  alreadyReportedCodes = [],
  onSubmit,
}) {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  
  const [selectedCode, setSelectedCode] = useState(null);
  const [loading, setLoading] = useState(false);

  // Animasyon bitmeden Modal'ı DOM'dan kaldırmamak için local state
  const [renderModal, setRenderModal] = useState(visible);
  
  // Reanimated Değerleri
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(SCREEN_HEIGHT);

  // Marka ikincil rengi (Uyarı/Şikayet hissiyatı için)
  const secondaryColor = colors.secondary || '#FF3B30';

  const options = REPORT_REASON_OPTIONS[reportType] || REPORT_REASON_OPTIONS.deck;
  const alreadySet = new Set(alreadyReportedCodes || []);

  useEffect(() => {
    if (visible) {
      setSelectedCode(null);
      setRenderModal(true);
      // Açılış Animasyonu (Yumuşak geliş)
      opacity.value = withTiming(1, { duration: 250 });
      translateY.value = withTiming(0, { 
        duration: 350, 
        easing: Easing.out(Easing.exp) 
      });
    } else {
      // Kapanış Animasyonu (Hızlı ve keskin)
      opacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(SCREEN_HEIGHT, { 
        duration: 150,
        easing: Easing.in(Easing.quad) 
      }, (isFinished) => {
        if (isFinished) {
          runOnJS(setRenderModal)(false);
        }
      });
    }
  }, [visible]);

  // Animasyon Stilleri
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

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

  if (!renderModal) return null;

  return (
    <Modal
      transparent={true}
      visible={renderModal}
      animationType="none" 
      onRequestClose={onClose} 
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        
        {/* Kararan Arka Plan */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[styles.backdrop, backdropStyle, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]} />
        </Pressable>

        {/* Modal Kutusu */}
        <Animated.View style={[styles.modalContainer, { backgroundColor: colors.background }, modalAnimatedStyle]}>
          
          {/* Header Row */}
          <View style={styles.headerRow}>
            <Text style={[typography.styles.h2, { color: colors.text }]}>{t(titleKey)}</Text>
            <TouchableOpacity 
              onClose={onClose} // HitSlop sorunu olmaması için onPress yerine propu doğrudan kullan
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
                    <Iconify icon="fontisto:locked" size={moderateScale(16)} color={colors.muted} />
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

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center', 
    alignItems: 'center',     
  },
  backdrop: {
    flex: 1,
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: '90%', 
    maxHeight: '85%',
    borderRadius: moderateScale(32),
    padding: scale(20),
    paddingBottom: verticalScale(24), // Butonun altından biraz boşluk
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.2)',
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
    marginTop: verticalScale(12),
  },
  submitBtnText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  }
});