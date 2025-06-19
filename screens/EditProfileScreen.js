import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { getCurrentUserProfile } from '../services/ProfileService';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';

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
  const [passwordConfirm, setPasswordConfirm] = useState('');
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
    const idx = url.lastIndexOf('/');
    if (idx === -1) return null;
    const path = url.substring(idx + 1); // user_xxx.webp
    console.log('getStoragePathFromUrl:', url, '->', path);
    return path;
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

  // Fotoğrafı kaldır
  const handleRemovePhoto = async () => {
    try {
      console.log('Kaldırılacak dosya:', imageFilePath);
      if (imageFilePath) {
        const { data, error } = await supabase.storage.from('avatars').remove([imageFilePath]);
        console.log('Silme sonucu (removePhoto):', data, error);
        if (error) {
          Alert.alert('Hata', 'Fotoğraf silinemedi: ' + error.message);
        }
      }
      setImageUrl('');
      setImageChanged(true);
      setImageFilePath(null);
    } catch (err) {
      Alert.alert('Hata', 'Fotoğraf silinemedi.');
    }
  };

  // Profil kaydet
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    if (username.length < 3 || username.length > 9) {
      setError('Kullanıcı adı 3 ile 9 karakter arasında olmalıdır');
      setSaving(false);
      return;
    }
    if (password && password !== passwordConfirm) {
      setError('Şifreler eşleşmiyor');
      setSaving(false);
      return;
    }
    let newImageUrl = imageUrl;
    let newImageFilePath = imageFilePath;
    try {
      // 1. Fotoğraf değiştiyse önce eski fotoğrafı sil
      if (imageChanged && imageFilePath) {
        console.log('Silinecek dosya (handleSave):', imageFilePath);
        const { data, error } = await supabase.storage.from('avatars').remove([imageFilePath]);
        console.log('Silme sonucu (handleSave):', data, error);
        if (error) {
          Alert.alert('Hata', 'Fotoğraf silinemedi: ' + error.message);
        }
      }
      // 2. Fotoğraf değiştiyse yeni fotoğrafı yükle
      if (imageChanged && imageUrl) {
        const userId = profile.id;
        // Dosyayı base64 olarak oku
        const base64 = await FileSystem.readAsStringAsync(imageUrl, { encoding: FileSystem.EncodingType.Base64 });
        const filePath = `user_${userId}_${Date.now()}.webp`;
        const buffer = Buffer.from(base64, 'base64');
        const { data, error: uploadError } = await supabase
          .storage
          .from('avatars')
          .upload(filePath, buffer, { contentType: 'image/webp', upsert: true });
        if (uploadError) throw uploadError;
        newImageFilePath = filePath;
        // Public URL al
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        newImageUrl = urlData.publicUrl;
      }
      // Fotoğraf kaldırıldıysa profil tablosunda image_url alanını boşalt
      if (imageChanged && !imageUrl) {
        newImageUrl = '';
      }
      // 3. Profil tablosunu güncelle
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username, image_url: newImageUrl })
        .eq('id', profile.id);
      if (updateError) throw updateError;
      // 4. E-posta değiştiyse güncelle
      if (email !== initialState.email && email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
      }
      // 5. Şifre değiştiyse güncelle
      if (password) {
        const { error: passError } = await supabase.auth.updateUser({ password });
        if (passError) throw passError;
      }
      Alert.alert('Başarılı', 'Profil güncellendi!', [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      console.log('Profil güncelleme hatası:', err);
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
    setPasswordConfirm('');
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContent}>
          <View style={styles.profileRow}>
            <Image source={imageUrl ? { uri: imageUrl } : require('../assets/avatar-default.png')} style={styles.avatarLarge} />
            <View style={styles.avatarButtonRow}>
              <TouchableOpacity style={[styles.removeButton]} onPress={handleRemovePhoto}>
                <Text style={[typography.styles.button, styles.removeButtonText]}>Kaldır</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.changeButton]} onPress={handlePickImage}>
                <Text style={[typography.styles.button, styles.changeButtonText]}>Değiştir</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[typography.styles.body, { color: colors.text, marginBottom: 8, marginTop: 8 }]}>Kullanıcı Adı</Text>
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
          <TextInput
            style={[styles.input, typography.styles.body, { color: colors.text, borderColor: colors.border }]}
            placeholder="Yeni Şifreyi Tekrar Girin"
            placeholderTextColor={colors.muted}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            autoCapitalize="none"
            secureTextEntry
          />
          <View style={styles.bottomButtonBar}>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 0,
  },
  formContent: {
    flex: 1,
    paddingTop: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 18,
  },
  avatarLarge: {
    width: 110,
    height: 110,
    borderRadius: 60,
    backgroundColor: '#eee',
  },
  avatarButtonRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 14,
    marginLeft: 18,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  changeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 80,
    maxWidth: 120,
  },
  changeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  removeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginLeft: 0,
    minWidth: 80,
    maxWidth: 120,
  },
  removeButtonText: {
    color: '#F98A21',
    fontWeight: 'bold',
    fontSize: 15,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    width: '100%',
    backgroundColor: '#fff',
  },
  bottomButtonBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 0,
    paddingTop: 8,
    marginTop: 150,
  },
  saveButton: {
    minWidth: 140,
    maxWidth: 180,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  cancelButton: {
    minWidth: 140,
    maxWidth: 180,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
}); 