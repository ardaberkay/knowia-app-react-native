import React, { useContext, useEffect, useState } from 'react';
import { Keyboard, Platform, View, TouchableOpacity, Animated } from 'react-native';
import { Text } from './AppText';
import { BottomTabBarHeightCallbackContext, BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../theme/theme';
import { spacing } from '../../theme/layout';
import { Iconify } from 'react-native-iconify';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, fonts } from '../../theme/typography';

// Gap between the floating tab bar and the bottom safe area.
const TAB_BAR_BOTTOM_GAP = 20;

// Bottom padding for a scrollable list/page so its last item can scroll clear
// of what floats at the bottom: the tab bar on tab screens (its measured
// height, reported below), otherwise the home indicator / Android nav bar.
// `extra` adds room for anything else floating there, e.g. a FAB.
// automaticInsets: the list uses contentInsetAdjustmentBehavior="automatic"
// (under a see-through header, SCROLL_EDGE_HEADER), which on iOS already adds
// the bottom safe area; it is left out here so it isn't counted twice.
export function useListBottomInset(extra = 0, { automaticInsets = false } = {}) {
  const tabBarHeight = useContext(BottomTabBarHeightContext); // undefined outside tabs
  const insets = useSafeAreaInsets();
  const floating = tabBarHeight ?? insets.bottom;
  const systemAdded = automaticInsets && Platform.OS === 'ios' ? insets.bottom : 0;
  return Math.max(0, floating - systemAdded) + spacing.xl + extra;
}

export default function CustomTabBar(props) {
  const [visible, setVisible] = useState(true);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  // Tells the tab navigator how much space the bar takes from the bottom edge,
  // so useBottomTabBarHeight / useListBottomInset return the real value.
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const handleLayout = (e) => {
    onHeightChange?.(e.nativeEvent.layout.height + insets.bottom + TAB_BAR_BOTTOM_GAP);
  };

  useEffect(() => {
    let show, hide;
    if (Platform.OS === 'ios') {
      show = Keyboard.addListener('keyboardWillShow', () => setVisible(false));
      hide = Keyboard.addListener('keyboardWillHide', () => setVisible(true));
    } else {
      show = Keyboard.addListener('keyboardDidShow', () => setVisible(false));
      hide = Keyboard.addListener('keyboardDidHide', () => setVisible(true));
    }
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!visible) return null;

  const { state, descriptors, navigation } = props;

  const handlePress = (route, index) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      // Animasyon efekti
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      navigation.navigate(route.name);
    }
  };

  return (
    <View onLayout={handleLayout} style={{
      position: 'absolute',
      bottom: insets.bottom + TAB_BAR_BOTTOM_GAP,
      left: 20,
      right: 20,
      backgroundColor: colors.floatingTabBarBackground,
      borderRadius: 25,
      paddingVertical: 8,
      paddingHorizontal: 12,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: colors.border + '30', // %18 opacity ile çok hafif kenarlık
    }}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        
        const iconName = getIconName(route.name, isFocused);
        const label = options.tabBarLabel || options.title || route.name;

        return (
          <Animated.View
            key={route.key}
            style={{
              transform: [{ scale: isFocused ? scaleAnim : 1 }],
            }}
          >
            <TouchableOpacity
              onPress={() => handlePress(route, index)}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 20,
                backgroundColor: isFocused ? colors.buttonColor : 'transparent',
                minWidth: 60,
              }}
              activeOpacity={0.7}
            >
              <Iconify
                icon={iconName}
                size={24}
                color={isFocused ? colors.buttonText : colors.subtext}
                style={{
                  marginBottom: 2,
                }}
              />
              <Text
                style={{
                  fontSize: fontSizes.micro,
                  fontFamily: fonts.medium,
                  color: isFocused ? colors.buttonText : colors.subtext,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

function getIconName(routeName, isFocused) {
  switch (routeName) {
    case 'Home':
      return isFocused ? 'solar:home-smile-bold' : 'solar:home-angle-broken';
    case 'DiscoverTab':
      return isFocused ? 'solar:compass-bold' : 'solar:compass-broken';
    case 'Library':
      return isFocused ? 'solar:library-bold-duotone' : 'solar:library-line-duotone';
    case 'Profile':
      return isFocused ? 'solar:user-bold' : 'solar:user-broken';
    default:
      return 'solar:home-angle-broken';
  }
} 