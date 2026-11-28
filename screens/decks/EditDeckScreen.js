import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FormScrollView from '../../components/layout/FormScrollView';
import {
  useForm, useUnsavedChangesGuard, confirmDiscard, FORM_SIDE_PADDING,
  FormActions, FormCard, FormDivider, FormField, FormLabel, FormMessage, FormSelect, OptionalSection,
} from '../../components/layout/FormField';
import { getCategories } from '../../services/CategoryService';
import { updateDeck } from '../../services/DeckService';
import { getLanguages } from '../../services/LanguageService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import CategorySelector from '../../components/modals/CategorySelector';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import DeckLanguageModal, { DeckLanguageField } from '../../components/modals/DeckLanguageModal';
import { triggerHaptic } from '../../lib/hapticManager';
import { DECK_LIMITS } from '../../lib/limits';
import { getCategoryIcon, ICONS } from '../../theme/icons';

export const EMPTY_DECK_VALUES = { name: '', toName: '', description: '', category: null, languages: [] };

/**
 * Deck form, shared by "Desteni Oluştur" and "Desteyi Düzenle".
 * Card 1: name, then to_name + description behind "add more".
 * Card 2: category and content languages.
 *
 * mode: 'create' | 'edit'
 * initialValues: { name, toName, description, category, languages }
 * knownCategory: the deck's category row (shown before the list loads)
 * header: element above the cards (create page header)
 * onSubmit(values, { leave }): saves; throws on failure. leave(fn) navigates
 *   away without the unsaved-changes question.
 */
export function DeckForm({ mode, initialValues, knownCategory = null, header = null, onSubmit }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showError } = useSnackbarHelpers();
  const form = useForm(initialValues);
  const { values, setValue, errors, setErrors, reset, isDirty } = form;
  const leave = useUnsavedChangesGuard(isDirty);
  const nameRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [moreOpen, setMoreOpen] = useState(Boolean(initialValues.toName || initialValues.description));

  useEffect(() => {
    getLanguages().then(setLanguages).catch((e) => console.error('Error loading languages:', e));
    getCategories().then(setCategories).catch((e) => console.error('Error loading categories:', e));
  }, []);

  const category = values.category
    ? (knownCategory && knownCategory.id === values.category ? knownCategory : categories.find((c) => c.id === values.category))
    : null;
  const categoryLabel = category
    ? (t(`categories.${category.sort_order}`, { defaultValue: '' }) || category.name)
    : null;

  const optionalFilled = [values.toName, values.description].filter((v) => v?.trim()).length;

  const handleUndo = () => {
    Keyboard.dismiss();
    confirmDiscard(t, isDirty, () => {
      reset();
      setMoreOpen(Boolean(initialValues.toName || initialValues.description));
    });
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    const next = {};
    if (!values.name.trim()) next.name = t('create.requiredName', 'Deste adı zorunludur.');
    if (!values.category) next.category = t('create.requiredCategory', 'Lütfen bir kategori seçin.');
    if (!values.languages?.length) next.languages = t('create.requiredLanguage', 'Lütfen kartın ön yüzündeki dili seç.');
    if (Object.keys(next).length) {
      setErrors(next);
      triggerHaptic('error');
      if (next.name) nameRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        to_name: values.toName.trim() || null,
        description: values.description.trim() || null,
        category_id: values.category,
        languageIds: values.languages,
      }, { leave });
    } catch (e) {
      showError(e?.message || (mode === 'edit'
        ? t('common.errorDeckMessage', 'Deste güncellenemedi.')
        : t('create.error', 'Deste oluşturulamadı.')));
    } finally {
      setLoading(false);
    }
  };

  const openPicker = (open) => {
    Keyboard.dismiss();
    triggerHaptic('selection');
    requestAnimationFrame(open);
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

        {/* name, then the optional to_name + description */}
        <FormCard>
          <FormField
            ref={nameRef}
            icon={ICONS.deckName}
            label={t('create.name', 'Deste Adı')}
            value={values.name}
            onChangeText={(v) => setValue('name', v)}
            maxLength={DECK_LIMITS.name}
            placeholder={t('create.nameExam', 'Örn: İngilizce')}
            returnKeyType="next"
            error={errors.name}
          />
          <OptionalSection
            title={t('create.moreDetails', 'Karşılığı ve açıklama ekle')}
            expanded={moreOpen}
            onToggle={() => setMoreOpen((v) => !v)}
            filledCount={optionalFilled}
          >
            <FormField
              icon={ICONS.pair}
              label={t('create.toName', 'Karşılığı')}
              value={values.toName}
              onChangeText={(v) => setValue('toName', v)}
              maxLength={DECK_LIMITS.toName}
              placeholder={t('create.toNameExam', 'Örn: Türkçe')}
              returnKeyType="next"
            />
            <FormField
              icon={ICONS.description}
              label={t('create.description', 'Açıklama')}
              value={values.description}
              onChangeText={(v) => setValue('description', v)}
              maxLength={DECK_LIMITS.description}
              multiline
              minHeight={110}
              placeholder={t('create.descriptionExam', 'Deste hakkında açıklama...')}
            />
          </OptionalSection>
        </FormCard>

        {/* category + content languages */}
        <FormCard>
          <FormSelect
            icon={ICONS.category}
            label={t('createDeck.categoryLabel', 'Kategori')}
            valueText={categoryLabel}
            valueIcon={category?.sort_order ? getCategoryIcon(category.sort_order) : null}
            placeholder={t('createDeck.selectCategory', 'Kategori seç')}
            accessibilityLabel={t('createDeck.selectCategoryA11y', 'Kategori seç')}
            onPress={() => openPicker(() => setCategoryModalVisible(true))}
            error={errors.category}
          />
          <FormDivider />
          <FormLabel icon={ICONS.language} label={t('create.language', 'İçerik Dili')} />
          <DeckLanguageField
            languages={languages}
            selectedLanguage={values.languages}
            onPress={() => openPicker(() => setLanguageModalVisible(true))}
            onSwap={() => {
              triggerHaptic('selection');
              setValue('languages', (prev) => (prev.length === 2 ? [prev[1], prev[0]] : prev));
            }}
            error={Boolean(errors.languages)}
          />
          <FormMessage error={errors.languages} />
        </FormCard>

        <FormActions
          primaryText={mode === 'edit' ? (loading ? t('create.saving', 'Kaydediliyor...') : t('create.save', 'Kaydet')) : t('create.create', 'Oluştur')}
          onPrimary={handleSubmit}
          loading={loading}
          secondaryText={mode === 'edit' ? t('form.undoChanges', 'Değişiklikleri geri al') : t('form.clearForm', 'Formu temizle')}
          onSecondary={handleUndo}
          showSecondary={isDirty}
        />
      </FormScrollView>

      <CategorySelector
        isVisible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        categories={categories}
        selectedCategoryId={values.category}
        onSelectCategory={(id) => {
          setValue('category', id);
          setCategoryModalVisible(false);
        }}
      />
      <DeckLanguageModal
        isVisible={languageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
        languages={languages}
        selectedLanguage={values.languages}
        onChange={(next) => setValue('languages', next)}
      />
    </SafeAreaView>
  );
}

/** "Desteyi Düzenle" page. params: { deck, selectedLanguageIds } */
export default function DeckEditScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { showSuccess } = useSnackbarHelpers();
  const { deck, selectedLanguageIds } = route.params;

  return (
    <DeckForm
      mode="edit"
      knownCategory={deck.categories || null}
      initialValues={{
        name: deck.name || '',
        toName: deck.to_name || '',
        description: deck.description || '',
        category: deck.category_id || null,
        languages: selectedLanguageIds || [],
      }}
      onSubmit={async (payload, { leave }) => {
        await updateDeck(deck.id, deck.user_id, payload);
        showSuccess(t('common.successDeckMessage', 'Deste güncellendi.'));
        leave(() => navigation.goBack());
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: FORM_SIDE_PADDING,
    paddingTop: 8,
  },
});
