import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, SafeAreaView, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import CategorySelector from '../../components/tools/CategorySelector';
import UndoButton from '../../components/tools/UndoButton';
import CreateButton from '../../components/tools/CreateButton';
import GlassBlurCard from '../../components/ui/GlassBlurCard';

export default function CreateScreen() {
  const [name, setName] = useState('');
  const [toName, setToName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);

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
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(t('create.error', 'Hata'), t('create.requiredName', 'Deste adı zorunludur.'));
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
        .select()
        .single();
      if (error) throw error;
      resetForm();
      navigation.navigate('DeckDetail', { deck: data });
    } catch (e) {
      Alert.alert(t('create.errorMessage', 'Hata'), e.message || t('create.error', 'Deste oluşturulamadı.'));
    } finally {
      setLoading(false);
    }
  };



  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          {/* GlassBlurCard Header */}
          <GlassBlurCard style={[styles.headerCard, { borderRadius: 28 }]}>
            <View style={styles.headerContent}>
              <View style={styles.headerTitleContainer}>
                <Iconify icon="fluent:tab-add-24-regular" size={26} color="#F98A21" style={{ marginRight: 6 }} />
                <Text style={[typography.styles.h2, { color: colors.text}]}>
                  {t('createDeck.title', 'Desteni Oluştur')}
                </Text>
              </View>
              <View style={styles.headerBottomRow}>
                <View style={styles.headerTextColumn}>
                  <Text style={[typography.styles.caption, { color: colors.muted, lineHeight: 22, flex: 1, alignSelf: 'flex-start' }]}>
                    {t('createDeck.motivationText', 'Kişiselleştirilmiş destelerle öğrenme yolculuğunu tasarla ve bilgini pekiştir.')}
                  </Text>
                  <TouchableOpacity 
                    style={styles.howToCreateButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      // TODO: Navigate to how-to-create screen
                      console.log('How to create pressed');
                    }}
                  >
                    <Iconify icon="material-symbols:info-outline" size={16} color={colors.secondary} style={{ marginRight: 4 }} />
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
          </GlassBlurCard>
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
              <Iconify icon="ion:book" size={20} color="#F98A21" style={styles.labelIcon} />
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 8, padding: 6, borderRadius: 12, backgroundColor: colors.iconBackground }}
                >
                  <Iconify icon="material-symbols:close-rounded" size={18} color={colors.muted} />
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
              <Iconify icon="icon-park-outline:translation" size={20} color="#F98A21" style={styles.labelIcon} />
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 8, padding: 6, borderRadius: 12, backgroundColor: colors.iconBackground }}
                >
                  <Iconify icon="material-symbols:close-rounded" size={18} color={colors.muted} />
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
              <Iconify icon="tabler:file-description-filled" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, { color: colors.text }]}>{t('create.description', 'Açıklama')}</Text>
              <Text style={[styles.optional, typography.styles.caption, { color: colors.muted }]}> ({t('create.optional', 'opsiyonel')})</Text>
            </View>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[
                  styles.input,
                  typography.styles.body,
                  { height: 120, textAlignVertical: 'top', color: colors.text, paddingRight: 40 },
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8}}
                  style={{ position: 'absolute', right: 8, top: 8, padding: 6, borderRadius: 12, backgroundColor: colors.iconBackground }}
                >
                  <Iconify icon="material-symbols:close-rounded" size={18} color={colors.muted} />
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
              <Iconify icon="mdi:category-plus-outline" size={21} color="#F98A21" style={styles.labelIcon} />
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
                    size={20}
                    color={selectedCategory ? colors.text : colors.muted}
                    style={styles.categoryIcon}
                  />
                )}
                <Text style={[styles.categoryText, typography.styles.body, { color: selectedCategory ? colors.text : colors.muted }]}>
                  {selectedCategory ? t(`categories.${categories.find(c => c.id === selectedCategory)?.sort_order}`) || categories.find(c => c.id === selectedCategory)?.name || t('createDeck.selectCategory') : t('createDeck.selectCategory')}
                </Text>
              </View>
              <Iconify icon="flowbite:caret-down-solid" size={20} color={colors.muted} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
  },
  headerCard: {
    width: '100%',
    marginBottom: 12,
  },
  headerContent: {
    paddingVertical: 8,
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
    shadowOffset: { width: 4, height: 6},
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',

  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
    gap: 8,
  },

  input: {
    borderWidth: 0.15,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 0,
    fontSize: 16,
  },

  buttonRowModern: {
    flexDirection: 'row',
    gap: 20,
    marginTop: "auto",
    marginBottom: 80,
  },

  optional: {
    marginLeft: 4,
    alignSelf: 'flex-end',
  },

  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0.15,
    borderRadius: 8,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    maxHeight: '70%',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  popupTitle: {
    textAlign: 'center',
    marginBottom: 20,
  },
  categoryList: {
    maxHeight: 300,
  },
  categoryItem: {
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  categoryItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryItemText: {
    flex: 1,
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 