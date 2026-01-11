import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function HowToCreateModal({ isVisible, onClose }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const steps = [
    {
      icon: 'ion:book',
      title: t('howToCreate.step1Title', 'Deste Adı Ekle'),
      description: t('howToCreate.step1Desc', 'Destenize bir isim verin. Bu isim destenizi tanımlar ve arama sonuçlarında görünür. Örn: "İngilizce Kelimeler", "Tarih Notları"'),
      required: true,
    },
    {
      icon: 'icon-park-outline:translation',
      title: t('howToCreate.step2Title', 'Karşılığı Ekle (Opsiyonel)'),
      description: t('howToCreate.step2Desc', 'Eğer desteniz çeviri veya eşleştirme içeriyorsa, karşılık alanını doldurabilirsiniz. Bu alan boş bırakılabilir. Örn: "English Words" için karşılık "Türkçe Kelimeler" olabilir.'),
      required: false,
    },
    {
      icon: 'tabler:file-description-filled',
      title: t('howToCreate.step3Title', 'Açıklama Ekle (Opsiyonel)'),
      description: t('howToCreate.step3Desc', 'Destenizin amacını, içeriğini veya kullanım şeklini açıklayabilirsiniz. Bu bilgi diğer kullanıcılar için faydalı olabilir.'),
      required: false,
    },
    {
      icon: 'mdi:category-plus-outline',
      title: t('howToCreate.step4Title', 'Kategori Seç'),
      description: t('howToCreate.step4Desc', 'Destenizin hangi konuya ait olduğunu belirlemek için bir kategori seçin. Bu, destenizin keşfedilmesini ve organize edilmesini kolaylaştırır.'),
      required: true,
    },
    {
      icon: 'fluent:tab-add-24-regular',
      title: t('howToCreate.step5Title', 'Oluştur Butonuna Bas'),
      description: t('howToCreate.step5Desc', 'Tüm bilgileri doldurduktan sonra "Oluştur" butonuna basın. Deste oluşturulduktan sonra kart eklemeye başlayabilirsiniz.'),
      required: false,
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
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleContainer}>
            <Iconify icon="material-symbols:info-outline" size={moderateScale(24)} color={colors.secondary} style={{ marginRight: scale(8) }} />
            <Text style={[typography.styles.h2, { color: colors.text }]}>
              {t('howToCreate.title', 'Deste Nasıl Oluşturulur?')}
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
                    {step.required && (
                      <View style={[styles.requiredBadge, { backgroundColor: colors.error + '20' }]}>
                        <Text style={[styles.requiredText, { color: colors.error }]}>
                          {t('howToCreate.required', 'Zorunlu')}
                        </Text>
                      </View>
                    )}
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
              {t('howToCreate.tip', 'İpucu: Deste oluşturduktan sonra istediğiniz zaman düzenleyebilir veya kart ekleyebilirsiniz.')}
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
    width: '95%',
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

