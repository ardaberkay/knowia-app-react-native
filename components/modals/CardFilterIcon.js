import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { MenuView } from '@expo/ui/community/menu';
import Icon from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';
import { triggerHaptic } from '../../lib/hapticManager';

const BUTTON_SIZE = 48;

// Native menu (SwiftUI Menu on iOS, Material DropdownMenu on Android),
// anchored to the button by the OS. The selected filter shows a checkmark.
const FilterIcon = ({ style, size, color, value = 'original', onChange, hideFavorites = false, hideAz = false, variant }) => {
  const { isDarkMode, colors } = useTheme();
  const { t } = useTranslation();

  const isLight = variant === 'light';
  const borderColor = isLight ? 'rgba(255, 255, 255, 0.3)' : (isDarkMode ? '#4A4A4A' : 'rgba(0, 0, 0, 0.08)');
  const defaultIconColor = isLight ? '#ffffff' : (isDarkMode ? '#ffffff' : colors.subtext);
  const resolvedIconColor = color || defaultIconColor;
  const backgroundColor = isLight
    ? 'rgba(255, 255, 255, 0.15)'
    : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)');

  const actions = useMemo(() => {
    const options = [
      { id: 'original', title: t('deckDetail.default', 'Varsayılan') },
      !hideAz && { id: 'az', title: 'A-Z' },
      !hideFavorites && { id: 'fav', title: t('deckDetail.fav', 'Favoriler') },
      { id: 'unlearned', title: t('deckDetail.inProgress', 'Devam Eden') },
      { id: 'learned', title: t('deckDetail.inLearned', 'Öğrenildi') },
    ].filter(Boolean);
    return options.map((o) => ({ ...o, state: o.id === value ? 'on' : 'off' }));
  }, [t, hideAz, hideFavorites, value]);

  return (
    <MenuView
      actions={actions}
      onOpenMenu={() => triggerHaptic('selection')}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event !== value) onChange?.(nativeEvent.event);
      }}
      style={[styles.host, style]}
    >
      <View
        style={[
          styles.filterIconButton,
          { borderColor, backgroundColor },
        ]}
      >
        <Icon icon="lsicon:filter-filled" size={size || 24} color={resolvedIconColor} />
      </View>
    </MenuView>
  );
};

export default FilterIcon;

const styles = StyleSheet.create({
  host: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  filterIconButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
