import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform, SafeAreaView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { supabase } from '../../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import CategorySelector from '../../components/modals/CategorySelector';
import UndoButton from '../../components/tools/UndoButton';
import CreateButton from '../../components/tools/CreateButton';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import BadgeText from '../../components/modals/BadgeText';
import DeckLanguageModal from '../../components/modals/DeckLanguageModal';

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

  const selectedLang = languages.filter(l =>
    selectedLanguage?.includes(l.id)
  );

  React.useEffect(() => {
    const loadLanguages = async () => {
      const { data, error } = await supabase
        .from('languages')
        .select('*');
      console.log('LANGUAGES:', data, error);
      setLanguages(data || []);
    };
    loadLanguages();
  }, []);

  const getDeckLanguageName = (language) => {
    const translation = t(`languages.${language.sort_order}`, null);
    return translation;
  };


  // Kategori ikonunu sort_order değerine göre al
  const getCategoryIcon = (sortOrder) => {
    const icons = {
      1: "hugeicons:language-skill", // Dil
      2: "clarity:atom-solid", // Bilim
      3: "mdi:math-compass", // Matematik
      4: "game-icons:tied-scroll", // Tarih
      5: "arcticons:world-geography-alt", // Coğrafya
      6: "map:museum", // Sanat ve Kültür
      7: "ic:outline-self-improvement", // Kişisel Gelişim
      8: "garden:puzzle-piece-fill-16" // Genel Kültür
    };
    return icons[sortOrder] || "material-symbols:category";
  };

  // Kategorileri yükle - hem ID hem de name çekelim
  React.useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, sort_order')
          .order('sort_order', { ascending: true });
        if (error) throw error;
        setCategories(data || []);
      } catch (e) {
        console.error('Kategoriler yüklenemedi:', e);
      }
    };
    loadCategories();
  }, []);

  const resetForm = () => {
    setName('');
    setToName('');
    setDescription('');
    setSelectedCategory(null);
    setSelectedLanguage([]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showError(t("common.requiredNameDeck", "Deste adı zorunludur."));
      return;
    }
    if (!selectedCategory) {
      showError(t("create.requiredCategory", "Lütfen bir kategori seçin."));
      return;
    }
    if (!selectedLanguage) {
      showError(t("create.requiredLanguage", "Lütfen desteyle ilgili bir dil seçin."));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('decks')
        .update({
          name: name.trim(),
          to_name: toName.trim() || null,
          description: description.trim() || null,
          category_id: selectedCategory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deck.id);
      if (error) throw error;
      // önce eski dilleri sil
      const { error: deleteError } = await supabase
        .from('decks_languages')
        .delete()
        .eq('deck_id', deck.id);

      if (deleteError) throw deleteError;

      // sonra yenileri ekle
      if (selectedLanguage.length > 0) {
        const relations = selectedLanguage.map((languageId) => ({
          deck_id: deck.id,
          language_id: languageId,
        }));

        const { error: deckLangError } = await supabase
          .from('decks_languages')
          .insert(relations);

        if (deckLangError) throw deckLangError;
      }

      showSuccess(t("common.successDeckMessage", "Deste güncellendi."));
      setTimeout(() => {
        navigation.navigate('DeckDetail', { deck: { ...deck, name: name.trim(), to_name: toName.trim() || null, description: description.trim() || null, category_id: selectedCategory } });
      }, 500);
    } catch (e) {
      showError(e.message || t("common.errorDeckMessage", "Deste güncellenemedi."));
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={verticalScale(20)}
      >
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
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
              <Iconify icon="ion:book" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('create.name', 'Deste Adı')}</Text>
            </View>
            <View>
              <BadgeText required={true} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={[styles.input, typography.styles.body, { color: colors.text, flex: 1 }]}
              placeholder={t('create.nameExam', 'Örn: İngilizce')}
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
              accessibilityLabel={t('create.name', 'Deste Adı')}
              autoFocus
            />
            {name?.length > 0 ? (
              <TouchableOpacity
                onPress={() => setName('')}
                accessibilityLabel={t('common.clear', 'Temizle')}
                hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}
                style={{ marginLeft: scale(8), padding: moderateScale(6), borderRadius: moderateScale(12), backgroundColor: colors.iconBackground }}
              >
                <Iconify icon="material-symbols:close-rounded" size={moderateScale(18)} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
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
              <Iconify icon="icon-park-outline:translation" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('create.toName', 'Karşılığı')}</Text>
            </View>
            <View>
              <BadgeText required={false} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={[styles.input, typography.styles.body, { color: colors.text, flex: 1 }]}
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
                hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}
                style={{ marginLeft: scale(8), padding: moderateScale(6), borderRadius: moderateScale(12), backgroundColor: colors.iconBackground }}
              >
                <Iconify icon="material-symbols:close-rounded" size={moderateScale(18)} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
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
              <Iconify icon="tabler:file-description-filled" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('create.description', 'Açıklama')}</Text>
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
                { height: verticalScale(120), textAlignVertical: 'top', color: colors.text, paddingRight: scale(40) },
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
                hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}
                style={{ position: 'absolute', right: scale(8), top: verticalScale(8), padding: moderateScale(6), borderRadius: moderateScale(12), backgroundColor: colors.iconBackground }}
              >
                <Iconify icon="material-symbols:close-rounded" size={moderateScale(18)} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Kategori Seçimi */}
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
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
              <Iconify icon="mdi:category-plus-outline" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('createDeck.categoryLabel', 'Kategori')}</Text>
            </View>
            <View>
              <BadgeText required={true} />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.categorySelector, { borderColor: '#eee' }]}
            accessibilityLabel={t('createDeck.selectCategoryA11y', 'Kategori seç')}
            onPress={() => setCategoryModalVisible(true)}
          >
            <View style={styles.categoryRow}>
              {selectedCategory && (() => {
                // Önce deck'ten gelen kategori bilgisini kullan, yoksa categories listesinden bul
                const category = deckCategory && deckCategory.id === selectedCategory
                  ? deckCategory
                  : categories.find(c => c.id === selectedCategory);
                const sortOrder = category?.sort_order;

                return sortOrder ? (
                  <Iconify
                    icon={getCategoryIcon(sortOrder)}
                    size={moderateScale(20)}
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
            <Iconify icon="flowbite:caret-down-solid" size={moderateScale(20)} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
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
              <Iconify icon="mdi:spoken-language" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>
                {t('create.language', 'İçerik Dili')}
              </Text>
            </View>
            <View>
              <BadgeText required={true} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.categorySelector, { borderColor: '#eee' }]}
            accessibilityLabel={t('create.selectLanguage', 'Dil Seç')}
            onPress={() => setDeckLanguageModalVisible(true)}
          >
            <View style={styles.categoryRow}>
              <Text
                style={[
                  styles.categoryText,
                  typography.styles.body,
                  { color: selectedLang?.length > 0 ? colors.text : colors.muted },
                ]}
              >
                {selectedLang?.length > 0 ? ` ${selectedLang.map(l => getDeckLanguageName(l)).join(' | ')}` : ` ${t('create.selectLanguage', 'Dil seç')}`}
              </Text>
              
            </View>
            <Iconify
              icon="flowbite:caret-down-solid"
              size={moderateScale(20)}
              color={colors.muted}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.buttonRowModern}>
          <UndoButton
            onPress={resetForm}
            disabled={loading}
            style={{ flex: 1, minWidth: 0, marginRight: scale(10) }}
          />
          <CreateButton
            onPress={handleSave}
            disabled={loading}
            loading={loading}
            text={loading ? t("create.saving", "Kaydediliyor...") : t("create.save", "Kaydet")}
            style={{ flex: 2 }}
          />
        </View>
      </KeyboardAwareScrollView>

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
        onSelectLanguage={(languageId) => {
          setSelectedLanguage(prev => {
            if (prev.includes(languageId)) {
              return prev.filter(id => id !== languageId);
            }
            if (prev.length >= 2) {
              return prev;
            }
            return [...prev, languageId];
          });
        }}

      />
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: scale(16),
    paddingTop: verticalScale(16),
  },
  inputCard: {
    width: '100%',
    maxWidth: scale(440),
    borderRadius: moderateScale(28),
    padding: moderateScale(20),
    marginBottom: verticalScale(11),
    shadowOffset: { width: scale(4), height: verticalScale(6) },
    shadowOpacity: 0.10,
    shadowRadius: moderateScale(10),
    elevation: 5,
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(12),
    justifyContent: 'space-between',
  },
  labelTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  label: {
    fontSize: moderateScale(16),
    fontWeight: '500',
  },
  input: {
    borderWidth: moderateScale(0.15),
    borderColor: '#eee',
    borderRadius: moderateScale(8),
    padding: scale(12),
    marginBottom: 0,
    fontSize: moderateScale(16),
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(28),
    marginBottom: verticalScale(32),
  },
  optional: {
    marginLeft: scale(4),
    alignSelf: 'flex-end',
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: moderateScale(0.15),
    borderRadius: moderateScale(8),
    padding: scale(12),
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    marginRight: scale(8),
  },
  categoryText: {
    flex: 1,
  },
}); 