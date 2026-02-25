import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../../contexts/ProfileContext';
import { scale, moderateScale } from '../../lib/scaling';

export default function ProfileAvatarButton() {
  const navigation = useNavigation();
  const { profile } = useProfile();

  // Eğer profil henüz yükleniyorsa (null/undefined) veya image_url yoksa doğrudan default resmi kullan
  const imageSource = profile?.image_url 
    ? { uri: profile.image_url } 
    : require('../../assets/avatar-default.png');

  return (
    <TouchableOpacity
      style={styles.profileAvatarButton}
      onPress={() => navigation.navigate('Profile')}
      activeOpacity={0.8}
    >
      <Image
        source={imageSource}
        style={styles.profileAvatar}
      />
    </TouchableOpacity>
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