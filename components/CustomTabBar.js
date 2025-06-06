import React, { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { BottomTabBar } from '@react-navigation/bottom-tabs';

export default function CustomTabBar(props) {
  const [visible, setVisible] = useState(true);

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
  return <BottomTabBar {...props} />;
} 