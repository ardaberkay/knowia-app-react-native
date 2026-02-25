import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function CategorySelector({ isVisible, onClose, categories = [], selectedCategoryId, onSelectCategory }) {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const screenHeight = Dimensions.get('screen').height;

  // Marka Rengi Fallback
  const primaryColor = colors.buttonColor || colors.primary || '#F98A21';

  // Kategori ismini sort_order değerine göre çeviri ile al
  const getCategoryName = (category) => {
    return t(`categories.${category.sort_order}`, null);
  };

  // Kategori ikonunu sort_order değerine göre al
  const getCategoryIcon = (sortOrder) => {
    const icons = {
      1: "hugeicons:language-skill",
      2: "clarity:atom-solid",
      3: "mdi:math-compass",
      4: "game-icons:tied-scroll",
      5: "arcticons:world-geography-alt",
      6: "map:museum",
      7: "ic:outline-self-improvement",
      8: "garden:puzzle-piece-fill-16"
    };
    return icons[sortOrder] || "material-symbols:category";
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={300}
      animationOutTiming={300}
      backdropTransitionInTiming={300}
      backdropTransitionOutTiming={300}
      useNativeDriver
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      statusBarTranslucent={true}
      deviceHeight={screenHeight}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>
            {t('categorySelector.title')}
          </Text>
          <TouchableOpacity 
            onPress={onClose} 
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            style={styles.closeBtnWrapper}
          >
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {categories.map((category) => {
            const isSelected = selectedCategoryId === category.id;
            
            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: isSelected ? (isDarkMode ? `${primaryColor}20` : `${primaryColor}15`) : (isDarkMode ? '#2A2A2A' : '#F5F5F5'),
                    borderColor: isSelected ? primaryColor : 'transparent',
                  }
                ]}
                onPress={() => {
                  if (onSelectCategory) {
                    onSelectCategory(category.id);
                    onClose(); // Seçim yapıldıktan sonra modalı kapatmak UX açısından iyidir (opsiyonel)
                  }
                }}
                disabled={isSelected} // Zaten seçiliyse tekrar basılmasın
                activeOpacity={0.7}
              >
                <View style={styles.iconWrapper}>
                  <Iconify
                    icon={getCategoryIcon(category.sort_order)}
                    size={moderateScale(26)}
                    color={isSelected ? primaryColor : colors.text}
                  />
                </View>
                
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: isSelected ? primaryColor : colors.text,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {getCategoryName(category)}
                </Text>
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
    padding: scale(20),
    paddingBottom: verticalScale(32),
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(20),
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: moderateScale(6),
    borderRadius: 99,
  },
  scrollView: {
    maxHeight: verticalScale(420),
  },
  scrollContent: {
    gap: verticalScale(12),
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
  },
  iconWrapper: {
    marginRight: scale(14),
    // İkona hafif bir derinlik
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  categoryText: {
    fontSize: moderateScale(16),
    flex: 1,
  },
});