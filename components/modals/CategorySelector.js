import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function CategorySelector({ isVisible, onClose, categories = [], selectedCategoryId, onSelectCategory }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const screenHeight = Dimensions.get('screen').height;

  // Kategori ismini sort_order değerine göre çeviri ile al
  const getCategoryName = (category) => {
    // sort_order değerini kullanarak çeviri al
    const translation = t(`categories.${category.sort_order}`, null);
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

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      useNativeDriver
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      backdropTransitionOutTiming={0}
      statusBarTranslucent={true}
      deviceHeight={screenHeight}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>{t('categorySelector.title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}>
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: verticalScale(420), height: verticalScale(420) }} showsVerticalScrollIndicator={false}>
          {categories.map((category) => {
            const isSelected = selectedCategoryId === category.id;
            return (
              <TouchableOpacity
                key={category.id}
                style={[styles.categoryOption, isSelected && { backgroundColor: colors.iconBackground, borderRadius: moderateScale(8) }]}
                onPress={() => onSelectCategory && onSelectCategory(category.id)}
              >
                <View style={styles.categoryRow}>
                  <Iconify
                    icon={getCategoryIcon(category.sort_order)}
                    size={moderateScale(26)}
                    color={isSelected ? colors.secondary : colors.text}
                    style={styles.categoryIcon}
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      {
                        color: isSelected ? colors.secondary : colors.text,
                        fontWeight: isSelected ? 'bold' : 'normal',
                      },
                    ]}
                  >
                    {getCategoryName(category)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    borderRadius: moderateScale(32),
    padding: scale(24),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(16),
  },
  categoryOption: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(6),
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    marginRight: scale(12),
  },
  categoryText: {
    fontSize: moderateScale(16),
    flex: 1,
  },
});
