import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Platform, Dimensions, LayoutAnimation, UIManager } from 'react-native';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Modal from 'react-native-modal';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
        size={moderateScale(24)}
        color={isLight ? '#fff' : colors.subtext}
      />
    </TouchableOpacity>
  );
};

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

const customLayoutAnimation = {
  duration: 200,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

const FilterModal = ({
  visible,
  onClose,
  currentSort,
  currentCategories,
  currentLanguages = [],
  languages = [],
  onApply,
  showSortOptions = true,
  sortOptions: customSortOptions,
  defaultSort = 'default',
  hideFavorites = false,
}) => {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const screenHeight = Dimensions.get('screen').height;
  
  const primaryColor = colors.buttonColor || colors.primary || '#F98A21';
  const selectedBgColor = isDarkMode ? `${primaryColor}20` : '#FFF4EA';

  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);

  const [tempSort, setTempSort] = useState(currentSort || defaultSort);
  const [tempCategories, setTempCategories] = useState(currentCategories || []);
  const [tempLanguages, setTempLanguages] = useState(currentLanguages || []);

  useEffect(() => {
    if (visible) {
      setTempSort(currentSort || defaultSort);
      setTempCategories(currentCategories || []);
      setTempLanguages(currentLanguages || []);
    }
  }, [visible]);

  const toggleSort = () => {
    LayoutAnimation.configureNext(customLayoutAnimation);
    setIsSortOpen(prev => !prev);
  };

  const toggleCategory = () => {
    LayoutAnimation.configureNext(customLayoutAnimation);
    setIsCategoryOpen(prev => !prev);
  };

  const toggleLanguage = () => {
    LayoutAnimation.configureNext(customLayoutAnimation);
    setIsLanguageOpen(prev => !prev);
  };

  const handleLanguageToggle = (langId) => {
    setTempLanguages(prev => {
      if (prev.includes(langId)) return prev.filter(lang => lang !== langId);
      return [...prev, langId];
    });
  };

  const handleCategoryToggle = (categoryKey) => {
    setTempCategories(prev => {
      if (prev.includes(categoryKey)) return prev.filter(cat => cat !== categoryKey);
      return [...prev, categoryKey];
    });
  };

  const handleApply = () => {
    if (showSortOptions) onApply(tempSort, tempCategories, tempLanguages);
    else onApply(tempCategories, tempLanguages);
  };

  const handleReset = () => {
    if (showSortOptions) onApply(defaultSort, []);
    else onApply([]);
  };

  const defaultSortOptions = [
    { key: 'default', label: t('common.defaultSort', 'Varsayılan (En Yeniler)') },
    { key: 'az', label: 'A-Z' },
    { key: 'favorites', label: t('common.favorites', 'Favoriler') },
    { key: 'popularity', label: t('discover.sortPopularity', 'Popülerlik') },
  ];

  let sortOptions = customSortOptions || defaultSortOptions;
  if (hideFavorites) {
    sortOptions = sortOptions.filter(opt => opt.key !== 'favorites');
  }
  const selectedSortLabel = sortOptions.find(opt => opt.key === tempSort)?.label || sortOptions[0].label;
  const categoryOptions = getCategoryOptions(t);

  // Çoklu seçim (Kategori & Dil) için Kare Checkbox
  const CheckboxSquare = ({ isSelected }) => (
    <View style={[
      styles.checkboxSquare, 
      { 
        borderColor: isSelected ? primaryColor : (isDarkMode ? '#555' : '#CCC'),
        backgroundColor: isSelected ? primaryColor : 'transparent'
      }
    ]}>
      {isSelected && <Iconify icon="hugeicons:tick-01" size={moderateScale(16)} color="#FFF" />}
    </View>
  );

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
      statusBarTranslucent={true}
      deviceHeight={screenHeight}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.headerLeft}>
            <Iconify icon="si:filter-list-alt-fill" size={moderateScale(28)} color={colors.text} />
            <Text style={[typography.styles.h2, { color: colors.text, fontSize: moderateScale(22) }]}>
              {t('common.filters', 'Filtreler')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            style={styles.closeBtnWrapper}
          >
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          
          {/* Sıralama Bölümü - Tekli Seçim */}
          {showSortOptions && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.headerAccent, { backgroundColor: primaryColor }]} />
                <Iconify icon="lucide:sort-asc" size={moderateScale(20)} color={colors.text} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('common.sortBy', 'Sıralama')}
                </Text>
              </View>

              <TouchableOpacity
                onPress={toggleSort}
                style={[styles.accordionHeader, { borderColor: colors.border, backgroundColor: isDarkMode ? '#222' : '#F9FAFB' }]}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                  <Text style={[styles.accordionHeaderText, { color: colors.text, fontWeight: '600' }]}>
                    {selectedSortLabel}
                  </Text>
                </View>
                <Iconify icon={isSortOpen ? 'flowbite:caret-up-solid' : 'flowbite:caret-down-solid'} size={moderateScale(20)} color={colors.text} />
              </TouchableOpacity>

              {isSortOpen && (
                <View style={styles.optionsList}>
                  {sortOptions.map((option) => {
                    const isSelected = tempSort === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        onPress={() => {
                          setTempSort(option.key);
                        }}
                        style={[
                          styles.optionCard,
                          {
                            backgroundColor: isSelected ? selectedBgColor : (isDarkMode ? '#2A2A2A' : '#FFFFFF'),
                            borderColor: isSelected ? primaryColor : (isDarkMode ? '#333' : '#EEE'),
                          }
                        ]}
                        activeOpacity={1}
                      >
                        <View style={styles.optionCardLeft}>
                          <Text style={[
                            styles.optionCardText,
                            {
                              color: isSelected ? primaryColor : colors.text,
                              fontWeight: isSelected ? '700' : '500'
                            }
                          ]}>
                            {option.label}
                          </Text>
                        </View>
                        {/* Tekli seçim olduğu için sağ taraftaki tik kaldırıldı */}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Kategori Bölümü - Çoklu Seçim */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.headerAccent, { backgroundColor: primaryColor }]} />
              <Iconify icon="material-symbols:category-search-rounded" size={moderateScale(20)} color={colors.text} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('common.categories', 'Kategoriler')}
              </Text>
            </View>
            
            <TouchableOpacity
              onPress={toggleCategory}
              style={[styles.accordionHeader, { borderColor: colors.border, backgroundColor: isDarkMode ? '#222' : '#F9FAFB' }]}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                <Text style={[styles.accordionHeaderText, { color: colors.text }]}>
                  {t('common.selectCategories', 'Kategorileri Seç')}
                </Text>
                {tempCategories.length > 0 && (
                  <View style={[styles.badgePill, { backgroundColor: primaryColor }]}>
                    <Text style={styles.badgePillText}>{tempCategories.length}</Text>
                  </View>
                )}
              </View>
              <Iconify icon={isCategoryOpen ? 'flowbite:caret-up-solid' : 'flowbite:caret-down-solid'} size={moderateScale(20)} color={colors.text} />
            </TouchableOpacity>

            {isCategoryOpen && (
              <View style={styles.optionsList}>
                {categoryOptions.map((option) => {
                  const isSelected = tempCategories.includes(option.sortOrder);
                  
                  return (
                    <TouchableOpacity
                      key={option.sortOrder}
                      onPress={() => handleCategoryToggle(option.sortOrder)}
                      style={[
                        styles.optionCard,
                        {
                          backgroundColor: isSelected ? selectedBgColor : (isDarkMode ? '#2A2A2A' : '#FFFFFF'),
                          borderColor: isSelected ? primaryColor : (isDarkMode ? '#333' : '#EEE'),
                        }
                      ]}
                      activeOpacity={1} 
                    >
                      <View style={styles.optionCardLeft}>
                        <View style={styles.optionIconWrapper}>
                          <Iconify icon={option.icon} size={moderateScale(22)} color={isSelected ? primaryColor : colors.text} />
                        </View>
                        <Text style={[
                          styles.optionCardText,
                          {
                            color: isSelected ? primaryColor : colors.text,
                            fontWeight: isSelected ? '700' : '500'
                          }
                        ]}>
                          {option.label}
                        </Text>
                      </View>
                      
                      <CheckboxSquare isSelected={isSelected} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Dil Bölümü - Çoklu Seçim */}
          <View style={[styles.section, { marginBottom: verticalScale(20) }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.headerAccent, { backgroundColor: primaryColor }]} />
              <Iconify icon="fa:language" size={moderateScale(20)} color={colors.text} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('create.language', 'İçerik Dili')}
              </Text>
            </View>

            <TouchableOpacity
              onPress={toggleLanguage}
              style={[styles.accordionHeader, { borderColor: colors.border, backgroundColor: isDarkMode ? '#222' : '#F9FAFB' }]}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                <Text style={[styles.accordionHeaderText, { color: colors.text }]}>
                  {t('common.selectLanguages', 'Dil Seç')}
                </Text>
                {tempLanguages.length > 0 && (
                  <View style={[styles.badgePill, { backgroundColor: primaryColor }]}>
                    <Text style={styles.badgePillText}>{tempLanguages.length}</Text>
                  </View>
                )}
              </View>
              <Iconify icon={isLanguageOpen ? 'flowbite:caret-up-solid' : 'flowbite:caret-down-solid'} size={moderateScale(20)} color={colors.text} />
            </TouchableOpacity>

            {isLanguageOpen && (
              <View style={styles.optionsList}>
                {languages.map((lang) => {
                  const isSelected = tempLanguages.includes(lang.id);
                  
                  return (
                    <TouchableOpacity
                      key={lang.id}
                      onPress={() => handleLanguageToggle(lang.id)}
                      style={[
                        styles.optionCard,
                        {
                          backgroundColor: isSelected ? selectedBgColor : (isDarkMode ? '#2A2A2A' : '#FFFFFF'),
                          borderColor: isSelected ? primaryColor : (isDarkMode ? '#333' : '#EEE'),
                        }
                      ]}
                      activeOpacity={1}
                    >
                      <View style={styles.optionCardLeft}>
                        <Text style={[
                          styles.optionCardText,
                          {
                            color: isSelected ? primaryColor : colors.text,
                            fontWeight: isSelected ? '700' : '500'
                          }
                        ]}>
                          {t(`languages.${lang.sort_order}`, lang.name)}
                        </Text>
                      </View>
                      
                      <CheckboxSquare isSelected={isSelected} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer Buttons */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.resetButton, { borderColor: colors.border }]}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Text style={[styles.resetButtonText, { color: colors.text }]}>
              {t('common.reset', 'Sıfırla')}
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
                {t('common.apply', 'Uygula')}
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
    borderRadius: moderateScale(32),
    paddingHorizontal: scale(12),
    borderWidth: 1,
    height: verticalScale(46),
    width: scale(46),
  },
  modalContainer: {
    borderRadius: moderateScale(32),
    padding: 0,
    maxHeight: '85%',
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(18),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: moderateScale(6),
    borderRadius: 99,
  },
  modalContent: {
    paddingHorizontal: scale(20),
  },
  section: {
    marginBottom: verticalScale(28),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(14),
  },
  headerAccent: {
    width: moderateScale(4),
    height: verticalScale(18),
    borderRadius: moderateScale(2),
    marginRight: scale(8),
  },
  sectionTitle: {
    fontSize: moderateScale(17),
    fontWeight: '700',
    marginLeft: scale(6),
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(12),
    borderWidth: 1,
  },
  accordionHeaderText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  badgePill: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: 99,
  },
  badgePillText: {
    color: '#FFF',
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  optionsList: {
    marginTop: verticalScale(12),
    gap: verticalScale(10),
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(12),
    borderWidth: 1,
  },
  optionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Yazının ortalanmasını daha temiz yapar
  },
  optionIconWrapper: {
    marginRight: scale(12),
  },
  optionCardText: {
    fontSize: moderateScale(15),
  },
  checkboxSquare: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: moderateScale(6), 
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    borderTopWidth: moderateScale(1),
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  resetButton: {
    flex: 1,
    borderRadius: 99,
    borderWidth: moderateScale(1.5),
    backgroundColor: 'transparent',
    paddingVertical: verticalScale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    borderRadius: 99,
    overflow: 'hidden',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: verticalScale(4) },
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(8),
    elevation: 4,
  },
  gradientButton: {
    paddingVertical: verticalScale(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default FilterModal;