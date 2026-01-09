import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';

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
            <Iconify icon="material-symbols:info-outline" size={24} color={colors.secondary} style={{ marginRight: 8 }} />
            <Text style={[typography.styles.h2, { color: colors.text }]}>
              {t('howToCreate.title', 'Deste Nasıl Oluşturulur?')}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={[styles.introText, typography.styles.body, { color: colors.muted, marginBottom: 24 }]}>
            {t('howToCreate.intro', 'Aşağıdaki adımları takip ederek kolayca bir deste oluşturabilirsiniz. Her adımın ne işe yaradığını öğrenin:')}
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
              <Text style={[styles.stepDescription, typography.styles.body, { color: colors.muted, marginTop: 8 }]}>
                {step.description.replace(/Örn:/g, '\nÖrn:')}
              </Text>
            </View>
          ))}

          <View style={[styles.tipContainer, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
            <Iconify icon="lucide:lightbulb" size={20} color={colors.secondary} style={{ marginRight: 8 }} />
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
    borderRadius: 24,
    padding: 24,
    maxHeight: '85%',
    minHeight: 300,
    width: '95%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
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
  requiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  requiredText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stepDescription: {
    lineHeight: 20,
    marginTop: 8,
    paddingLeft: 16,
    textAlign: 'left',
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
    marginTop: 20,
  },
  closeButtonText: {
    fontWeight: '600',
    color: '#fff',
  },
});

