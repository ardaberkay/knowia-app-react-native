import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { Text } from '../ui/AppText';

// ETKİLEŞİMLİ BİLEŞENLER
import { BottomSheetModal, BottomSheetFlatList } from '@expo/ui/community/bottom-sheet';

import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { getCategoryIcon } from '../../theme/colors';


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
            icon={getCategoryIcon(category.sort_order, { picker: true })}
            size={26}
            color={isSelected ? primaryColor : colors.text}
          />
        </View>

        <Text
          style={[
            styles.categoryText,
            {
              color: isSelected ? primaryColor : colors.text,
              fontFamily: isSelected ? fonts.bold : fonts.medium,
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
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
      enablePanDownToClose
    >
      <View style={{ maxHeight: Math.round(SCREEN_HEIGHT * 0.75) }}>

      {/* --- SABİT HEADER (LİSTENİN DIŞINDA) --- */}
      <View style={styles.fixedHeader}>
        <Text style={[typography.styles.title2, { color: colors.text }]}>
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
        style={{ flexGrow: 0, flexShrink: 1 }}
      />

      </View>
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
    paddingBottom: 24,
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
    fontSize: fontSizes.body,
    flex: 1,
  },
});