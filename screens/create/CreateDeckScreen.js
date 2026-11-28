import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { createDeck } from '../../services/DeckService';
import { useAuth } from '../../contexts/AuthContext';
import HowToCreateModal from '../../components/modals/HowToCreateModal';
import { FormHeader } from '../../components/layout/FormField';
import { DeckForm, EMPTY_DECK_VALUES } from '../decks/EditDeckScreen';

/** "Deste Oluştur" page: the shared deck form under the intro (title in the app bar). */
export default function CreateScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [howToVisible, setHowToVisible] = useState(false);

  return (
    <>
      <DeckForm
        mode="create"
        initialValues={EMPTY_DECK_VALUES}
        header={(
          <FormHeader
            text={t('createDeck.motivationText', 'Kişiselleştirilmiş destelerle öğrenme yolculuğunu tasarla ve bilgini pekiştir.')}
            image={require('../../assets/images/create_deck_item.webp')}
            onHowTo={() => setHowToVisible(true)}
          />
        )}
        onSubmit={async (payload, { leave }) => {
          const data = await createDeck(userId, payload);
          // replace: "back" from the new deck returns to Library, not to an empty form
          leave(() => navigation.replace('DeckDetail', { deck: data }));
        }}
      />
      <HowToCreateModal isVisible={howToVisible} onClose={() => setHowToVisible(false)} />
    </>
  );
}
