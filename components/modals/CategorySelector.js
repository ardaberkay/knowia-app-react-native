import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Text } from '../ui/AppText';

// ETKİLEŞİMLİ BİLEŞENLER
import { BottomSheetModal, BottomSheetFlatList } from '@expo/ui/community/bottom-sheet';
// Lists open at half height and drag up to full (iOS medium/large detents,
// Android partial/expanded).
const LIST_SNAP_POINTS = ['50%', '100%'];

import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';


export default function CategorySelector({ isVisible, onClose, categories = [], selectedCategoryId, onSelectCategory }) {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const primaryColor = colors.buttonColor || colors.primary || '#F98A21';
  const bottomSheetModalRef = useRef(null);

  useEffect(() => {
    if (isVisible) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [isVisible]);

  const handleSheetChanges = useCallback((index) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  // --- ORİJİNAL FONKSİYONLARIN (KORUNDU) ---
  const getCategoryName = (category) => t(`categories.${category.sort_order}`, null);

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

  const renderItem = useCallback(({ item: category }) => {
    const isSelected = selectedCategoryId === category.id;

    return (
      <TouchableOpacity
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
            bottomSheetModalRef.current?.dismiss();
          }
        }}
        disabled={isSelected}
        activeOpacity={0.7}
      >
        <View style={styles.iconWrapper}>
          <Iconify
            icon={getCategoryIcon(category.sort_order)}
            size={26}
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
  }, [selectedCategoryId, onSelectCategory, primaryColor, colors.text, isDarkMode]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      onChange={handleSheetChanges}
      // Radius ve Arka Plan
      backgroundStyle={{
        backgroundColor: colors.background,
        borderRadius: 44
      }}

      snapPoints={LIST_SNAP_POINTS}

      enablePanDownToClose
    >

      {/* --- SABİT HEADER (LİSTENİN DIŞINDA) --- */}
      <View style={[styles.fixedHeader, {
        backgroundColor: colors.background, borderTopLeftRadius: 44,
        borderTopRightRadius: 44
      }]}>
        <Text style={[typography.styles.h2, { color: colors.text }]}>
          {t('categorySelector.title')}
        </Text>
        <TouchableOpacity
          onPress={() => bottomSheetModalRef.current?.dismiss()}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          style={styles.closeBtnWrapper}
        >
          <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* --- SCROLL EDİLEBİLİR LİSTE --- */}
      <BottomSheetFlatList
        data={categories}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        nestedScrollEnabled={true}
        style={{ flex: 1 }}
      />

    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 60,
    gap: 12,
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: 6,
    borderRadius: 99,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  iconWrapper: {
    marginRight: 14,
  },
  categoryText: {
    fontSize: 16,
    flex: 1,
  },
});