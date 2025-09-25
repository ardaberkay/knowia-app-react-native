import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, SafeAreaView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import { LinearGradient } from 'expo-linear-gradient';
import CategorySelector from '../../components/tools/CategorySelector';

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
      1: "famicons:language", // Dil
      2: "healthicons:life-science", // Bilim
      3: "mdi:math-compass", // Matematik
      4: "game-icons:tied-scroll", // Tarih
      5: "arcticons:world-geography-alt", // Coğrafya
      6: "map:museum", // Sanat ve Kültür
      7: "ic:outline-self-improvement", // Kişisel Gelişim
      8: "hugeicons:knowledge-01" // Genel Kültür
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
              <Iconify icon="material-symbols:category-outline-rounded" size={21} color="#F98A21" style={styles.labelIcon} />
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
            <TouchableOpacity
              style={[
                styles.undoButton,
                { borderColor: colors.border }
              ]}
              onPress={resetForm}
              disabled={loading}
            >
              <Text style={[styles.undoButtonText, { color: colors.text }]}>{t('create.removeChanges', 'Geri Al')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreate}
              disabled={loading}
            >
              <LinearGradient
                colors={['#F98A21', '#FF6B35']}
                locations={[0, 0.99]}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.createButtonText}>{loading ? t('create.creating', 'Oluşturuluyor...') : t('create.create', 'Oluştur')}</Text>
              </LinearGradient>
            </TouchableOpacity>
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
    paddingTop: 16,
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
  },
  undoButton: {
    flex: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  createButton: {
    flex: 2,
    borderRadius: 99,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  gradientButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 99,
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