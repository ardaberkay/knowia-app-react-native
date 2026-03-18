import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Modal,
  Pressable,
  Dimensions
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
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import BadgeText from '../tools/BadgeText';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function HowToCreateCardModal({ isVisible, onClose }) {
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
              <Iconify icon="material-symbols:info-outline" size={moderateScale(24)} color={colors.secondary} style={{ marginRight: scale(8) }} />
              <Text style={[typography.styles.h2, { color: colors.text }]}>
                {t('howToCreateCard.title', 'Kart Nasıl Oluşturulur?')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButtonIcon} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Scroll Edilebilir İçerik */}
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={true}
          >
            <Text style={[styles.introText, typography.styles.body, { color: colors.muted, marginBottom: verticalScale(24) }]}>
              {t('howToCreateCard.intro', 'Aşağıdaki adımları takip ederek kolayca bir kart oluşturabilirsiniz. Her adımın ne işe yaradığını öğrenin:')}
            </Text>

            {steps.map((step, index) => (
              <View key={index} style={[styles.stepContainer, { backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground, borderColor: colors.cardBorder }]}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepIconContainer, { backgroundColor: colors.iconBackground }]}>
                    <Iconify icon={step.icon} size={moderateScale(24)} color={colors.secondary} />
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
              <Iconify icon="lucide:lightbulb" size={moderateScale(20)} color={colors.secondary} style={{ marginRight: scale(8) }} />
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
    borderRadius: moderateScale(24),
    padding: scale(20),
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(16),
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scrollView: {
    maxHeight: verticalScale(450),
  },
  scrollContent: {
    paddingBottom: verticalScale(16),
  },
  introText: {
    lineHeight: moderateScale(22),
  },
  stepContainer: {
    borderRadius: moderateScale(16),
    padding: scale(16),
    marginBottom: verticalScale(16),
    borderWidth: moderateScale(1),
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  stepIconContainer: {
    width: scale(48),
    height: verticalScale(48),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  stepTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  stepTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    flex: 1,
  },
  stepDescription: {
    lineHeight: moderateScale(20),
    marginTop: verticalScale(8),
    paddingLeft: scale(4),
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: scale(16),
    borderRadius: moderateScale(12),
    borderWidth: moderateScale(1),
    marginTop: verticalScale(8),
  },
  tipText: {
    lineHeight: moderateScale(20),
  },
  closeButton: {
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(16),
  },
  closeButtonIcon: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: moderateScale(6),
    borderRadius: 99,
  },
  closeButtonText: {
    fontWeight: '600',
    color: '#fff',
  },
});