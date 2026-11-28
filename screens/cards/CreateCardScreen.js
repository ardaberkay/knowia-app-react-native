import React, { useEffect, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import HowToCreateCardModal from '../../components/modals/HowToCreateCardModal';
import CsvUploadModal from '../../components/modals/CsvUploadModal';
import { FormHeader } from '../../components/layout/FormField';
import { CardForm } from '../../components/layout/EditCardForm';

/** "Kart Ekle" page (route AddCard): the shared card form under the intro (title in the app bar). */
export default function AddCardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { deck } = route.params;
  const { t } = useTranslation();
  const [csvModalVisible, setCsvModalVisible] = useState(false);
  const [howToVisible, setHowToVisible] = useState(false);

  useEffect(() => {
    if (route.params?.openCsvModal) {
      setCsvModalVisible(true);
      navigation.setParams({ openCsvModal: false });
    }
  }, [route.params?.openCsvModal]);

  return (
    <>
      <CsvUploadModal
        isVisible={csvModalVisible}
        onClose={() => setCsvModalVisible(false)}
        onImported={() => {
          // let the sheet slide away, then back to the deck (or open it)
          setTimeout(() => navigation.popTo('DeckDetail', { deck }, { merge: true }), 300);
        }}
        deck={deck}
      />
      <CardForm
        mode="create"
        deck={deck}
        header={(
          <FormHeader
            text={t('addCard.motivationText', 'Bilgini pekiştirmek için soru-cevap kartları oluştur ve öğrenme sürecini hızlandır.')}
            image={require('../../assets/images/create_card_item.webp')}
            onHowTo={() => setHowToVisible(true)}
          />
        )}
      />
      <HowToCreateCardModal isVisible={howToVisible} onClose={() => setHowToVisible(false)} />
    </>
  );
}
