import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Platform, Modal as RNModal, TouchableWithoutFeedback } from 'react-native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Modal from 'react-native-modal';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';

// Filter Modal Button Component
export const FilterModalButton = ({ onPress, variant = 'default' }) => {
  const { colors } = useTheme();
  
  const isLight = variant === 'light';
  
  return (
    <TouchableOpacity
      style={[
        styles.filterIconButton, 
        { borderColor: isLight ? 'rgba(255, 255, 255, 0.3)' : colors.border }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Iconify 
        icon="mage:filter" 
        size={24} 
        color={isLight ? '#fff' : colors.subtext} 
      />
    </TouchableOpacity>
  );
};

// Category Options - shared across all filter modals
const getCategoryOptions = (t) => [
  { sortOrder: 1, label: t('categories.1', 'Dil'), icon: 'hugeicons:language-skill' },
  { sortOrder: 2, label: t('categories.2', 'Bilim'), icon: 'clarity:atom-solid' },
  { sortOrder: 3, label: t('categories.3', 'Matematik'), icon: 'mdi:math-compass' },
  { sortOrder: 4, label: t('categories.4', 'Tarih'), icon: 'game-icons:tied-scroll' },
  { sortOrder: 5, label: t('categories.5', 'Coğrafya'), icon: 'arcticons:world-geography-alt' },
  { sortOrder: 6, label: t('categories.6', 'Sanat ve Kültür'), icon: 'map:museum' },
  { sortOrder: 7, label: t('categories.7', 'Kişisel Gelişim'), icon: 'ic:outline-self-improvement' },
  { sortOrder: 8, label: t('categories.8', 'Genel Kültür'), icon: 'garden:puzzle-piece-fill-16' },
];

// Main Filter Modal Component
const FilterModal = ({ 
  visible, 
  onClose, 
  currentSort, 
  currentCategories, 
  onApply, 
  showSortOptions = true,
  sortOptions: customSortOptions,
  defaultSort = 'default',
  hideFavorites = false,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  const [tempSort, setTempSort] = useState(currentSort || defaultSort);
  const [tempCategories, setTempCategories] = useState(currentCategories || []);
  const [sortDropdownVisible, setSortDropdownVisible] = useState(false);
  const sortDropdownRef = useRef(null);
  const [sortDropdownPos, setSortDropdownPos] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    setTempSort(currentSort || defaultSort);
    setTempCategories(currentCategories || []);
  }, [visible, currentSort, currentCategories, defaultSort]);

  const handleCategoryToggle = (categoryKey) => {
    setTempCategories(prev => {
      if (prev.includes(categoryKey)) {
        return prev.filter(cat => cat !== categoryKey);
      }
      return [...prev, categoryKey];
    });
  };

  const handleApply = () => {
    if (showSortOptions) {
      onApply(tempSort, tempCategories);
    } else {
      onApply(tempCategories);
    }
  };

  const handleReset = () => {
    if (showSortOptions) {
      onApply(defaultSort, []);
    } else {
      onApply([]);
    }
  };

  // Default sort options
  const defaultSortOptions = [
    { key: 'default', label: t('common.defaultSort', 'Varsayılan (En Yeniler)') },
    { key: 'az', label: 'A-Z' },
    { key: 'favorites', label: t('common.favorites', 'Favoriler') },
    { key: 'popularity', label: t('discover.sortPopularity', 'Popülerlik') },
  ];

  let sortOptions = customSortOptions || defaultSortOptions;
  // Filter out 'favorites' option if hideFavorites is true
  if (hideFavorites) {
    sortOptions = sortOptions.filter(opt => opt.key !== 'favorites');
  }
  const selectedSortLabel = sortOptions.find(opt => opt.key === tempSort)?.label || sortOptions[0].label;
  const categoryOptions = getCategoryOptions(t);

  const openSortDropdown = () => {
    if (sortDropdownRef.current && sortDropdownRef.current.measureInWindow) {
      sortDropdownRef.current.measureInWindow((x, y, width, height) => {
        setSortDropdownPos({ x, y, width, height });
        setSortDropdownVisible(true);
      });
    } else {
      setSortDropdownVisible(true);
    }
  };

  const handleSortSelect = (sortKey) => {
    setTempSort(sortKey);
    setSortDropdownVisible(false);
  };

  // Title based on whether we show sort options
  const modalTitle = showSortOptions ? t('common.filters') : t('common.categories');

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      useNativeDriver
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      backdropTransitionOutTiming={0}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>
            {modalTitle}
          </Text>
          <TouchableOpacity 
            onPress={onClose} 
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Sıralama Bölümü */}
          {showSortOptions && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('common.sortBy')}
              </Text>
              <TouchableOpacity
                ref={sortDropdownRef}
                onPress={openSortDropdown}
                style={[styles.sortDropdown, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.sortDropdownText, { color: colors.text }]}>
                  {selectedSortLabel}
                </Text>
                <Iconify icon="flowbite:caret-down-solid" size={20} color={colors.text} />
              </TouchableOpacity>

              {/* Dropdown Menu */}
              <RNModal
                visible={sortDropdownVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSortDropdownVisible(false)}
              >
                <TouchableWithoutFeedback onPress={() => setSortDropdownVisible(false)}>
                  <View style={{ flex: 1 }}>
                    <View style={[
                      styles.sortDropdownMenu,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        left: sortDropdownPos.x,
                        top: Platform.OS === 'android' ? sortDropdownPos.y + sortDropdownPos.height : sortDropdownPos.y + sortDropdownPos.height + 4,
                        minWidth: sortDropdownPos.width,
                      }
                    ]}>
                      {sortOptions.map((option) => (
                        <TouchableOpacity
                          key={option.key}
                          onPress={() => handleSortSelect(option.key)}
                          style={[
                            styles.sortDropdownItem,
                            tempSort === option.key && { backgroundColor: colors.buttonColor + '20' }
                          ]}
                        >
                          <Text style={[
                            styles.sortDropdownItemText,
                            { 
                              color: tempSort === option.key ? colors.buttonColor : colors.text,
                              fontWeight: tempSort === option.key ? '600' : 'normal'
                            }
                          ]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </RNModal>
            </View>
          )}

          {/* Kategori Bölümü */}
          <View style={styles.section}>
            <Text style={[
              showSortOptions ? styles.sectionTitle : styles.sectionSubtitle, 
              { color: showSortOptions ? colors.text : colors.subtext }
            ]}>
              {showSortOptions ? t('common.categories') : t('common.selectCategories', 'Görmek istediğiniz kategorileri seçin')}
            </Text>
            {categoryOptions.map((option) => {
              const isSelected = tempCategories.includes(option.sortOrder);
              return (
                <TouchableOpacity
                  key={option.sortOrder}
                  onPress={() => handleCategoryToggle(option.sortOrder)}
                  style={[
                    styles.categoryOption,
                    isSelected && { backgroundColor: colors.buttonColor + '20' }
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryOptionContent}>
                    <View style={[
                      styles.checkbox,
                      { 
                        borderColor: isSelected ? colors.buttonColor : colors.border,
                        backgroundColor: isSelected ? colors.buttonColor : 'transparent'
                      }
                    ]}>
                      {isSelected && (
                        <Iconify icon="hugeicons:tick-01" size={18} color="#fff" />
                      )}
                    </View>
                    <Iconify 
                      icon={option.icon} 
                      size={22} 
                      color={isSelected ? colors.buttonColor : colors.text}
                      style={styles.categoryIcon}
                    />
                    <Text style={[
                      styles.categoryOptionText,
                      { 
                        color: isSelected ? colors.buttonColor : colors.text,
                        fontWeight: isSelected ? '600' : 'normal'
                      }
                    ]}>
                      {option.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Footer Buttons */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.resetButton, { borderColor: colors.border }]}
            onPress={handleReset}
            activeOpacity={0.8}
          >
            <Text style={[styles.resetButtonText, { color: colors.text }]}>
              {t('common.reset')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApply}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#F98A21', '#FF6B35']}
              locations={[0, 0.99]}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.applyButtonText}>
                {t('common.apply')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  filterIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    height: 48,
    width: 48,
  },
  modalContainer: {
    borderRadius: 24,
    padding: 0,
    maxHeight: '80%',
    width: '98%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...typography.styles.h3,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  sortDropdownText: {
    fontSize: 16,
    flex: 1,
  },
  sortDropdownMenu: {
    position: 'absolute',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    maxHeight: 200,
  },
  sortDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sortDropdownItemText: {
    fontSize: 16,
  },
  categoryOption: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIcon: {
    marginRight: 12,
  },
  categoryOptionText: {
    fontSize: 16,
    flex: 1,
  },
  modalFooter: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  resetButton: {
    flex: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  applyButton: {
    flex: 2,
    borderRadius: 99,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  gradientButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 99,
  },
  applyButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

export default FilterModal;
