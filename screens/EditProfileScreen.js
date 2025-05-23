import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { getCurrentUserProfile } from '../services/ProfileService';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export default function EditProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [initialState, setInitialState] = useState({});
  const [imageChanged, setImageChanged] = useState(false);
  const [imageFilePath, setImageFilePath] = useState(null); // storage path

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getCurrentUserProfile();
        setProfile(data);
        setUsername(data.username || '');
        setImageUrl(data.image_url || '');
        setEmail(data.email || '');
        setInitialState({
          username: data.username || '',
          image_url: data.image_url || '',
          email: data.email || '',
        });
        setImageFilePath(data.image_url ? getStoragePathFromUrl(data.image_url) : null);
      } catch (err) {
        setError(err.message || 'Profil yüklenemedi');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Storage public url'den dosya yolunu çıkar
  function getStoragePathFromUrl(url) {
    // ör: https://xxxx.supabase.co/storage/v1/object/public/avatars/user_xxx.webp
    const idx = url.indexOf('/avatars/');
    if (idx === -1) return null;
    return url.substring(idx + 1); // avatars/user_xxx.webp
  }

  // Fotoğraf seç ve WebP olarak yükle
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 512 } }],
          { compress: 0.7, format: 'jpeg' }
        );
        setImageUrl(manipResult.uri);
        setImageChanged(true);
      }
    } catch (err) {
      console.log('Fotoğraf seçme hatası:', err);
      if (err?.message) {
        Alert.alert('Hata', 'Fotoğraf seçilemedi.');
      }
    }
  };

  // Profil kaydet
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    let newImageUrl = imageUrl;
    let newImageFilePath = imageFilePath;
    try {
      // 1. Fotoğraf değiştiyse yeni fotoğrafı yükle
      if (imageChanged && imageUrl) {
        // Eski fotoğrafı sil
        if (imageFilePath) {
          await supabase.storage.from('avatars').remove([imageFilePath]);
        }
        // Yeni fotoğrafı yükle
        const userId = profile.id;
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const filePath = `avatars/user_${userId}_${Date.now()}.webp`;
        const { data, error: uploadError } = await supabase
          .storage
          .from('avatars')
          .upload(filePath, blob, { contentType: 'image/webp', upsert: true });
        if (uploadError) throw uploadError;
        newImageFilePath = filePath;
        // Public URL al
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        newImageUrl = urlData.publicUrl;
      }
      // 2. Profil tablosunu güncelle
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username, image_url: newImageUrl })
        .eq('id', profile.id);
      if (updateError) throw updateError;
      // 3. E-posta değiştiyse güncelle
      if (email !== initialState.email && email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
      }
      // 4. Şifre değiştiyse güncelle
      if (password) {
        const { error: passError } = await supabase.auth.updateUser({ password });
        if (passError) throw passError;
      }
      Alert.alert('Başarılı', 'Profil güncellendi!', [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      setError(err.message || 'Profil güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  // Değişiklikleri geri al
  const handleCancel = () => {
    setUsername(initialState.username);
    setImageUrl(initialState.image_url);
    setEmail(initialState.email);
    setPassword('');
    setImageChanged(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}> 
        <ActivityIndicator size="large" color={colors.buttonColor} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}> 
        <Text style={[typography.styles.body, { color: colors.error }]}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[typography.styles.h2, { color: colors.text, marginBottom: 24 }]}>Profili Düzenle</Text>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Image source={imageUrl ? { uri: imageUrl } : undefined} style={styles.avatar} />
        <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
          <Text style={[typography.styles.button, { color: colors.buttonColor }]}>Fotoğrafı Değiştir</Text>
        </TouchableOpacity>
      </View>
      <Text style={[typography.styles.body, { color: colors.text, marginBottom: 8 }]}>Kullanıcı Adı</Text>
      <TextInput
        style={[styles.input, typography.styles.body, { color: colors.text, borderColor: colors.border }]}
        placeholder="Kullanıcı Adı"
        placeholderTextColor={colors.muted}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <Text style={[typography.styles.body, { color: colors.text, marginBottom: 8 }]}>E-posta</Text>
      <TextInput
        style={[styles.input, typography.styles.body, { color: colors.text, borderColor: colors.border }]}
        placeholder="E-posta"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Text style={[typography.styles.body, { color: colors.text, marginBottom: 8 }]}>Yeni Şifre</Text>
      <TextInput
        style={[styles.input, typography.styles.body, { color: colors.text, borderColor: colors.border }]}
        placeholder="Yeni Şifre (değiştirmek için doldurun)"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        secureTextEntry
      />
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.buttonColor }]}
          onPress={handleCancel}
          disabled={saving}
        >
          <Text style={[typography.styles.button, { color: colors.buttonColor }]}>İptal Et</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.buttonColor }, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[typography.styles.button, { color: colors.buttonText }]}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    backgroundColor: '#eee',
  },
  photoButton: {
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    width: '100%',
    backgroundColor: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 8,
  },
  saveButton: {
    flex: 1,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  cancelButton: {
    flex: 1,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
}); 