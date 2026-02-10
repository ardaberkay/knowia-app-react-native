import React from 'react';
import { TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { useProfile } from '../../contexts/ProfileContext';

export default function ProfileAvatarButton() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { profile, loading } = useProfile();

  return (
    <TouchableOpacity
      style={styles.profileAvatarButton}
      onPress={() => navigation.navigate('Profile')}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.buttonColor} />
      ) : (
        <Image
          source={profile?.image_url ? { uri: profile.image_url } : require('../../assets/avatar-default.png')}
          style={styles.profileAvatar}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  profileAvatarButton: {
    marginLeft: 12,
    marginRight: 24,
    width: 47,
    height: 47,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  profileAvatar: {
    width: 47,
    height: 47,
    borderRadius: 22,
    resizeMode: 'cover',
    backgroundColor: 'transparent',
  },
}); 