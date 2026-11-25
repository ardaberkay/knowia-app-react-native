import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Modal, Pressable, useWindowDimensions } from 'react-native';
import { Text } from '../ui/AppText';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  runOnJS,
  Easing
} from 'react-native-reanimated';

import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import BadgeText from '../tools/BadgeText';


export default function HowToCreateCardModal({ isVisible, onClose }) {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const { colors } = useTheme();
  const { t } = useTranslation();

  // Animasyon bitmeden Modal'ı DOM'dan kaldırmamak için local state
  const [renderModal, setRenderModal] = useState(isVisible);
  
  // Reanimated Değerleri
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(SCREEN_HEIGHT); // Ekranın en altından başlar

  useEffect(() => {
    if (isVisible) {
      setRenderModal(true);
      // Arka planın kararması
      opacity.value = withTiming(1, { duration: 250 });
      // Modalın alttan merkeze kayması (sallanma yok, pürüzsüz geliş)
      translateY.value = withTiming(0, { 
        duration: 350, 
        easing: Easing.out(Easing.exp) // Hızlı başlayıp yumuşak yavaşlar
      });
    } else {
      // Kapanırken arka planın aydınlanması
      opacity.value = withTiming(0, { duration: 150 });
      // Modalın tekrar aşağı kayması ve bitince DOM'dan silinmesi
      translateY.value = withTiming(SCREEN_HEIGHT, { 
        duration: 150,
        easing: Easing.in(Easing.ease)
      }, (isFinished) => {
        if (isFinished) {
          runOnJS(setRenderModal)(false);
        }
      });
    }
  }, [isVisible]);

  // Animasyon Stilleri
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

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
          
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleContainer}>
              <Iconify icon="material-symbols:info-outline" size={24} color={colors.secondary} style={{ marginRight: 8 }} />
              <Text style={[typography.styles.h2, { color: colors.text }]}>
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
                      <Text style={[styles.stepTitle, typography.styles.h3, { color: colors.text }]}>
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
              <Text style={[styles.tipText, typography.styles.caption, { color: colors.text, flex: 1 }]}>
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
            <Text style={[styles.closeButtonText, typography.styles.body, { color: '#fff' }]}>
              {t('common.ok', 'Tamam')}
            </Text>
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
    borderRadius: 24,
    padding: 20,
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
    marginBottom: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scrollView: {
    maxHeight: 450,
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
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: '600',
    color: '#fff',
  },
});