import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import BadgeText from './BadgeText';

export default function HowToCreateCardModal({ isVisible, onClose }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const screenHeight = Dimensions.get('screen').height;

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
      statusBarTranslucent={true}
      deviceHeight={screenHeight}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleContainer}>
            <Iconify icon="material-symbols:info-outline" size={moderateScale(24)} color={colors.secondary} style={{ marginRight: scale(8) }} />
            <Text style={[typography.styles.h2, { color: colors.text }]}>
              {t('howToCreateCard.title', 'Kart Nasıl Oluşturulur?')}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}>
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
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
              <Text style={[styles.stepDescription, typography.styles.body, { color: colors.muted, marginTop: verticalScale(8) }]}>
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

        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: colors.secondary }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={[styles.closeButtonText, typography.styles.body, { color: '#fff' }]}>
            {t('common.ok', 'Tamam')}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    borderRadius: moderateScale(24),
    padding: scale(24),
    maxHeight: '85%',
    minHeight: verticalScale(300),
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(20),
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
  requiredBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(6),
  },
  requiredText: {
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
  stepDescription: {
    lineHeight: moderateScale(20),
    marginTop: verticalScale(8),
    paddingLeft: scale(16),
    textAlign: 'left',
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
    marginTop: verticalScale(20),
  },
  closeButtonText: {
    fontWeight: '600',
    color: '#fff',
  },
});

