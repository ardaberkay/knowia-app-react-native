import React from 'react';
import { useTranslation } from 'react-i18next';
import HowToGuideSheet from './HowToGuideSheet';
import { ICONS } from '../../theme/icons';

// "İpucu: …" → "…" (the tip box has its own icon)
const stripTipPrefix = (text) => String(text || '').replace(/^[^\s:]{2,12}:\s*/, '');

/** How to create a deck: the deck form's guide. */
export default function HowToCreateModal({ isVisible, onClose }) {
  const { t } = useTranslation();

  const steps = [
    {
      icon: ICONS.deckName,
      title: t('howToCreate.step1Title', 'Deste Adı Ekle'),
      description: t('howToCreate.step1Desc', 'Destenize bir isim verin. Bu isim destenizi tanımlar ve arama sonuçlarında görünür. Örn: "İngilizce Kelimeler", "Tarih Notları"'),
      required: true,
    },
    {
      icon: ICONS.pair,
      title: t('howToCreate.step2Title', 'Karşılığı Ekle (Opsiyonel)').replace(/\s*\([^)]*\)\s*$/, ''),
      description: t('howToCreate.step2Desc', 'Eğer desteniz çeviri veya eşleştirme içeriyorsa, karşılık alanını doldurabilirsiniz. Bu alan boş bırakılabilir. Örn: "English Words" için karşılık "Türkçe Kelimeler" olabilir.'),
      required: false,
    },
    {
      icon: ICONS.description,
      title: t('howToCreate.step3Title', 'Açıklama Ekle (Opsiyonel)').replace(/\s*\([^)]*\)\s*$/, ''),
      description: t('howToCreate.step3Desc', 'Destenizin amacını, içeriğini veya kullanım şeklini açıklayabilirsiniz. Bu bilgi diğer kullanıcılar için faydalı olabilir.'),
      required: false,
    },
    {
      icon: ICONS.category,
      title: t('howToCreate.step4Title', 'Kategori Seç'),
      description: t('howToCreate.step4Desc', 'Destenizin hangi konuya ait olduğunu belirlemek için bir kategori seçin. Bu, destenizin keşfedilmesini ve organize edilmesini kolaylaştırır.'),
      required: true,
    },
    {
      icon: ICONS.language,
      title: t('howToCreate.step6Title', 'İçerik Dili Seç'),
      description: t('howToCreate.step6Desc', 'Destenizin içerik dilini en fazla 2 dil olacak şekilde seçin. Bu, destenizin diğer kullanıcılar tarafından keşfedilmesini ve organize edilmesini kolaylaştırır.'),
      required: true,
    },
    {
      icon: ICONS.deck,
      title: t('howToCreate.step5Title', 'Oluştur Butonuna Bas'),
      description: t('howToCreate.step5Desc', 'Tüm bilgileri doldurduktan sonra "Oluştur" butonuna basın. Deste oluşturulduktan sonra kart eklemeye başlayabilirsiniz.'),
    },
  ];

  return (
    <HowToGuideSheet
      isVisible={isVisible}
      onClose={onClose}
      title={t('howToCreate.title', 'Nasıl Oluşturulur?')}
      intro={t('howToCreate.intro', 'Aşağıdaki adımları takip ederek kolayca bir deste oluşturabilirsiniz. Her adımın ne işe yaradığını öğrenin:')}
      steps={steps}
      tip={stripTipPrefix(t('howToCreate.tip', 'İpucu: Deste oluşturduktan sonra istediğiniz zaman düzenleyebilir veya kart ekleyebilirsiniz.'))}
    />
  );
}
