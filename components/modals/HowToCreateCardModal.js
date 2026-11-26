import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { Text } from '../ui/AppText';
import { useTheme } from '../../theme/theme';
import { BottomSheetModal, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import BadgeText from '../tools/BadgeText';


export default function HowToCreateCardModal({ isVisible, onClose }) {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const { colors } = useTheme();
  const { t } = useTranslation();

  

  // Native sheet: SwiftUI sheet on iOS, Material ModalBottomSheet on Android.
  const sheetRef = useRef(null);
  const visibleRef = useRef(isVisible);
  visibleRef.current = isVisible;
  useEffect(() => {
    if (isVisible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [isVisible]);
  // Swipe/backdrop dismiss tells the parent; skipped when the parent closed it.
  const handleSheetDismiss = () => {
    if (visibleRef.current) onClose();
  };

  const steps = [
    {
      icon: 'uil:comment-alt-question',
      title: t('howToCreateCard.step1Title', 'Soru Ekle'),
      description: t('howToCreateCard.step1Desc', 'Kartınızın sorusunu yazın. Bu soru kartın ön yüzünde görünecektir. Örn: "Book" kelimesinin Türkçe karşılığı nedir?'),
      required: <BadgeText required={true} />,
    },
    {
      icon: 'uil:comment-alt-check',
      title: t('howToCreateCard.step2Title', 'Cevap Ekle'),
      description: t('howToCreateCard.step2Desc', 'Kartınızın cevabını yazın. Bu cevap kartın arka yüzünde görünecektir. Örn: "Kitap"'),
      required: <BadgeText required={true} />,
    },
    {
      icon: 'lucide:lightbulb',
      title: t('howToCreateCard.step3Title', 'Örnek Ekle'),
      description: t('howToCreateCard.step3Desc', 'Kartınız için örnek bir cümle veya kullanım ekleyebilirsiniz. Bu alan boş bırakılabilir. Örn: "I am reading a book"'),
      required: <BadgeText required={false} />,
    },
    {
      icon: 'material-symbols-light:stylus-note',
      title: t('howToCreateCard.step4Title', 'Not Ekle'),
      description: t('howToCreateCard.step4Desc', 'Kartınız için ek notlar veya açıklamalar ekleyebilirsiniz. Bu alan boş bırakılabilir. Örn: "Bu kelime bu şekilde okunur"'),
      required: <BadgeText required={false} />,
    },
    {
      icon: 'mage:image-fill',
      title: t('howToCreateCard.step5Title', 'Görsel Ekle'),
      description: t('howToCreateCard.step5Desc', 'Kartınıza görsel ekleyebilirsiniz. Bu görsel kartın öğrenilmesini kolaylaştırabilir. Bu alan boş bırakılabilir.'),
      required: <BadgeText required={false} />,  
    },
    {
      icon: 'hugeicons:file-add',
      title: t('howToCreateCard.step6Title', 'Kartı Oluştur'),
      description: t('howToCreateCard.step6Desc', 'Soru ve cevap alanlarını doldurduktan sonra "Kartı Oluştur" butonuna basın. Kart oluşturulduktan sonra destenize eklenir.')
    },
  ];

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={handleSheetDismiss}
      enablePanDownToClose
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
      snapPoints={FULL_SNAP_POINTS}
    >
      <BottomSheetView style={styles.sheetContent}>
          
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleContainer}>
              <Iconify icon="material-symbols:info-outline" size={24} color={colors.secondary} style={{ marginRight: 8 }} />
              <Text style={[typography.styles.title2, { color: colors.text }]}>
                {t('howToCreateCard.title', 'Kart Nasıl Oluşturulur?')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButtonIcon} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Scroll Edilebilir İçerik */}
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={true}
          >
            <Text style={[styles.introText, typography.styles.body, { color: colors.muted, marginBottom: 24 }]}>
              {t('howToCreateCard.intro', 'Aşağıdaki adımları takip ederek kolayca bir kart oluşturabilirsiniz. Her adımın ne işe yaradığını öğrenin:')}
            </Text>

            {steps.map((step, index) => (
              <View key={index} style={[styles.stepContainer, { backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground, borderColor: colors.cardBorder }]}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepIconContainer, { backgroundColor: colors.iconBackground }]}>
                    <Iconify icon={step.icon} size={24} color={colors.secondary} />
                  </View>
                  <View style={styles.stepTitleContainer}>
                    <View style={styles.stepTitleRow}>
                      <Text style={[styles.stepTitle, { fontSize: fontSizes.body }, { color: colors.text }]}>
                        {step.title}
                      </Text>
                      {step.required}
                    </View>
                  </View>
                </View>
                <Text style={[styles.stepDescription, typography.styles.body, { color: colors.muted }]}>
                  {step.description.replace(/Örn:/g, '\nÖrn:')}
                </Text>
              </View>
            ))}

            <View style={[styles.tipContainer, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
              <Iconify icon="lucide:lightbulb" size={20} color={colors.secondary} style={{ marginRight: 8 }} />
              <Text style={[styles.tipText, typography.styles.subhead, { color: colors.text, flex: 1 }]}>
                {t('howToCreateCard.tip', 'İpucu: Kart oluşturduktan sonra istediğiniz zaman düzenleyebilir veya silebilirsiniz.')}
              </Text>
            </View>
          </ScrollView>

          {/* Alt Buton */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.secondary }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={[styles.closeButtonText, { fontSize: fontSizes.body }, { color: '#fff' }]}>
              {t('common.ok', 'Tamam')}
            </Text>
          </TouchableOpacity>

      </BottomSheetView>
    </BottomSheetModal>
  );
}

// Step-by-step guide: full-height native sheet, content scrolls directly.
const FULL_SNAP_POINTS = ['100%'];

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  introText: {
    lineHeight: 22,
  },
  stepContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepTitle: {
    fontSize: fontSizes.body,
    fontFamily: fonts.semibold,
    flex: 1,
  },
  stepDescription: {
    lineHeight: 20,
    marginTop: 8,
    paddingLeft: 4,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  tipText: {
    lineHeight: 20,
  },
  closeButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  closeButtonIcon: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: 6,
    borderRadius: 99,
  },
  closeButtonText: {
    fontFamily: fonts.semibold,
    color: '#fff',
  },
});