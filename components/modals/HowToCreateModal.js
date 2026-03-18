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
import { triggerHaptic } from '../../lib/hapticManager';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function HowToCreateModal({ isVisible, onClose }) {
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
      icon: 'ion:book',
      title: t('howToCreate.step1Title', 'Deste Adı Ekle'),
      description: t('howToCreate.step1Desc', 'Destenize bir isim verin. Bu isim destenizi tanımlar ve arama sonuçlarında görünür. Örn: "İngilizce Kelimeler", "Tarih Notları"'),
      required: <BadgeText required={true} />,
    },
    {
      icon: 'icon-park-outline:translation',
      title: t('howToCreate.step2Title', 'Karşılığı Ekle (Opsiyonel)'),
      description: t('howToCreate.step2Desc', 'Eğer desteniz çeviri veya eşleştirme içeriyorsa, karşılık alanını doldurabilirsiniz. Bu alan boş bırakılabilir. Örn: "English Words" için karşılık "Türkçe Kelimeler" olabilir.'),
      required: <BadgeText required={false} />,
    },
    {
      icon: 'tabler:file-description-filled',
      title: t('howToCreate.step3Title', 'Açıklama Ekle (Opsiyonel)'),
      description: t('howToCreate.step3Desc', 'Destenizin amacını, içeriğini veya kullanım şeklini açıklayabilirsiniz. Bu bilgi diğer kullanıcılar için faydalı olabilir.'),
      required: <BadgeText required={false} />,
    },
    {
      icon: 'mdi:category-plus-outline',
      title: t('howToCreate.step4Title', 'Kategori Seç'),
      description: t('howToCreate.step4Desc', 'Destenizin hangi konuya ait olduğunu belirlemek için bir kategori seçin. Bu, destenizin keşfedilmesini ve organize edilmesini kolaylaştırır.'),
      required: <BadgeText required={true} />,
    },
    {
      icon: 'mdi:spoken-language',
      title: t('howToCreate.step6Title', 'İçerik Dili Seç'),
      description: t('howToCreate.step6Desc', 'Destenizin içerik dilini en fazla 2 dil olacak şekilde seçin. Bu, destenizin diğer kullanıcılar tarafından keşfedilmesini ve organize edilmesini kolaylaştırır.'),
      required: <BadgeText required={true} />,
    },
    {
      icon: 'fluent:tab-add-24-regular',
      title: t('howToCreate.step5Title', 'Oluştur Butonuna Bas'),
      description: t('howToCreate.step5Desc', 'Tüm bilgileri doldurduktan sonra "Oluştur" butonuna basın. Deste oluşturulduktan sonra kart eklemeye başlayabilirsiniz.'),
    }
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
                {t('howToCreate.title', 'Nasıl Oluşturulur?')}
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
              {t('howToCreate.intro', 'Aşağıdaki adımları takip ederek kolayca bir deste oluşturabilirsiniz. Her adımın ne işe yaradığını öğrenin:')}
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
                {t('howToCreate.tip', 'İpucu: Deste oluşturduktan sonra istediğiniz zaman düzenleyebilir veya kart ekleyebilirsiniz.')}
              </Text>
            </View>
          </ScrollView>

          {/* Alt Buton */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.secondary }]}
            onPress={() => {
              triggerHaptic('light');
              onClose();
            }}
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
    borderRadius: moderateScale(32),
    padding: scale(20), // 24'ten 20'ye hafif çekildi, ekranda daha rahat durması için
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
    marginTop: verticalScale(4),
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