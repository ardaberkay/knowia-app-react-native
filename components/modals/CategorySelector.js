import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

// ETKİLEŞİMLİ BİLEŞENLER
import { 
  BottomSheetModal, 
  BottomSheetFlatList, 
  BottomSheetBackdrop,
  TouchableOpacity 
} from '@gorhom/bottom-sheet';

import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function CategorySelector({ isVisible, onClose, categories = [], selectedCategoryId, onSelectCategory }) {
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

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close" 
        opacity={0.5}
      />
    ),
    []
  );

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
  }, [selectedCategoryId, onSelectCategory, primaryColor, colors.text, isDarkMode]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      // Radius ve Arka Plan
      backgroundStyle={{ 
        backgroundColor: colors.background,
        borderRadius: moderateScale(44) 
      }}
      handleIndicatorStyle={{ backgroundColor: isDarkMode ? '#666' : '#CCC' }}
      
      // Dinamik Boyutlandırma ve Scroll Ayarları
      enableDynamicSizing={true} 
      maxDynamicContentSize={SCREEN_HEIGHT * 0.6} 
      enableContentPanningGesture={false} 
    >
      
      {/* --- SABİT HEADER (LİSTENİN DIŞINDA) --- */}
      <View style={[styles.fixedHeader, { backgroundColor: colors.background }]}>
        <Text style={[typography.styles.h2, { color: colors.text }]}>
          {t('categorySelector.title')}
        </Text>
        <TouchableOpacity 
          onPress={() => bottomSheetModalRef.current?.dismiss()} 
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          style={styles.closeBtnWrapper}
        >
          <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
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
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(15),
    paddingBottom: verticalScale(40), 
    gap: verticalScale(12),
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: moderateScale(6),
    borderRadius: 99,
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
  },
  categoryText: {
    fontSize: moderateScale(16),
    flex: 1,
  },
});