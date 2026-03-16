import React from 'react';
import { Image, StyleSheet, Pressable } from 'react-native'; // TouchableOpacity'yi Pressable ile değiştirdik
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../../contexts/ProfileContext';
import { scale, moderateScale } from '../../lib/scaling';
import { triggerHaptic } from '../../lib/hapticManager';

// Pressable bileşenini animasyonlu hale getiriyoruz
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ProfileAvatarButton() {
  const navigation = useNavigation();
  const { profile } = useProfile();

  // Dokunma durumunu takip eden değer
  const isPressed = useSharedValue(0);

  // AppBar için süper hızlı ve zarif animasyon stili
  const animatedStyle = useAnimatedStyle(() => {
    // AppBar ikonları için hızlı tepki veren (yüksek stiffness) ayar
    const springConfig = { mass: 0.3, damping: 15, stiffness: 450 };

    return {
      // Sadece %8 küçülme (çok zarif)
      transform: [
        { scale: withSpring(isPressed.value ? 0.92 : 1, springConfig) }
      ],
      // Çok hafif bir saydamlaşma
      opacity: withSpring(isPressed.value ? 0.85 : 1, springConfig),
    };
  });

  // Eğer profil henüz yükleniyorsa (null/undefined) veya image_url yoksa doğrudan default resmi kullan
  const imageSource = profile?.image_url 
    ? { uri: profile.image_url } 
    : require('../../assets/avatar_default.png');

  return (
    <AnimatedPressable
      style={[styles.profileAvatarButton, animatedStyle]} // Animasyon stilini bağladık
      onPressIn={() => {
        isPressed.value = 1;
      }}
      onPressOut={() => {
        isPressed.value = 0;
      }}
      onPress={() => {
        triggerHaptic('selection'); // Selection haptic'i bu minik buton için mükemmel seçim!
        navigation.navigate('Profile');
      }}
    >
      <Image
        source={imageSource}
        style={styles.profileAvatar}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  profileAvatarButton: {
    marginLeft: scale(12),
    marginRight: scale(24),
    width: scale(47),
    height: scale(47),
    borderRadius: moderateScale(22),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  profileAvatar: {
    width: scale(47),
    height: scale(47),
    borderRadius: moderateScale(22),
    resizeMode: 'cover',
    backgroundColor: 'transparent',
  },
});