import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Keyboard } from 'react-native';
import { Text, TextInput } from '../../components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormScrollView from '../../components/layout/FormScrollView';
import { getCategories } from '../../services/CategoryService';
import { updateDeck } from '../../services/DeckService';
import { getLanguages } from '../../services/LanguageService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import CategorySelector from '../../components/modals/CategorySelector';
import UndoButton from '../../components/tools/UndoButton';
import CreateButton from '../../components/tools/CreateButton';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import BadgeText from '../../components/tools/BadgeText';
import DeckLanguageModal, { DeckLanguageField } from '../../components/modals/DeckLanguageModal';
import { triggerHaptic } from '../../lib/hapticManager';
import { getCategoryIcon, ICONS } from '../../theme/icons';
import PhosphorIcon from '../../components/ui/PhosphorIcon';

export default function DeckEditScreen() {
  const route = useRoute();
  const { deck, selectedLanguageIds , categoryInfo} = route.params;
  const [name, setName] = useState(deck.name || '');
  const [toName, setToName] = useState(deck.to_name || '');
  const [description, setDescription] = useState(deck.description || '');
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(deck.category_id || null);
  const [selectedLanguage, setSelectedLanguage] = useState(selectedLanguageIds || []);
  const [isDeckLanguageModalVisible, setDeckLanguageModalVisible] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbarHelpers();
  const deckCategory = deck.categories || null;

  React.useEffect(() => {
    const loadLanguages = async () => {
      try {
        const data = await getLanguages();
        setLanguages(data);
      } catch (e) {
        console.error('Error loading languages:', e);
      }
    };
    loadLanguages();
  }, []);


  // Kategorileri yükle - hem ID hem de name çekelim
  React.useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (e) {
        console.error('Error loading categories:', e);
      }
    };
    loadCategories();
  }, []);

  const resetForm = () => {
    Keyboard.dismiss();
    setName('');
    setToName('');
    setDescription('');
    setSelectedCategory(null);
    setSelectedLanguage([]);
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    const MAX_NAME_LENGTH = 70; 
    const MAX_TONAME_LENGTH = 70;
    if (!name.trim()) {
      showError(t("common.requiredNameDeck", "Deste adı zorunludur."));
      return;
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      showError(t('create.nameTooLong', `Deste adı en fazla ${MAX_NAME_LENGTH} karakter olabilir.`));
      return;
    }
    if (toName.trim().length > MAX_TONAME_LENGTH) {
      showError(t('create.toNameTooLong', `Karşılığı en fazla ${MAX_TONAME_LENGTH} karakter olabilir.`));
      return;
    }
    if (!selectedCategory) {
      showError(t("create.requiredCategory", "Lütfen bir kategori seçin."));
      return;
    }
    if (!selectedLanguage || selectedLanguage.length === 0) {
      showError(t("create.requiredLanguage", "Lütfen kartın ön yüzündeki dili seç."));
      return;
    }
    setLoading(true);
    try {
      await updateDeck(deck.id, deck.user_id, {
        name: name.trim(),
        to_name: toName.trim() || null,
        description: description.trim() || null,
        category_id: selectedCategory,
        languageIds: selectedLanguage,
      });
      showSuccess(t("common.successDeckMessage", "Deste güncellendi."));
      setTimeout(() => {
        navigation.goBack({
          name: 'DeckDetail',
          params: { 
            deck: { 
              ...deck, 
              name: name.trim(), 
              to_name: toName.trim() || null, 
              description: description.trim() || null, 
              category_id: selectedCategory 
            } 
          },
          merge: true,
        });
      }, 500);
    } catch (e) {
      showError(e.message || t("common.errorDeckMessage", "Deste güncellenemedi."));
    } finally {
      setLoading(false);
    }
  };


  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FormScrollView
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.inputCard, 
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.cardBorder,
              borderWidth: 1,
              shadowColor: colors.shadowColor,
              shadowOffset: colors.shadowOffset,
              shadowOpacity: colors.shadowOpacity,
              shadowRadius: colors.shadowRadius,
              elevation: colors.elevation,
            },
          ]}
        >
          <View style={styles.labelRow}>
            <View style={styles.labelTextContainer}>
              <PhosphorIcon icon={ICONS.deckName} size={24} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, { fontSize: fontSizes.body }, { color: colors.text }]}>{t('create.name', 'Deste Adı')}</Text>
            </View>
            <View>
              <BadgeText required={true} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={[styles.input, typography.styles.body, { color: colors.text, flex: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
              placeholder={t('create.nameExam', 'Örn: İngilizce')}
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
              accessibilityLabel={t('create.name', 'Deste Adı')}
            />
            {name?.length > 0 ? (
              <TouchableOpacity
                onPress={() => setName('')}
                accessibilityLabel={t('common.clear', 'Temizle')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 8, padding: 6, borderRadius: 12, backgroundColor: colors.iconBackground }}
              >
                <PhosphorIcon icon={ICONS.close} size={18} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.cardBorder,
              borderWidth: 1,
              shadowColor: colors.shadowColor,
              shadowOffset: colors.shadowOffset,
              shadowOpacity: colors.shadowOpacity,
              shadowRadius: colors.shadowRadius,
              elevation: colors.elevation,
            },
          ]}
        >
          <View style={styles.labelRow}>
            <View style={styles.labelTextContainer}>
              <PhosphorIcon icon={ICONS.pair} size={24} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, { fontSize: fontSizes.body }, { color: colors.text }]}>{t('create.toName', 'Karşılığı')}</Text>
            </View>
            <View>
              <BadgeText required={false} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={[styles.input, typography.styles.body, { color: colors.text, flex: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
              placeholder={t('create.toNameExam', 'Örn: Türkçe')}
              placeholderTextColor={colors.muted}
              value={toName}
              onChangeText={setToName}
              returnKeyType="next"
              accessibilityLabel={t('create.toName', 'Karşılığı')}
            />
            {toName?.length > 0 ? (
              <TouchableOpacity
                onPress={() => setToName('')}
                accessibilityLabel={t('common.clear', 'Temizle')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 8, padding: 6, borderRadius: 12, backgroundColor: colors.iconBackground }}
              >
                <PhosphorIcon icon={ICONS.close} size={18} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.cardBorder,
              borderWidth: 1,
              shadowColor: colors.shadowColor,
              shadowOffset: colors.shadowOffset,
              shadowOpacity: colors.shadowOpacity,
              shadowRadius: colors.shadowRadius,
              elevation: colors.elevation,
            },
          ]}
        >
          <View style={styles.labelRow}>
            <View style={styles.labelTextContainer}>
              <PhosphorIcon icon={ICONS.description} size={24} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, { fontSize: fontSizes.body }, { color: colors.text }]}>{t('create.description', 'Açıklama')}</Text>
            </View>
            <View>
              <BadgeText required={false} />
            </View>
          </View>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[
                styles.input,
                typography.styles.body,
                { height: 120, textAlignVertical: 'top', color: colors.text, paddingRight: 40, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground},
              ]}
              placeholder={t('create.descriptionExam', 'Deste hakkında açıklama...')}
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              returnKeyType="done"
              accessibilityLabel={t('create.description', 'Açıklama')}
            />
            {description?.length > 0 ? (
              <TouchableOpacity
                onPress={() => setDescription('')}
                accessibilityLabel={t('common.clear', 'Temizle')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ position: 'absolute', right: 8, top: 8, padding: 6, borderRadius: 12, backgroundColor: colors.iconBackground }}
              >
                <PhosphorIcon icon={ICONS.close} size={18} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Kategori Seçimi */}
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.cardBorder,
              borderWidth: 1,
              shadowColor: colors.shadowColor,
              shadowOffset: colors.shadowOffset,
              shadowOpacity: colors.shadowOpacity,
              shadowRadius: colors.shadowRadius,
              elevation: colors.elevation,
            },
          ]}
        >
          <View style={styles.labelRow}>
            <View style={styles.labelTextContainer}>
              <PhosphorIcon icon={ICONS.category} size={24} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, { fontSize: fontSizes.body }, { color: colors.text }]}>{t('createDeck.categoryLabel', 'Kategori')}</Text>
            </View>
            <View>
              <BadgeText required={true} />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.categorySelector, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
            accessibilityLabel={t('createDeck.selectCategoryA11y', 'Kategori seç')}
            onPress={() => 
              {
                Keyboard.dismiss();
                triggerHaptic('selection');
                requestAnimationFrame(() => {
                  setCategoryModalVisible(true);
                });
              }}
          >
            <View style={styles.categoryRow}>
              {selectedCategory && (() => {
                // Önce deck'ten gelen kategori bilgisini kullan, yoksa categories listesinden bul
                const category = deckCategory && deckCategory.id === selectedCategory
                  ? deckCategory
                  : categories.find(c => c.id === selectedCategory);
                const sortOrder = category?.sort_order;

                return sortOrder ? (
                  <PhosphorIcon
                    icon={getCategoryIcon(sortOrder)}
                    size={20}
                    color={selectedCategory ? colors.text : colors.muted}
                    style={styles.categoryIcon}
                  />
                ) : null;
              })()}
              <Text style={[styles.categoryText, typography.styles.body, { color: selectedCategory ? colors.text : colors.muted }]}>
                {selectedCategory ? (() => {
                  // Önce deck'ten gelen kategori bilgisini kullan, yoksa categories listesinden bul
                  const category = deckCategory && deckCategory.id === selectedCategory
                    ? deckCategory
                    : categories.find(c => c.id === selectedCategory);
                  const sortOrder = category?.sort_order;
                  const categoryName = category?.name;

                  return sortOrder
                    ? (t(`categories.${sortOrder}`) || categoryName || t('createDeck.selectCategory'))
                    : t('createDeck.selectCategory');
                })() : t('createDeck.selectCategory')}
              </Text>
            </View>
            <PhosphorIcon icon={ICONS.dropdown} size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.cardBorder,
              borderWidth: 1,
              shadowColor: colors.shadowColor,
              shadowOffset: colors.shadowOffset,
              shadowOpacity: colors.shadowOpacity,
              shadowRadius: colors.shadowRadius,
              elevation: colors.elevation,
            },
          ]}
        >
          <View style={styles.labelRow}>
            <View style={styles.labelTextContainer}>
              <PhosphorIcon icon={ICONS.language} size={24} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, { fontSize: fontSizes.body }, { color: colors.text }]}>
                {t('create.language', 'İçerik Dili')}
              </Text>
            </View>
            <View>
              <BadgeText required={true} />
            </View>
          </View>

          <DeckLanguageField
            languages={languages}
            selectedLanguage={selectedLanguage}
            onPress={() => {
              Keyboard.dismiss();
              triggerHaptic('selection');
              requestAnimationFrame(() => {
                setDeckLanguageModalVisible(true);
              });
            }}
            onSwap={() => {
              triggerHaptic('selection');
              setSelectedLanguage((prev) => (prev.length === 2 ? [prev[1], prev[0]] : prev));
            }}
          />
        </View>
        <View style={styles.buttonRowModern}>
          <UndoButton
            onPress={resetForm}
            disabled={loading}
            style={{ flex: 1, minWidth: 0, marginRight: 10 }}
          />
          <CreateButton
            onPress={handleSave}
            disabled={loading}
            loading={loading}
            text={loading ? t("create.saving", "Kaydediliyor...") : t("create.save", "Kaydet")}
            style={{ flex: 2 }}
          />
        </View>
      </FormScrollView>

      <CategorySelector
        isVisible={isCategoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        categories={categories}
        selectedCategoryId={selectedCategory}
        onSelectCategory={(id) => {
          setSelectedCategory(id);
          setCategoryModalVisible(false);
        }}
      />
      <DeckLanguageModal
        isVisible={isDeckLanguageModalVisible}
        onClose={() => setDeckLanguageModalVisible(false)}
        languages={languages}
        selectedLanguage={selectedLanguage}
        onChange={setSelectedLanguage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 16,
    paddingTop: 16,
  },
  inputCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    padding: 20,
    marginBottom: 11,
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  labelTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: fontSizes.body,
    fontFamily: fonts.medium,
  },
  input: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    marginBottom: 0,
    fontSize: fontSizes.body,
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
    marginBottom: 52,
  },
  optional: {
    marginLeft: 4,
    alignSelf: 'flex-end',
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    marginRight: 8,
  },
  categoryText: {
    flex: 1,
  },
}); 