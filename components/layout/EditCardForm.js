import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image } from '../ui/AppImage';
import { Text } from '../ui/AppText';
import FormScrollView from './FormScrollView';
import {
  useForm, useUnsavedChangesGuard, confirmDiscard, useFieldBox, FORM_SIDE_PADDING,
  FormActions, FormCard, FormField, FormLabel, OptionalSection,
} from './FormField';
import { createCard, updateCard } from '../../services/CardService';
import { uploadCardImage, removeUnusedCardImages, pickResizedImage, readFileBuffer } from '../../services/StorageService';
import { fontSizes, fonts } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbarHelpers } from '../ui/Snackbar';
import { triggerHaptic } from '../../lib/hapticManager';
import { CARD_LIMITS } from '../../lib/limits';
import PhosphorIcon from '../ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

const ACCENT = '#F98A21';
const EMPTY_CARD_VALUES = { question: '', answer: '', example: '', note: '', image: '' };
const isLocalFile = (uri) => Boolean(uri) && !/^https?:\/\//i.test(uri);

/**
 * Card form, shared by "Kart Oluştur" (AddCard) and "Kartı Düzenle" (EditCard).
 * One card: question + answer, then example / note / image behind "add more".
 *
 * mode: 'create' | 'edit'
 * card: the card being edited (edit mode)
 * header: element above the card (create page header)
 * onSaved(card): after a save. Create mode clears the form and stays;
 *   edit mode calls it with the guard off (the page then closes).
 */
export function CardForm({ mode, card = null, deck, header = null, onSaved }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { showSuccess, showError } = useSnackbarHelpers();

  const startValues = card
    ? { question: card.question || '', answer: card.answer || '', example: card.example || '', note: card.note || '', image: card.image || '' }
    : EMPTY_CARD_VALUES;
  const { values, setValue, errors, setErrors, reset, isDirty } = useForm(startValues);
  const leave = useUnsavedChangesGuard(isDirty);
  const questionRef = useRef(null);
  const answerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const hasOptional = (v) => Boolean(v.example || v.note || v.image);
  const [moreOpen, setMoreOpen] = useState(hasOptional(startValues));

  const box = useFieldBox();
  const optionalFilled = [values.example?.trim(), values.note?.trim(), values.image].filter(Boolean).length;

  const handlePickImage = async () => {
    try {
      const uri = await pickResizedImage();
      if (uri) setValue('image', uri);
    } catch {
      showError(t('common.imageNotSelected', 'Fotoğraf seçilemedi.'));
    }
  };

  const handleUndo = () => {
    Keyboard.dismiss();
    confirmDiscard(t, isDirty, () => {
      reset();
      setMoreOpen(hasOptional(startValues));
    });
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    const next = {};
    if (!values.question.trim()) next.question = t('addCard.questionRequired', 'Soru zorunludur.');
    if (!values.answer.trim()) next.answer = t('addCard.answerRequired', 'Cevap zorunludur.');
    if (Object.keys(next).length) {
      setErrors(next);
      triggerHaptic('error');
      (next.question ? questionRef : answerRef).current?.focus();
      return;
    }

    setLoading(true);
    let uploadedUrl = null;
    try {
      // a newly picked photo is a local file: upload it; '' = removed
      let imageUrl = values.image || null;
      if (isLocalFile(values.image)) {
        uploadedUrl = await uploadCardImage(deck.id, userId, await readFileBuffer(values.image));
        imageUrl = uploadedUrl;
      }
      const payload = {
        question: values.question.trim(),
        answer: values.answer.trim(),
        example: values.example.trim() || null,
        note: values.note.trim() || null,
        image: imageUrl,
      };
      if (mode === 'edit') {
        const updated = await updateCard(card.id, payload);
        leave(() => onSaved?.(updated));
      } else {
        const created = await createCard(deck.id, payload);
        showSuccess(t('common.addCardSuccess', 'Kart eklendi!'));
        reset(EMPTY_CARD_VALUES);
        setMoreOpen(false);
        onSaved?.(created);
      }
    } catch (e) {
      // not saved: the newly uploaded photo must not stay in storage
      if (uploadedUrl) removeUnusedCardImages([uploadedUrl]);
      showError(e?.message || (mode === 'edit'
        ? t('common.cardNotSaved', 'Kart güncellenemedi.')
        : t('common.addCardError', 'Kart eklenemedi.')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FormScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {header}

        <FormCard>
          <View style={styles.fields}>
            <FormField
              ref={questionRef}
              icon={ICONS.question}
              label={t('addCard.question', 'Soru')}
              value={values.question}
              onChangeText={(v) => setValue('question', v)}
              maxLength={CARD_LIMITS.question}
              multiline
              placeholder={t('addCard.questionPlaceholder', 'Kartın sorusu')}
              error={errors.question}
            />
            <FormField
              ref={answerRef}
              icon={ICONS.answer}
              label={t('addCard.answer', 'Cevap')}
              value={values.answer}
              onChangeText={(v) => setValue('answer', v)}
              maxLength={CARD_LIMITS.answer}
              multiline
              placeholder={t('addCard.answerPlaceholder', 'Kartın cevabı')}
              error={errors.answer}
            />
          </View>

          <OptionalSection
            title={t('addCard.moreDetails', 'Örnek, not ve görsel ekle')}
            expanded={moreOpen}
            onToggle={() => setMoreOpen((v) => !v)}
            filledCount={optionalFilled}
          >
            <FormField
              icon={ICONS.hint}
              label={t('addCard.example', 'Örnek')}
              value={values.example}
              onChangeText={(v) => setValue('example', v)}
              maxLength={CARD_LIMITS.example}
              multiline
              placeholder={t('addCard.examplePlaceholder', 'Örnek cümle')}
            />
            <FormField
              icon={ICONS.note}
              label={t('addCard.note', 'Not')}
              value={values.note}
              onChangeText={(v) => setValue('note', v)}
              maxLength={CARD_LIMITS.note}
              multiline
              placeholder={t('addCard.notePlaceholder', 'Not (opsiyonel)')}
            />
            <View>
              <FormLabel icon={ICONS.image} label={t('addCard.image', 'Kart Görseli')} />
              {values.image ? (
                <View style={[box, styles.imageBox]}>
                  <Image source={{ uri: values.image }} style={styles.image} contentFit="contain" />
                  <View style={styles.imageActions}>
                    <TouchableOpacity onPress={handlePickImage} style={[styles.imageAction, { borderColor: ACCENT }]}>
                      <PhosphorIcon icon={ICONS.edit} size={16} color={ACCENT} />
                      <Text style={[styles.imageActionText, { color: ACCENT }]}>{t('addCard.changeImage', 'Değiştir')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setValue('image', '')} style={[styles.imageAction, { borderColor: colors.error }]}>
                      <PhosphorIcon icon={ICONS.delete} size={16} color={colors.error} />
                      <Text style={[styles.imageActionText, { color: colors.error }]}>{t('addCard.removeImage', 'Görseli Kaldır')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={handlePickImage} style={[box, styles.addImage]}>
                  <PhosphorIcon icon={ICONS.image} size={18} color={colors.muted} />
                  <Text style={[styles.addImageText, { color: colors.muted }]}>{t('addCard.addImage', 'Fotoğraf Ekle')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </OptionalSection>
        </FormCard>

        <FormActions
          primaryText={mode === 'edit' ? t('cardDetail.save', 'Kaydet') : t('create.create', 'Oluştur')}
          onPrimary={handleSubmit}
          loading={loading}
          secondaryText={mode === 'edit' ? t('form.undoChanges', 'Değişiklikleri geri al') : t('form.clearForm', 'Formu temizle')}
          onSecondary={handleUndo}
          showSecondary={isDirty}
        />
      </FormScrollView>
    </SafeAreaView>
  );
}

/**
 * "Kartı Düzenle" page (route EditCard), opened from the card detail sheet.
 * params: { card, deck, returnKey } — returnKey is the cards screen's route
 * key; the saved card is handed back to it as its `editedCard` param, then
 * the page closes.
 */
export function EditCardScreen({ route, navigation }) {
  const { card, deck, returnKey } = route.params || {};
  const handleSaved = (updatedCard) => {
    if (returnKey) {
      navigation.dispatch({ ...CommonActions.setParams({ editedCard: updatedCard }), source: returnKey });
    }
    navigation.goBack();
  };
  return <CardForm mode="edit" card={card} deck={deck} onSaved={handleSaved} />;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: FORM_SIDE_PADDING,
    paddingTop: 8,
  },
  fields: { gap: 18 },
  imageBox: { paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center', gap: 10 },
  image: { width: '100%', height: 160, borderRadius: 12 },
  imageActions: { flexDirection: 'row', gap: 10 },
  imageAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 99,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  addImage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addImageText: { fontSize: fontSizes.body, fontFamily: fonts.regular },
  imageActionText: { fontSize: fontSizes.subhead, fontFamily: fonts.semibold },
});
