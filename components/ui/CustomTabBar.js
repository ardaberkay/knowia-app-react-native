import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, View, TouchableOpacity, Text, Animated } from 'react-native';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../theme/theme';
import { Iconify } from 'react-native-iconify';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function CustomTabBar(props) {
  const [visible, setVisible] = useState(true);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scaleAnim = new Animated.Value(1);

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
    <View style={{
      position: 'absolute',
      bottom: insets.bottom + verticalScale(20),
      left: scale(20),
      right: scale(20),
      backgroundColor: colors.floatingTabBarBackground,
      borderRadius: moderateScale(25),
      paddingVertical: verticalScale(8),
      paddingHorizontal: scale(12),
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      borderWidth: moderateScale(0.5),
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
                paddingVertical: verticalScale(6),
                paddingHorizontal: scale(10),
                borderRadius: moderateScale(20),
                backgroundColor: isFocused ? colors.buttonColor : 'transparent',
                minWidth: scale(60),
              }}
              activeOpacity={0.7}
            >
              <Iconify
                icon={iconName}
                size={moderateScale(24)}
                color={isFocused ? colors.buttonText : colors.subtext}
                style={{
                  marginBottom: verticalScale(2),
                }}
              />
              <Text
                style={{
                  fontSize: moderateScale(11),
                  fontWeight: '500',
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
    case 'Create':
      return isFocused ? 'fluent:note-add-20-filled' : 'fluent:note-add-20-regular';
    case 'Library':
      return isFocused ? 'solar:library-bold-duotone' : 'solar:library-line-duotone';
    case 'Profile':
      return isFocused ? 'solar:user-bold' : 'solar:user-broken';
    default:
      return 'solar:home-angle-broken';
  }
} 