import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';

export default function HowToCreateCardModal({ isVisible, onClose }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const steps = [
    {
      icon: 'uil:comment-alt-question',
      title: t('howToCreateCard.step1Title', 'Soru Ekle'),
      description: t('howToCreateCard.step1Desc', 'Kartınızın sorusunu yazın. Bu soru kartın ön yüzünde görünecektir. Örn: "Book" kelimesinin Türkçe karşılığı nedir?'),
      required: true,
    },
    {
      icon: 'uil:comment-alt-check',
      title: t('howToCreateCard.step2Title', 'Cevap Ekle'),
      description: t('howToCreateCard.step2Desc', 'Kartınızın cevabını yazın. Bu cevap kartın arka yüzünde görünecektir. Örn: "Kitap"'),
      required: true,
    },
    {
      icon: 'lucide:lightbulb',
      title: t('howToCreateCard.step3Title', 'Örnek Ekle (Opsiyonel)'),
      description: t('howToCreateCard.step3Desc', 'Kartınız için örnek bir cümle veya kullanım ekleyebilirsiniz. Bu alan boş bırakılabilir. Örn: "I am reading a book"'),
      required: false,
    },
    {
      icon: 'material-symbols-light:stylus-note',
      title: t('howToCreateCard.step4Title', 'Not Ekle (Opsiyonel)'),
      description: t('howToCreateCard.step4Desc', 'Kartınız için ek notlar veya açıklamalar ekleyebilirsiniz. Bu alan boş bırakılabilir. Örn: "Bu kelime bu şekilde okunur"'),
      required: false,
    },
    {
      icon: 'mage:image-fill',
      title: t('howToCreateCard.step5Title', 'Görsel Ekle (Opsiyonel)'),
      description: t('howToCreateCard.step5Desc', 'Kartınıza görsel ekleyebilirsiniz. Bu görsel kartın öğrenilmesini kolaylaştırabilir. Bu alan boş bırakılabilir.'),
      required: false,
    },
    {
      icon: 'hugeicons:file-add',
      title: t('howToCreateCard.step6Title', 'Kartı Oluştur'),
      description: t('howToCreateCard.step6Desc', 'Soru ve cevap alanlarını doldurduktan sonra "Kartı Oluştur" butonuna basın. Kart oluşturulduktan sonra destenize eklenir.'),
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
              {t('howToCreateCard.title', 'Kart Nasıl Oluşturulur?')}
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
                    {step.required && (
                      <View style={[styles.requiredBadge, { backgroundColor: colors.error + '20' }]}>
                        <Text style={[styles.requiredText, { color: colors.error }]}>
                          {t('howToCreateCard.required', 'Zorunlu')}
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

