import React from 'react';
import { useTranslation } from 'react-i18next';
import HowToGuideSheet from './HowToGuideSheet';
import { ICONS } from '../../theme/icons';

// "İpucu: …" → "…" (the tip box has its own icon)
const stripTipPrefix = (text) => String(text || '').replace(/^[^\s:]{2,12}:\s*/, '');

/** How to create a card: the card form's guide. */
export default function HowToCreateCardModal({ isVisible, onClose }) {
  const { t } = useTranslation();

  const steps = [
    {
      icon: ICONS.question,
      title: t('howToCreateCard.step1Title', 'Soru Ekle'),
      description: t('howToCreateCard.step1Desc', 'Kartınızın sorusunu yazın. Bu soru kartın ön yüzünde görünecektir. Örn: "Book" kelimesinin Türkçe karşılığı nedir?'),
      required: true,
    },
    {
      icon: ICONS.answer,
      title: t('howToCreateCard.step2Title', 'Cevap Ekle'),
      description: t('howToCreateCard.step2Desc', 'Kartınızın cevabını yazın. Bu cevap kartın arka yüzünde görünecektir. Örn: "Kitap"'),
      required: true,
    },
    {
      icon: ICONS.hint,
      title: t('howToCreateCard.step3Title', 'Örnek Ekle'),
      description: t('howToCreateCard.step3Desc', 'Kartınız için örnek bir cümle veya kullanım ekleyebilirsiniz. Bu alan boş bırakılabilir. Örn: "I am reading a book"'),
      required: false,
    },
    {
      icon: ICONS.note,
      title: t('howToCreateCard.step4Title', 'Not Ekle'),
      description: t('howToCreateCard.step4Desc', 'Kartınız için ek notlar veya açıklamalar ekleyebilirsiniz. Bu alan boş bırakılabilir. Örn: "Bu kelime bu şekilde okunur"'),
      required: false,
    },
    {
      icon: ICONS.image,
      title: t('howToCreateCard.step5Title', 'Görsel Ekle'),
      description: t('howToCreateCard.step5Desc', 'Kartınıza görsel ekleyebilirsiniz. Bu görsel kartın öğrenilmesini kolaylaştırabilir. Bu alan boş bırakılabilir.'),
      required: false,
    },
    {
      icon: ICONS.createCard,
      title: t('howToCreateCard.step6Title', 'Kartı Oluştur'),
      description: t('howToCreateCard.step6Desc', 'Soru ve cevap alanlarını doldurduktan sonra "Kartı Oluştur" butonuna basın. Kart oluşturulduktan sonra destenize eklenir.'),
    },
  ];

  return (
    <HowToGuideSheet
      isVisible={isVisible}
      onClose={onClose}
      title={t('howToCreateCard.title', 'Kart Nasıl Oluşturulur?')}
      intro={t('howToCreateCard.intro', 'Aşağıdaki adımları takip ederek kolayca bir kart oluşturabilirsiniz. Her adımın ne işe yaradığını öğrenin:')}
      steps={steps}
      tip={stripTipPrefix(t('howToCreateCard.tip', 'İpucu: Kart oluşturduktan sonra istediğiniz zaman düzenleyebilir veya silebilirsiniz.'))}
    />
  );
}
