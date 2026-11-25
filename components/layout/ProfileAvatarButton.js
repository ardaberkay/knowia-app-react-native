import React, { useMemo } from 'react';
import { Image, StyleSheet, Pressable, Platform } from 'react-native'; // TouchableOpacity'yi Pressable ile değiştirdik
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../../contexts/ProfileContext';
import { triggerHaptic } from '../../lib/hapticManager';

// Pressable bileşenini animasyonlu hale getiriyoruz
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ProfileAvatarButton({ compact = false }) {
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

  // URI objesi her render'da yenilenirse Image gereksiz yeniden decode edebilir; uri + cache sabit tutulur.
  const imageSource = useMemo(() => {
    if (!profile?.image_url) return require('../../assets/avatar_default.webp');
    const uri = profile.image_url;
    if (Platform.OS === 'android') {
      return { uri, cache: 'force-cache' };
    }
    return { uri };
  }, [profile?.image_url]);

  return (
    <AnimatedPressable
      style={[compact ? styles.profileAvatarButtonCompact : styles.profileAvatarButton, animatedStyle]} // Animasyon stilini bağladık
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
        style={compact ? styles.profileAvatarCompact : styles.profileAvatar}
        fadeDuration={0}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  profileAvatarButton: {
    width: 47,
    height: 47,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  profileAvatar: {
    width: 47,
    height: 47,
    borderRadius: 22,
    resizeMode: 'cover',
    backgroundColor: 'transparent',
  },
  profileAvatarButtonCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  profileAvatarCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    resizeMode: 'cover',
    backgroundColor: 'transparent',
  },
});

export default React.memo(ProfileAvatarButton);