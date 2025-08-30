import React, { useRef, useState } from 'react';
import { TouchableOpacity, StyleSheet, Modal, TouchableWithoutFeedback, View, Platform, Text } from 'react-native';
import Icon from 'react-native-iconify';
import { useTheme } from '../theme/theme';
import { useTranslation } from 'react-i18next';

const FilterIcon = ({ style, size = 24, color = "#B0B0B0", value = 'original', onChange }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
        style={[styles.filterIconButton, { borderColor: '#4A4A4A' }, style]}
        onPress={openMenu}
        activeOpacity={0.8}
      >
        <Icon icon="mage:filter" size={size} color={color} />
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
              left: Math.max(8, dropdownPos.x + dropdownPos.width - 140),
              top: Platform.OS === 'android' ? dropdownPos.y + dropdownPos.height : dropdownPos.y + dropdownPos.height + 4,
              minWidth: 120,
              maxWidth: 140,
              backgroundColor: colors.background,
              borderRadius: 14,
              paddingVertical: 6,
              paddingHorizontal: 0,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.10,
              shadowRadius: 8,
              elevation: 8,
              borderWidth: 1,
              borderColor: colors.iconBackground,
            }}>
              <TouchableOpacity onPress={() => handleSelect('original')} style={{ paddingVertical: 8, paddingHorizontal: 14, backgroundColor: value === 'original' ? colors.iconBackground : 'transparent', borderRadius: 8 }}>
                <Text style={{ color: value === 'original' ? '#fff' : colors.text, fontWeight: value === 'original' ? 'bold' : 'normal', fontSize: 15 }}>{t('deckDetail.default', 'Varsayılan')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSelect('az')} style={{ paddingVertical: 8, paddingHorizontal: 14, backgroundColor: value === 'az' ? colors.iconBackground  : 'transparent', borderRadius: 8 }}>
                <Text style={{ color: value === 'az' ? '#fff' : colors.text, fontWeight: value === 'az' ? 'bold' : 'normal', fontSize: 15 }}>A-Z</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSelect('fav')} style={{ paddingVertical: 8, paddingHorizontal: 14, backgroundColor: value === 'fav' ? colors.iconBackground : 'transparent', borderRadius: 8 }}>
                <Text style={{ color: value === 'fav' ? '#fff' : colors.text, fontWeight: value === 'fav' ? 'bold' : 'normal', fontSize: 15 }}>{t('deckDetail.fav', 'Favoriler')}</Text>
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
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    height: 48,
    aspectRatio: 1,
  },
});
