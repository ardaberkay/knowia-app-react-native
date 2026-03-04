import React, { useRef, useState, useMemo } from 'react';
import { TouchableOpacity, StyleSheet, Modal, TouchableWithoutFeedback, View, Platform, Text } from 'react-native';
import Icon from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { triggerHaptic } from '../../lib/hapticManager';

const FilterIcon = ({ style, size, color, value = 'original', onChange, hideFavorites = false, variant }) => {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  
  useWindowDimensions();
  const isTablet = getIsTablet();
  
  const filterIconDimensions = useMemo(() => ({
    height: isTablet ? verticalScale(52) : verticalScale(48),
    paddingHorizontal: isTablet ? scale(16) : scale(12),
    paddingVertical: isTablet ? verticalScale(10) : verticalScale(8),
    borderRadius: isTablet ? moderateScale(34) : moderateScale(30),
    borderWidth: moderateScale(1),
    iconSize: size || (isTablet ? moderateScale(26) : moderateScale(24)),
    dropdownMinWidth: isTablet ? scale(160) : scale(120),
    dropdownMaxWidth: isTablet ? scale(180) : scale(140),
    dropdownPaddingVertical: isTablet ? verticalScale(8) : verticalScale(6),
    dropdownItemPaddingVertical: isTablet ? verticalScale(10) : verticalScale(8),
    dropdownItemPaddingHorizontal: isTablet ? scale(18) : scale(14),
    dropdownFontSize: isTablet ? moderateScale(17) : moderateScale(15),
    dropdownBorderRadius: isTablet ? moderateScale(16) : moderateScale(14),
    dropdownItemBorderRadius: moderateScale(8),
  }), [isTablet, size]);
  
  const buttonRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // === SEARCHBAR VE FILTERMODALBUTTON İLE BİREBİR AYNI MANTIK ===
  const isLight = variant === 'light';

  const borderColor = isLight ? 'rgba(255, 255, 255, 0.3)' : (isDarkMode ? '#4A4A4A' : 'rgba(0, 0, 0, 0.08)');
  
  // Eğer dışarıdan özel bir color prop'u gönderildiyse onu kullan, yoksa standart tema rengini uygula
  const defaultIconColor = isLight ? '#ffffff' : (isDarkMode ? '#ffffff' : colors.subtext);
  const resolvedIconColor = color || defaultIconColor;

  const backgroundColor = isLight 
    ? 'rgba(255, 255, 255, 0.15)' // Cam efekti (renkli alanlar için %15 beyaz)
    : (isDarkMode 
        ? 'rgba(255, 255, 255, 0.05)' // Karanlık mod (%5 hafif beyaz dolgu)
        : 'rgba(0, 0, 0, 0.03)');     // Açık mod (%3 hafif koyu dolgu)
  // ===============================================================

  const openMenu = () => {
    triggerHaptic('selection');
    if (buttonRef.current && buttonRef.current.measureInWindow) {
      buttonRef.current.measureInWindow((x, y, width, height) => {
        setDropdownPos({ x, y, width, height });
        setVisible(true);
      });
    } else {
      setVisible(true);
    }
  };

  const handleSelect = (newValue) => {
    setVisible(false);
    if (onChange) onChange(newValue);
  };

  return (
    <>
      <TouchableOpacity
        ref={buttonRef}
        style={[
          styles.filterIconButton, 
          { 
            borderColor,
            backgroundColor, // Dinamik arka plan rengi uygulandı
            height: filterIconDimensions.height,
            paddingHorizontal: filterIconDimensions.paddingHorizontal,
            paddingVertical: filterIconDimensions.paddingVertical,
            borderRadius: filterIconDimensions.borderRadius,
            borderWidth: filterIconDimensions.borderWidth,
          }, 
          style
        ]}
        onPress={openMenu}
        activeOpacity={0.8}
      >
        <Icon icon="lsicon:filter-filled" size={filterIconDimensions.iconSize} color={resolvedIconColor} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={{ flex: 1 }}>
            <View style={{
              position: 'absolute',
              left: Math.max(scale(8), dropdownPos.x + dropdownPos.width - filterIconDimensions.dropdownMaxWidth),
              top: Platform.OS === 'android' ? dropdownPos.y + dropdownPos.height : dropdownPos.y + dropdownPos.height + verticalScale(4),
              minWidth: filterIconDimensions.dropdownMinWidth,
              maxWidth: filterIconDimensions.dropdownMaxWidth,
              backgroundColor: colors.background,
              borderRadius: filterIconDimensions.dropdownBorderRadius,
              paddingVertical: filterIconDimensions.dropdownPaddingVertical,
              paddingHorizontal: 0,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: verticalScale(2) },
              shadowOpacity: 0.10,
              shadowRadius: moderateScale(8),
              elevation: 2,
              borderWidth: moderateScale(1),
              borderColor: colors.iconBackground,
            }}>
              <TouchableOpacity onPress={() => handleSelect('original')} style={{ paddingVertical: filterIconDimensions.dropdownItemPaddingVertical, paddingHorizontal: filterIconDimensions.dropdownItemPaddingHorizontal, backgroundColor: value === 'original' ? colors.iconBackground : 'transparent', borderRadius: filterIconDimensions.dropdownItemBorderRadius }}>
                <Text style={{ color: value === 'original' ? (isDarkMode ? '#ffffff' : '#000000') : colors.text, fontWeight: value === 'original' ? 'bold' : 'normal', fontSize: filterIconDimensions.dropdownFontSize }}>{t('deckDetail.default', 'Varsayılan')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSelect('az')} style={{ paddingVertical: filterIconDimensions.dropdownItemPaddingVertical, paddingHorizontal: filterIconDimensions.dropdownItemPaddingHorizontal, backgroundColor: value === 'az' ? colors.iconBackground  : 'transparent', borderRadius: filterIconDimensions.dropdownItemBorderRadius }}>
                <Text style={{ color: value === 'az' ? (isDarkMode ? '#ffffff' : '#000000') : colors.text, fontWeight: value === 'az' ? 'bold' : 'normal', fontSize: filterIconDimensions.dropdownFontSize }}>A-Z</Text>
              </TouchableOpacity>
              {!hideFavorites && (
                <TouchableOpacity onPress={() => handleSelect('fav')} style={{ paddingVertical: filterIconDimensions.dropdownItemPaddingVertical, paddingHorizontal: filterIconDimensions.dropdownItemPaddingHorizontal, backgroundColor: value === 'fav' ? colors.iconBackground : 'transparent', borderRadius: filterIconDimensions.dropdownItemBorderRadius }}>
                  <Text style={{ color: value === 'fav' ? (isDarkMode ? '#ffffff' : '#000000') : colors.text, fontWeight: value === 'fav' ? 'bold' : 'normal', fontSize: filterIconDimensions.dropdownFontSize }}>{t('deckDetail.fav', 'Favoriler')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleSelect('unlearned')} style={{ paddingVertical: filterIconDimensions.dropdownItemPaddingVertical, paddingHorizontal: filterIconDimensions.dropdownItemPaddingHorizontal, backgroundColor: value === 'unlearned' ? colors.iconBackground : 'transparent', borderRadius: filterIconDimensions.dropdownItemBorderRadius }}>
                <Text style={{ color: value === 'unlearned' ? (isDarkMode ? '#ffffff' : '#000000') : colors.text, fontWeight: value === 'unlearned' ? 'bold' : 'normal', fontSize: filterIconDimensions.dropdownFontSize }}>{t('deckDetail.inProgress', 'Devam Eden')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSelect('learned')} style={{ paddingVertical: filterIconDimensions.dropdownItemPaddingVertical, paddingHorizontal: filterIconDimensions.dropdownItemPaddingHorizontal, backgroundColor: value === 'learned' ? colors.iconBackground : 'transparent', borderRadius: filterIconDimensions.dropdownItemBorderRadius }}>
                <Text style={{ color: value === 'learned' ? (isDarkMode ? '#ffffff' : '#000000') : colors.text, fontWeight: value === 'learned' ? 'bold' : 'normal', fontSize: filterIconDimensions.dropdownFontSize }}>{t('deckDetail.inLearned', 'Öğrenildi')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

export default FilterIcon;

const styles = StyleSheet.create({
  filterIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1,
  },
});