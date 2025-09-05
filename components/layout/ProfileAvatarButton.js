import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { getCurrentUserProfile } from '../../services/ProfileService';

export default function ProfileAvatarButton() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getCurrentUserProfile();
        setProfile(data);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    marginRight: 18,
    width: 47,
    height: 47,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  profileAvatar: {
    width: 47,
    height: 47,
    borderRadius: 22,
    resizeMode: 'cover',
    backgroundColor: '#fff',
  },
}); 