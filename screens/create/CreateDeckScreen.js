import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import CategorySelector from '../../components/modals/CategorySelector';
import HowToCreateModal from '../../components/modals/HowToCreateModal';
import UndoButton from '../../components/tools/UndoButton';
import CreateButton from '../../components/tools/CreateButton';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { scale, moderateScale, verticalScale } from 'react-native-size-matters';
import DeckLanguageModal from '../../components/modals/DeckLanguageModal';

export default function CreateScreen() {
  const [name, setName] = useState('');
  const [toName, setToName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);
  const [isHowToCreateModalVisible, setHowToCreateModalVisible] = useState(false);
  const { showError } = useSnackbarHelpers();
  const [selectedLanguage, setSelectedLanguage] = useState([]);
  const [isDeckLanguageModalVisible, setDeckLanguageModalVisible] = useState(false);
  const [languages, setLanguages] = useState([]);


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

  const handleCreate = async () => {
    if (!name.trim()) {
      showError(t('create.requiredName', 'Deste adı zorunludur.'));
      return;
    }
    if (!selectedCategory) {
      showError(t('create.requiredCategory', 'Lütfen bir kategori seçin.'));
      return;
    }
    if (!selectedLanguage) {
      showError(t('create.requiredLanguage', 'Lütfen desteyle ilgili bir dil seçin.'));
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('decks')
        .insert({
          user_id: user.id,
          name: name.trim(),
          to_name: toName.trim() || null,
          description: description.trim() || null,
          category_id: selectedCategory,
          is_shared: false,
          is_admin_created: false,
          card_count: 0,
          is_started: false,
        })
        .select('*, profiles:profiles(username, image_url), categories:categories(id, name, sort_order)')
        .single();
      
      if (selectedLanguage.length > 0) {
        const relations = selectedLanguage.map((languageId) => ({
          deck_id: data.id,
          language_id: languageId,
        }));
        const { error: deckLangError } = await supabase
          .from('decks_languages')
          .insert(relations);

        if (deckLangError) throw deckLangError;
      }
      if (error) throw error;
      resetForm();
      navigation.navigate('DeckDetail', { deck: data });
    } catch (e) {
      showError(e.message || t('create.error', 'Deste oluşturulamadı.'));
    } finally {
      setLoading(false);
    }
  };



  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          {/* Header Card */}
          <View style={[styles.headerCard, styles.headerCardContainer, { borderRadius: 28, backgroundColor: colors.cardBackground || colors.cardBackgroundTransparent || (isDarkMode ? 'rgba(50, 50, 50, 0.5)' : 'rgba(50, 50, 50, 0.1)') }]}>
            <View style={[styles.headerCardContent, styles.headerContent]}>
              <View style={styles.headerTitleContainer}>
                <Iconify icon="fluent:tab-add-24-regular" size={moderateScale(26)} color="#F98A21" style={{ marginRight: scale(6) }} />
                <Text style={[typography.styles.h2, { color: colors.text }]}>
                  {t('createDeck.title', 'Desteni Oluştur')}
                </Text>
              </View>
              <View style={styles.headerBottomRow}>
                <View style={styles.headerTextColumn}>
                  <Text style={[typography.styles.caption, { color: colors.muted, lineHeight: moderateScale(22), flex: 1, alignSelf: 'flex-start' }]}>
                    {t('createDeck.motivationText', 'Kişiselleştirilmiş destelerle öğrenme yolculuğunu tasarla ve bilgini pekiştir.')}
                  </Text>
                  <TouchableOpacity
                    style={[styles.howToCreateButton, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}
                    activeOpacity={0.7}
                    onPress={() => setHowToCreateModalVisible(true)}
                  >
                    <Iconify icon="material-symbols:info-outline" size={moderateScale(16)} color={colors.secondary} style={{ marginRight: scale(4) }} />
                    <Text style={[typography.styles.caption, { color: colors.secondary, fontWeight: '600', textDecorationLine: 'underline' }]}>
                      {t('createDeck.howToCreate', 'Nasıl Oluşturulur?')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.headerImageContainer}>
                  <Image
                    source={require('../../assets/create-deck-item.png')}
                    style={styles.headerImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
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
              <Iconify icon="ion:book" size={moderateScale(20)} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('create.name', 'Deste Adı')}*</Text>
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
              />
              {name?.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setName('')}
                  accessibilityLabel={t('common.clear', 'Temizle')}
                  hitSlop={{ top: moderateScale(8), bottom: moderateScale(8), left: moderateScale(8), right: moderateScale(8) }}
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
              <Iconify icon="icon-park-outline:translation" size={moderateScale(20)} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('create.toName', 'Karşılığı')}</Text>
              <Text style={[typography.styles.caption, { color: colors.muted }]}> ({t('create.optional', 'opsiyonel')})</Text>
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
                  hitSlop={{ top: moderateScale(8), bottom: moderateScale(8), left: moderateScale(8), right: moderateScale(8) }}
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
              <Iconify icon="tabler:file-description-filled" size={moderateScale(20)} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('create.description', 'Açıklama')}</Text>
              <Text style={[styles.optional, typography.styles.caption, { color: colors.muted }]}> ({t('create.optional', 'opsiyonel')})</Text>
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
                  hitSlop={{ top: moderateScale(8), bottom: moderateScale(8), left: moderateScale(8), right: moderateScale(8) }}
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
              <Iconify icon="mdi:category-plus-outline" size={moderateScale(21)} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('createDeck.categoryLabel', 'Kategori')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.categorySelector, { borderColor: '#eee' }]}
              accessibilityLabel={t('createDeck.selectCategoryA11y', 'Kategori seç')}
              onPress={() => setCategoryModalVisible(true)}
            >
              <View style={styles.categoryRow}>
                {selectedCategory && (
                  <Iconify
                    icon={getCategoryIcon(categories.find(c => c.id === selectedCategory)?.sort_order)}
                    size={moderateScale(20)}
                    color={selectedCategory ? colors.text : colors.muted}
                    style={styles.categoryIcon}
                  />
                )}
                <Text style={[styles.categoryText, typography.styles.body, { color: selectedCategory ? colors.text : colors.muted }]}>
                  {selectedCategory ? t(`categories.${categories.find(c => c.id === selectedCategory)?.sort_order}`) || categories.find(c => c.id === selectedCategory)?.name || t('createDeck.selectCategory') : t('createDeck.selectCategory')}
                </Text>
              </View>
              <Iconify icon="flowbite:caret-down-solid" size={moderateScale(20)} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {/* Desteye Ait Dil Seçimi */}
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
            <Iconify icon="mdi:spoken-language" size={moderateScale(21)} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>
                {t('create.language', 'İçerik Dili')}
              </Text>
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
                {selectedLang?.length > 0 ? ` ${selectedLang.map(l => getDeckLanguageName(l)).join(' | ')}` : ` ${t('create.selectLanguage', 'Dil seç')}` }
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
            />
            <CreateButton
              onPress={handleCreate}
              disabled={loading}
              loading={loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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

      <HowToCreateModal
        isVisible={isHowToCreateModalVisible}
        onClose={() => setHowToCreateModalVisible(false)}
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
    paddingTop: verticalScale(8),
    paddingBottom: '10%',
  },
  headerCard: {
    width: '100%',
    marginBottom: verticalScale(12),
  },
  headerCardContainer: {
    borderRadius: moderateScale(28),
    overflow: 'hidden',
    marginHorizontal: scale(10),
    marginVertical: verticalScale(8),
    paddingVertical: verticalScale(10),
  },
  headerCardContent: {
    borderRadius: moderateScale(28),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(6),
    minHeight: verticalScale(160),
  },
  headerContent: {
    paddingVertical: verticalScale(4),
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextColumn: {
    flex: 1,
    marginRight: scale(12),
  },
  howToCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    marginTop: verticalScale(12),
  },
  headerImageContainer: {
    width: moderateScale(120, 0.3),
    height: moderateScale(120, 0.3),
    marginLeft: scale(12),
  },
  headerImage: {
    width: moderateScale(140, 0.3),
    height: moderateScale(140, 0.3),
    alignSelf: 'flex-end',
    top: '-10%',
  },
  inputCard: {
    width: '100%',
    maxWidth: scale(440),
    borderRadius: moderateScale(28),
    padding: scale(20),
    marginBottom: verticalScale(11),
    shadowOffset: { width: moderateScale(4), height: moderateScale(6) },
    shadowOpacity: 0.10,
    shadowRadius: moderateScale(10),
    elevation: 5,
    overflow: 'hidden',

  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(11),
    gap: scale(8),
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
    gap: scale(20),
    marginTop: verticalScale(12),
    marginBottom: verticalScale(60),
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