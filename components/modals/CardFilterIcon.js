import React, { useRef, useState, useMemo } from 'react';
import { TouchableOpacity, StyleSheet, Modal, TouchableWithoutFeedback, View, Platform, Text } from 'react-native';
import Icon from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';

const FilterIcon = ({ style, size, color = "#B0B0B0", value = 'original', onChange, hideFavorites = false }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  // Responsive boyutlar - useMemo ile optimize edilmiş
  const filterIconDimensions = useMemo(() => {
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    
    return {
      height: isSmallPhone ? verticalScale(48) : (isTablet ? verticalScale(52) : verticalScale(48)),
      paddingHorizontal: isSmallPhone ? scale(12) : (isTablet ? scale(16) : scale(12)),
      paddingVertical: isSmallPhone ? verticalScale(8) : (isTablet ? verticalScale(10) : verticalScale(8)),
      borderRadius: isSmallPhone ? moderateScale(26) : (isTablet ? moderateScale(34) : moderateScale(30)),
      borderWidth: isSmallPhone ? moderateScale(0.8) : moderateScale(1),
      iconSize: size || (isSmallPhone ? moderateScale(18) : (isTablet ? moderateScale(26) : moderateScale(24))),
      dropdownMinWidth: isSmallPhone ? scale(110) : (isTablet ? scale(160) : scale(120)),
      dropdownMaxWidth: isSmallPhone ? scale(130) : (isTablet ? scale(180) : scale(140)),
      dropdownPaddingVertical: isSmallPhone ? verticalScale(4) : (isTablet ? verticalScale(8) : verticalScale(6)),
      dropdownItemPaddingVertical: isSmallPhone ? verticalScale(6) : (isTablet ? verticalScale(10) : verticalScale(8)),
      dropdownItemPaddingHorizontal: isSmallPhone ? scale(12) : (isTablet ? scale(18) : scale(14)),
      dropdownFontSize: isSmallPhone ? moderateScale(13) : (isTablet ? moderateScale(17) : moderateScale(15)),
      dropdownBorderRadius: isSmallPhone ? moderateScale(12) : (isTablet ? moderateScale(16) : moderateScale(14)),
      dropdownItemBorderRadius: isSmallPhone ? moderateScale(6) : moderateScale(8),
    };
  }, [width, isTablet, size]);
  
  const buttonRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const openMenu = () => {
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
            borderColor: '#4A4A4A',
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
        <Icon icon="lsicon:filter-filled" size={filterIconDimensions.iconSize} color={color} />
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
                <Text style={{ color: value === 'original' ? '#fff' : colors.text, fontWeight: value === 'original' ? 'bold' : 'normal', fontSize: filterIconDimensions.dropdownFontSize }}>{t('deckDetail.default', 'Varsayılan')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSelect('az')} style={{ paddingVertical: filterIconDimensions.dropdownItemPaddingVertical, paddingHorizontal: filterIconDimensions.dropdownItemPaddingHorizontal, backgroundColor: value === 'az' ? colors.iconBackground  : 'transparent', borderRadius: filterIconDimensions.dropdownItemBorderRadius }}>
                <Text style={{ color: value === 'az' ? '#fff' : colors.text, fontWeight: value === 'az' ? 'bold' : 'normal', fontSize: filterIconDimensions.dropdownFontSize }}>A-Z</Text>
              </TouchableOpacity>
              {!hideFavorites && (
                <TouchableOpacity onPress={() => handleSelect('fav')} style={{ paddingVertical: filterIconDimensions.dropdownItemPaddingVertical, paddingHorizontal: filterIconDimensions.dropdownItemPaddingHorizontal, backgroundColor: value === 'fav' ? colors.iconBackground : 'transparent', borderRadius: filterIconDimensions.dropdownItemBorderRadius }}>
                  <Text style={{ color: value === 'fav' ? '#fff' : colors.text, fontWeight: value === 'fav' ? 'bold' : 'normal', fontSize: filterIconDimensions.dropdownFontSize }}>{t('deckDetail.fav', 'Favoriler')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleSelect('unlearned')} style={{ paddingVertical: filterIconDimensions.dropdownItemPaddingVertical, paddingHorizontal: filterIconDimensions.dropdownItemPaddingHorizontal, backgroundColor: value === 'unlearned' ? colors.iconBackground : 'transparent', borderRadius: filterIconDimensions.dropdownItemBorderRadius }}>
                <Text style={{ color: value === 'unlearned' ? '#fff' : colors.text, fontWeight: value === 'unlearned' ? 'bold' : 'normal', fontSize: filterIconDimensions.dropdownFontSize }}>{t('deckDetail.inProgress', 'Devam Eden')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSelect('learned')} style={{ paddingVertical: filterIconDimensions.dropdownItemPaddingVertical, paddingHorizontal: filterIconDimensions.dropdownItemPaddingHorizontal, backgroundColor: value === 'learned' ? colors.iconBackground : 'transparent', borderRadius: filterIconDimensions.dropdownItemBorderRadius }}>
                <Text style={{ color: value === 'learned' ? '#fff' : colors.text, fontWeight: value === 'learned' ? 'bold' : 'normal', fontSize: filterIconDimensions.dropdownFontSize }}>{t('deckDetail.inLearned', 'Öğrenildi')}</Text>
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
    backgroundColor: '#fffff',
    // height, paddingHorizontal, paddingVertical, borderRadius, borderWidth dinamik olarak uygulanacak
    aspectRatio: 1,
  },
});
