import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { Text } from '../ui/AppText';
import { useTheme } from '../../theme/theme';
import { BottomSheetModal, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import PhosphorIcon from '../ui/PhosphorIcon';
import { getCategoryIcon, ICONS } from '../../theme/icons';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { triggerHaptic } from '../../lib/hapticManager';
import { languageCode, languageNativeName, languageEnglishName } from '../../services/LanguageService';


export const FilterModalButton = ({ onPress, variant }) => {
  const { colors, isDarkMode } = useTheme();

  // Şalterimiz: Eğer variant="light" gönderildiyse beyaz/cam moduna geç
  const isLight = variant === 'light';

  const borderColor = isLight ? 'rgba(255, 255, 255, 0.3)' : (isDarkMode ? '#4A4A4A' : 'rgba(0, 0, 0, 0.08)');
  const iconColor = isLight ? '#ffffff' : (isDarkMode ? '#ffffff' : colors.subtext);

  // Arama çubuğu ile birebir aynı arka plan dolgu mantığı:
  const backgroundColor = isLight 
    ? 'rgba(255, 255, 255, 0.15)' // Cam efekti (renkli alanlar için %15 beyaz)
    : (isDarkMode 
        ? 'rgba(255, 255, 255, 0.05)' // Karanlık mod (%5 hafif beyaz dolgu)
        : 'rgba(0, 0, 0, 0.03)');     // Açık mod (%3 hafif koyu dolgu)

  return (
    <TouchableOpacity
      style={[
        styles.filterIconButton,
        { 
          borderColor,
          backgroundColor
        }
      ]}
      onPress={() => {
        triggerHaptic('light');
        requestAnimationFrame(() => {
          onPress();
        });
      }}
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
      activeOpacity={0.8}
    >
      <PhosphorIcon
        icon={ICONS.filterSheet}
        size={24}
        color={iconColor}
      />
    </TouchableOpacity>
  );
};

const getCategoryOptions = (t) =>
  [1, 2, 3, 4, 5, 6, 7, 8].map((sortOrder) => ({
    sortOrder,
    label: t(`categories.${sortOrder}`),
    icon: getCategoryIcon(sortOrder),
  }));

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
  hideAz = false,
}) => {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const SHEET_MAX_HEIGHT = Math.round(SCREEN_HEIGHT * 0.85);
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  
  const primaryColor = colors.buttonColor || colors.primary || '#F98A21';
  const selectedBgColor = isDarkMode ? `${primaryColor}20` : '#FFF4EA';

  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);

  const [tempSort, setTempSort] = useState(currentSort || defaultSort);
  const [tempCategories, setTempCategories] = useState(currentCategories || []);
  const [tempLanguages, setTempLanguages] = useState(currentLanguages || []);

  

  // Native sheet: SwiftUI sheet on iOS, Material ModalBottomSheet on Android.
  const sheetRef = useRef(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    if (visible) {
      setTempSort(currentSort || defaultSort);
      setTempCategories(currentCategories || []);
      setTempLanguages(currentLanguages || []);
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);
  // Swipe/backdrop dismiss tells the parent; skipped when the parent closed it.
  const handleSheetDismiss = () => {
    if (visibleRef.current) onClose();
  };

  // İç animasyonlar kaldırıldı, sadece state değişecek
  const toggleSort = () => setIsSortOpen(prev => !prev);
  const toggleCategory = () => setIsCategoryOpen(prev => !prev);
  const toggleLanguage = () => setIsLanguageOpen(prev => !prev);

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
  if (hideAz) {
    sortOptions = sortOptions.filter(opt => opt.key !== 'az');
  }
  const selectedSortLabel = sortOptions.find(opt => opt.key === tempSort)?.label || sortOptions[0].label;
  const categoryOptions = getCategoryOptions(t);

  const CheckboxSquare = ({ isSelected }) => (
    <View style={[
      styles.checkboxSquare, 
      { 
        borderColor: isSelected ? primaryColor : (isDarkMode ? '#555' : '#CCC'),
        backgroundColor: isSelected ? primaryColor : 'transparent'
      }
    ]}>
      {isSelected && <PhosphorIcon icon={ICONS.check} size={16} color="#FFF" />}
    </View>
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={handleSheetDismiss}
      enablePanDownToClose
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
    >
      <BottomSheetView style={[styles.sheetContent, { maxHeight: SHEET_MAX_HEIGHT }]}>
          
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <PhosphorIcon icon={ICONS.filterSheet} size={28} color={colors.text} />
              <Text style={[typography.styles.title2, { color: colors.text, fontSize: fontSizes.title2 }]}>
                {t('common.filters', 'Filtreler')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              style={styles.closeBtnWrapper}
            >
              <PhosphorIcon icon={ICONS.close} size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            
            {/* Sıralama Bölümü */}
            {showSortOptions && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.headerAccent, { backgroundColor: primaryColor }]} />
                  <PhosphorIcon icon={ICONS.sort} size={20} color={colors.text} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('common.sortBy', 'Sıralama')}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={toggleSort}
                  style={[styles.accordionHeader, { borderColor: colors.border, backgroundColor: isDarkMode ? '#222' : '#F9FAFB' }]}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.accordionHeaderText, { color: colors.text, fontFamily: fonts.semibold }]}>
                      {selectedSortLabel}
                    </Text>
                  </View>
                  <PhosphorIcon icon={isSortOpen ? ICONS.dropdownOpen : ICONS.dropdown} size={20} color={colors.text} />
                </TouchableOpacity>

                {isSortOpen && (
                  <View style={styles.optionsList}>
                    {sortOptions.map((option) => {
                      const isSelected = tempSort === option.key;
                      return (
                        <TouchableOpacity
                          key={option.key}
                          onPress={() => {
                            triggerHaptic('light');
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
                                fontFamily: isSelected ? fonts.bold : fonts.medium
                              }
                            ]}>
                              {option.label}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Kategori Bölümü */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.headerAccent, { backgroundColor: primaryColor }]} />
                <PhosphorIcon icon={ICONS.category} size={20} color={colors.text} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('common.categories', 'Kategoriler')}
                </Text>
              </View>
              
              <TouchableOpacity
                onPress={toggleCategory}
                style={[styles.accordionHeader, { borderColor: colors.border, backgroundColor: isDarkMode ? '#222' : '#F9FAFB' }]}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.accordionHeaderText, { color: colors.text }]}>
                    {t('common.selectCategories', 'Kategorileri Seç')}
                  </Text>
                  {tempCategories.length > 0 && (
                    <View style={[styles.badgePill, { backgroundColor: primaryColor }]}>
                      <Text style={styles.badgePillText}>{tempCategories.length}</Text>
                    </View>
                  )}
                </View>
                <PhosphorIcon icon={isCategoryOpen ? ICONS.dropdownOpen : ICONS.dropdown} size={20} color={colors.text} />
              </TouchableOpacity>

              {isCategoryOpen && (
                <View style={styles.optionsList}>
                  {categoryOptions.map((option) => {
                    const isSelected = tempCategories.includes(option.sortOrder);
                    
                    return (
                      <TouchableOpacity
                        key={option.sortOrder}
                        onPress={() => {
                            triggerHaptic('light');
                            handleCategoryToggle(option.sortOrder);
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
                          <View style={styles.optionIconWrapper}>
                            <PhosphorIcon icon={option.icon} size={22} color={isSelected ? primaryColor : colors.text} />
                          </View>
                          <Text style={[
                            styles.optionCardText,
                            {
                              color: isSelected ? primaryColor : colors.text,
                              fontFamily: isSelected ? fonts.bold : fonts.medium
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

            {/* Dil Bölümü */}
            <View style={[styles.section, { marginBottom: 20 }]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.headerAccent, { backgroundColor: primaryColor }]} />
                <PhosphorIcon icon={ICONS.language} size={20} color={colors.text} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('create.language', 'İçerik Dili')}
                </Text>
              </View>

              <TouchableOpacity
                onPress={toggleLanguage}
                style={[styles.accordionHeader, { borderColor: colors.border, backgroundColor: isDarkMode ? '#222' : '#F9FAFB' }]}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.accordionHeaderText, { color: colors.text }]}>
                    {t('common.selectLanguages', 'Dil Seç')}
                  </Text>
                  {tempLanguages.length > 0 && (
                    <View style={[styles.badgePill, { backgroundColor: primaryColor }]}>
                      <Text style={styles.badgePillText}>{tempLanguages.length}</Text>
                    </View>
                  )}
                </View>
                <PhosphorIcon icon={isLanguageOpen ? ICONS.dropdownOpen : ICONS.dropdown} size={20} color={colors.text} />
              </TouchableOpacity>

              {isLanguageOpen && (
                <View style={styles.optionsList}>
                  {languages.map((lang) => {
                    const isSelected = tempLanguages.includes(lang.id);
                    
                    return (
                      <TouchableOpacity
                        key={lang.id}
                        onPress={() => {
                          triggerHaptic('light');
                          handleLanguageToggle(lang.id);
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
                        <View style={[styles.optionCardLeft, { gap: 10, flexShrink: 1 }]}>
                          <View style={[styles.langCodeBadge, { backgroundColor: isSelected ? primaryColor : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)') }]}>
                            <Text style={[styles.langCodeText, { color: isSelected ? '#FFFFFF' : colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                              {languageCode(lang)}
                            </Text>
                          </View>
                          <View style={{ flexShrink: 1 }}>
                            <Text style={[
                              styles.optionCardText,
                              {
                                color: isSelected ? primaryColor : colors.text,
                                fontFamily: isSelected ? fonts.bold : fonts.medium
                              }
                            ]} numberOfLines={1}>
                              {languageNativeName(lang, t)}
                            </Text>
                            {languageEnglishName(lang) ? (
                              <Text style={{ fontSize: fontSizes.caption, color: colors.muted }} numberOfLines={1}>
                                {languageEnglishName(lang)}
                              </Text>
                            ) : null}
                          </View>
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
              onPress={
                () => {
                  triggerHaptic('medium');
                  handleApply();
                }}
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
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  langCodeBadge: {
    minWidth: 36,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langCodeText: {
    fontSize: fontSizes.caption,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  filterIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 32,
    borderWidth: 1,
    height: 46,
    width: 46,
  },
  sheetContent: {
    paddingHorizontal: 0,
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: 6,
    borderRadius: 99,
  },
  modalContent: {
    paddingHorizontal: 20,
    flexShrink: 1,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: fontSizes.bodyLarge,
    fontFamily: fonts.bold,
    marginLeft: 6,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  accordionHeaderText: {
    fontSize: fontSizes.body,
    fontFamily: fonts.semibold,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  badgePillText: {
    color: '#FFF',
    fontSize: fontSizes.caption,
    fontFamily: fonts.bold,
  },
  optionsList: {
    marginTop: 12,
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconWrapper: {
    marginRight: 12,
  },
  optionCardText: {
    fontSize: fontSizes.body,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6, 
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  resetButton: {
    flex: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    fontSize: fontSizes.body,
    fontFamily: fonts.semibold,
  },
  applyButton: {
    flex: 2,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: '#F98A21', // solid base under the gradient: cheap iOS shadow
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: fontSizes.body,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
});

export default FilterModal;