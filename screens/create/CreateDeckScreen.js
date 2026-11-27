import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Keyboard, Platform } from 'react-native';
import { Text, TextInput } from '../../components/ui/AppText';
import { getCategories } from '../../services/CategoryService';
import { createDeck } from '../../services/DeckService';
import { getLanguages } from '../../services/LanguageService';
import { useAuth } from '../../contexts/AuthContext';
import FormScrollView from '../../components/layout/FormScrollView';
import { useNavigation } from '@react-navigation/native';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import CategorySelector from '../../components/modals/CategorySelector';
import HowToCreateModal from '../../components/modals/HowToCreateModal';
import UndoButton from '../../components/tools/UndoButton';
import CreateButton from '../../components/tools/CreateButton';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import DeckLanguageModal, { DeckLanguageField } from '../../components/modals/DeckLanguageModal';
import BadgeText from '../../components/tools/BadgeText';
import { triggerHaptic } from '../../lib/hapticManager';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCategoryIcon, ICONS } from '../../theme/icons';
import PhosphorIcon from '../../components/ui/PhosphorIcon';

export default function CreateScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
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

  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Klavye açıldığında state'i true yap
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    
    // Klavye kapandığında state'i false yap
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    // Component unmount olduğunda listener'ları temizle
    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);


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

  const handleCreate = async () => {
    Keyboard.dismiss();
    const MAX_NAME_LENGTH = 70; 
    const MAX_TONAME_LENGTH = 70;
    if (!name.trim()) {
      showError(t('create.requiredName', 'Deste adı zorunludur.'));
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
      showError(t('create.requiredCategory', 'Lütfen bir kategori seçin.'));
      return;
    }
    if (!selectedLanguage || selectedLanguage.length === 0) {
      showError(t('create.requiredLanguage', 'Lütfen kartın ön yüzündeki dili seç.'));
      return;
    }
    setLoading(true);
    try {
      const data = await createDeck(userId, {
        name: name.trim(),
        to_name: toName.trim() || null,
        description: description.trim() || null,
        category_id: selectedCategory,
        languageIds: selectedLanguage,
      });
      resetForm();
      // Now a pushed stack screen: replace so "back" from the new deck
      // returns to Library instead of an empty create form.
      navigation.replace('DeckDetail', { deck: data });
    } catch (e) {
      showError(e.message || t('create.error', 'Deste oluşturulamadı.'));
    } finally {
      setLoading(false);
    }
  };



  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FormScrollView contentInsetAdjustmentBehavior="automatic"
        style={{flex: 1}}
        contentContainerStyle={[styles.formContainer]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          {/* Header Card */}
          <View style={[styles.headerCard, styles.headerCardContainer, { borderRadius: 44, backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, borderWidth: 1 }]}>
            <View style={[styles.headerCardContent, styles.headerContent]}>
              <View style={styles.headerTitleContainer}>
                <PhosphorIcon icon={ICONS.deck} size={26} color="#F98A21" style={{ marginRight: 6 }} />
                <Text style={[typography.styles.title2, { color: colors.text }]}>
                  {t('createDeck.title', 'Desteni Oluştur')}
                </Text>
              </View>
              <View style={styles.headerBottomRow}>
                <View style={styles.headerTextColumn}>
                  <Text style={[typography.styles.subhead, { color: colors.muted, lineHeight: 22, flex: 1, alignSelf: 'flex-start' }]}>
                    {t('createDeck.motivationText', 'Kişiselleştirilmiş destelerle öğrenme yolculuğunu tasarla ve bilgini pekiştir.')}
                  </Text>
                  <TouchableOpacity
                    style={[styles.howToCreateButton, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      triggerHaptic('selection');
                      requestAnimationFrame(() => {
                        setHowToCreateModalVisible(true);
                      });
                    }}
                  >
                    <PhosphorIcon icon={ICONS.info} size={16} color={colors.secondary} style={{ marginRight: 4 }} />
                    <Text style={[typography.styles.subhead, { color: colors.secondary, fontFamily: fonts.semibold}]}>
                      {t('createDeck.howToCreate', 'Nasıl Oluşturulur?')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.headerImageContainer}>
                  <Image
                    source={require('../../assets/images/create_deck_item.webp')}
                    style={styles.headerImage}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                </View>
              </View>
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
                <PhosphorIcon icon={ICONS.deckName} size={20} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('create.name', 'Deste Adı')}</Text>
              </View>
              <View>
                <BadgeText required={true} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center',}}>
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
              <PhosphorIcon icon={ICONS.pair} size={20} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('create.toName', 'Karşılığı')}</Text>
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
              <PhosphorIcon icon={ICONS.description} size={20} color="#F98A21" style={styles.labelIcon} />
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
                <PhosphorIcon icon={ICONS.category} size={21} color="#F98A21" style={styles.labelIcon}/>
                <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('createDeck.categoryLabel', 'Kategori')}</Text>
              </View>
              <View>
                <BadgeText required={true} />
                </View>
            </View>
            <TouchableOpacity
              style={[styles.categorySelector, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
              accessibilityLabel={t('createDeck.selectCategoryA11y', 'Kategori seç')}
              onPress={() => {
                Keyboard.dismiss();
                triggerHaptic('selection');
                requestAnimationFrame(() => {
                  setCategoryModalVisible(true);
                });
              }}
            >
              <View style={styles.categoryRow}>
                {selectedCategory && (
                  <PhosphorIcon
                    icon={getCategoryIcon(categories.find(c => c.id === selectedCategory)?.sort_order)}
                    size={20}
                    color={selectedCategory ? colors.text : colors.muted}
                    style={styles.categoryIcon}
                  />
                )}
                <Text style={[styles.categoryText, typography.styles.body, { color: selectedCategory ? colors.text : colors.muted }]}>
                  {selectedCategory ? t(`categories.${categories.find(c => c.id === selectedCategory)?.sort_order}`) || categories.find(c => c.id === selectedCategory)?.name || t('createDeck.selectCategory') : t('createDeck.selectCategory')}
                </Text>
              </View>
              <PhosphorIcon icon={ICONS.dropdown} size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {/* Desteye Ait Dil Seçimi */}
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
              <PhosphorIcon icon={ICONS.language} size={21} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>
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

          <View
            style={[
              styles.buttonRowModern,
              {
                paddingBottom: isKeyboardVisible ? '20%' : '36%',
                marginBottom: Platform.OS === 'android' ? insets.bottom : 0,
              },
            ]}
          >
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

      <HowToCreateModal
        isVisible={isHowToCreateModalVisible}
        onClose={() => setHowToCreateModalVisible(false)}
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
    paddingTop: 4,
  },
  headerCard: {
    width: '100%',
    marginBottom: 12,
  },
  headerCardContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    marginHorizontal: 10,
    marginVertical: 8,
    paddingVertical: 10,
  },
  headerCardContent: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 6,
    minHeight: 160,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerContent: {
    paddingVertical: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextColumn: {
    flex: 1,
    marginRight: 12,
  },
  howToCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 12,
  },
  headerImageContainer: {
    width: 120,
    height: 120,
    marginLeft: 12,
  },
  headerImage: {
    width: 140,
    height: 140,
    alignSelf: 'flex-end',
    top: '-10%',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    
    marginBottom: 11,
  },
  labelTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    gap: 20,
    marginTop: 12,

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