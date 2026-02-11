import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, Platform, SafeAreaView, StatusBar, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { getCurrentUserProfile } from '../../services/ProfileService';
import { useProfile } from '../../contexts/ProfileContext';
import { supabase } from '../../lib/supabase';
import { cacheProfile, cacheProfileImage, clearUserCache } from '../../services/CacheService';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { useTranslation } from 'react-i18next';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { Iconify } from 'react-native-iconify';
import UndoButton from '../../components/tools/UndoButton';
import CreateButton from '../../components/tools/CreateButton';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import LottieView from 'lottie-react-native';


export default function EditProfileScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [initialState, setInitialState] = useState({});
  const [imageChanged, setImageChanged] = useState(false);
  const [imageFilePath, setImageFilePath] = useState(null); // storage path
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbarHelpers();
  const { refetch: refetchProfile } = useProfile();

  // Email validasyonu için regex
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

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
        setError(err.message || t('common.profileUpdatedError'));
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
        showError(t('common.imageNotSelected'));
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
          showError(t('common.imageRemoveError') + ': ' + error.message);
        }
      }
      setImageUrl('');
      setImageChanged(true);
      setImageFilePath(null);
    } catch (err) {
      showError(t('common.imageRemoveError'));
    }
  };

  // Profil kaydet
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    // Username validasyonu
    if (username.length < 3 || username.length > 16) {
      setError(t('common.usernameLengthError'));
      setSaving(false);
      return;
    }
    
    // Email validasyonu
    if (email && !isValidEmail(email)) {
      setError(t('editProfile.invalidEmail'));
      setSaving(false);
      return;
    }
    
    // Email veya şifre değişikliği varsa mevcut şifre kontrolü
    const emailChanged = email !== initialState.email && email !== '';
    const passwordChanged = password !== '';
    
    if ((emailChanged || passwordChanged) && !currentPassword) {
      setError(t('editProfile.currentPasswordRequired'));
      setSaving(false);
      return;
    }
    
    // Şifre eşleşme kontrolü
    if (password && password !== passwordConfirm) {
      setError(t('common.passwordMatchError'));
      setSaving(false);
      return;
    }
    
    // Email veya şifre değişikliği varsa mevcut şifreyi doğrula
    if ((emailChanged || passwordChanged) && currentPassword) {
      try {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: initialState.email, // eski email
          password: currentPassword // kullanıcının girdiği mevcut şifre
        });
        
        if (verifyError) {
          setError(t('editProfile.invalidCurrentPassword'));
          setSaving(false);
          return;
        }
      } catch (err) {
        setError(t('editProfile.invalidCurrentPassword'));
        setSaving(false);
        return;
      }
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
          showError(t('common.imageRemoveError') + ': ' + error.message);
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
      
      // 4. Cache'i güncelle - eski cache'i temizle ve yeni veriyi cache'le
      await clearUserCache(profile.id);
      
      // Güncellenmiş profil bilgilerini al ve cache'le
      const updatedProfile = await getCurrentUserProfile();
      await cacheProfile(profile.id, updatedProfile);
      if (newImageUrl) {
        await cacheProfileImage(profile.id, newImageUrl);
      }
      
      // 5. E-posta değiştiyse güncelle
      if (emailChanged) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) {
          // Email zaten kullanılıyor mu kontrol et
          if (emailError.message.includes('already registered') || 
              emailError.message.includes('already exists') ||
              emailError.message.includes('User already registered')) {
            setError(t('editProfile.emailAlreadyExists'));
          } else {
            setError(emailError.message);
          }
          setSaving(false);
          return;
        }
        
        // Email değişikliği başarılı - Alert göster
        Alert.alert(
          t('editProfile.emailChangeTitle'),
          t('editProfile.emailChangeMessage'),
          [{ text: t('common.ok') }]
        );
      }
      
      // 6. Şifre değiştiyse güncelle
      if (passwordChanged) {
        const { error: passError } = await supabase.auth.updateUser({ password });
        if (passError) {
          setError(passError.message);
          setSaving(false);
          return;
        }
        // Şifre değişikliği başarılı - Snackbar zaten var
      }
      
      // Email değişikliği yoksa normal başarı mesajı göster
      if (!emailChanged) {
        showSuccess(t('common.profileUpdated'));
      }

      // Global profil cache'ini (ProfileContext) güncelle; avatar ve diğer ekranlar güncel veriyi gösterir
      await refetchProfile();

      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (err) {
      console.log('Profil güncelleme hatası:', err);
      setError(err.message || t('common.profileUpdatedError'));
      showError(err.message || t('common.profileUpdatedError'));
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
    setCurrentPassword('');
    setImageChanged(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
      <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: moderateScale(200, 0.3), height: moderateScale(200, 0.3) }} />
      <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: moderateScale(100, 0.3), height: moderateScale(100, 0.3) }} />
    </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={verticalScale(50)}
      >
          {/* Profile Photo Card */}
          <View style={[styles.inputCard, {
            backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={styles.labelRow}>
              <Iconify icon="mage:image-fill" size={moderateScale(20)} color={colors.buttonColor} style={styles.labelIcon} />
              <Text style={[typography.styles.body, { color: colors.text, fontWeight: '600' }]}>
                {t('editProfile.profilePhoto')}
              </Text>
            </View>
            <View style={styles.profilePhotoContainer}>
              <View style={styles.avatarContainer}>
                <Image 
                  source={imageUrl ? { uri: imageUrl } : require('../../assets/avatar-default.png')} 
                  style={[styles.avatarLarge, { borderColor: colors.border }]} 
                />
                <TouchableOpacity 
                  style={[styles.cameraButton, { backgroundColor: colors.buttonColor }]}
                  onPress={handlePickImage}
                  activeOpacity={0.8}
                >
                  <Iconify icon="mage:image-fill" size={moderateScale(18)} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.photoButtonRow}>
                <TouchableOpacity 
                  style={[styles.photoActionButton, { 
                    backgroundColor: colors.cardButtonBackground || colors.blurView,
                    borderColor: colors.buttonColor,
                  }]} 
                  onPress={handlePickImage}
                  activeOpacity={0.7}
                >
                  <Iconify icon="lucide:edit" size={moderateScale(18)} color={colors.buttonColor} style={{ marginRight: scale(6) }} />
                  <Text style={[typography.styles.button, { color: colors.buttonColor, fontSize: moderateScale(14) }]}>
                    {t('editProfile.changePhoto')}
                  </Text>
                </TouchableOpacity>
                {imageUrl && (
                  <TouchableOpacity 
                    style={[styles.photoActionButton, { 
                      backgroundColor: colors.cardButtonBackground || colors.blurView,
                      borderColor: colors.error,
                    }]} 
                    onPress={handleRemovePhoto}
                    activeOpacity={0.7}
                  >
                    <Iconify icon="mdi:garbage-can-empty" size={moderateScale(18)} color={colors.error} style={{ marginRight: scale(6) }} />
                    <Text style={[typography.styles.button, { color: colors.error, fontSize: moderateScale(14) }]}>
                      {t('editProfile.removePhoto')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Username Card */}
          <View style={[styles.inputCard, {
            backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={styles.labelRow}>
              <Iconify icon="solar:user-bold" size={moderateScale(20)} color={colors.buttonColor} style={styles.labelIcon} />
              <Text style={[typography.styles.body, { color: colors.text, fontWeight: '600' }]}>
                {t('editProfile.userName')}
              </Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, { 
                color: colors.text, 
                borderColor: colors.border, 
                backgroundColor: colors.blurView || colors.cardButtonBackground,
              }]}
              placeholder={t('editProfile.userNamePlaceholder')}
              placeholderTextColor={colors.muted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              maxLength={16}
            />
            <Text style={[typography.styles.caption, { color: colors.muted, marginTop: verticalScale(4) }]}>
              {t('editProfile.usernameHint')}
            </Text>
          </View>

          {/* Email Card */}
          <View style={[styles.inputCard, {
            backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={styles.labelRow}>
              <Iconify icon="tabler:mail-filled" size={moderateScale(20)} color={colors.buttonColor} style={styles.labelIcon} />
              <Text style={[typography.styles.body, { color: colors.text, fontWeight: '600' }]}>
                {t('editProfile.email')}
              </Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, { 
                color: colors.text, 
                borderColor: colors.border, 
                backgroundColor: colors.blurView || colors.cardButtonBackground,
              }]}
              placeholder={t('editProfile.emailPlaceholder')}
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          {/* Current Password Card */}
          <View style={[styles.inputCard, {
            backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={styles.labelRow}>
              <Iconify icon="carbon:password" size={moderateScale(20)} color={colors.buttonColor} style={styles.labelIcon} />
              <Text style={[typography.styles.body, { color: colors.text, fontWeight: '600' }]}>
                {t('editProfile.currentPassword')}
              </Text>
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput, typography.styles.body, { 
                  color: colors.text, 
                  borderColor: colors.border, 
                  backgroundColor: colors.blurView || colors.cardButtonBackground,
                }]}
                placeholder={t('editProfile.currentPasswordPlaceholder')}
                placeholderTextColor={colors.muted}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                autoCapitalize="none"
                secureTextEntry={!showCurrentPassword}
                autoComplete="password"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
              >
                <Iconify 
                  icon={showCurrentPassword ? "oi:eye" : "system-uicons:eye-no"} 
                  size={moderateScale(20)} 
                  color={colors.muted} 
                />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: verticalScale(4) }}>
              <View style={{
                width: moderateScale(20),
                height: moderateScale(20),
                borderRadius: 99,
                borderWidth: 1,
                borderColor: colors.muted,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: scale(6),
              }}>
                <Iconify icon="mdi:information-variant" size={moderateScale(14)} color={colors.muted} />
              </View>
              <Text style={[typography.styles.caption, { color: colors.muted, flex: 1 }]}>
                {t('editProfile.currentPasswordNote')}
              </Text>
            </View>
          </View>

          {/* Password Card */}
          <View style={[styles.inputCard, {
            backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={styles.labelRow}>
              <Iconify icon="carbon:password" size={moderateScale(20)} color={colors.buttonColor} style={styles.labelIcon} />
              <Text style={[typography.styles.body, { color: colors.text, fontWeight: '600' }]}>
                {t('editProfile.newPassword')}
              </Text>
              <Text style={[typography.styles.caption, { color: colors.muted, marginLeft: scale(6) }]}>
                ({t('editProfile.optional')})
              </Text>
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput, typography.styles.body, { 
                  color: colors.text, 
                  borderColor: colors.border, 
                  backgroundColor: colors.blurView || colors.cardButtonBackground,
                }]}
                placeholder={t('editProfile.newPasswordPlaceholder')}
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                secureTextEntry={!showPassword}
                autoComplete="password-new"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
              >
                <Iconify 
                  icon={showPassword ? "oi:eye" : "system-uicons:eye-no"} 
                  size={moderateScale(20)} 
                  color={colors.muted} 
                />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput, typography.styles.body, { 
                  color: colors.text, 
                  borderColor: colors.border, 
                  backgroundColor: colors.blurView || colors.cardButtonBackground,
                }]}
                placeholder={t('editProfile.confirmPasswordPlaceholder')}
                placeholderTextColor={colors.muted}
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                autoCapitalize="none"
                secureTextEntry={!showPasswordConfirm}
                autoComplete="password-new"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}
                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
              >
                <Iconify 
                  icon={showPasswordConfirm ? "oi:eye" : "system-uicons:eye-no"} 
                  size={moderateScale(20)} 
                  color={colors.muted} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View style={[styles.errorCard, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
              <Iconify icon="mdi:information-variant" size={moderateScale(20)} color={colors.error} style={{ marginRight: scale(8) }} />
              <Text style={[typography.styles.caption, { color: colors.error, flex: 1 }]}>{error}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRowModern}>
            <UndoButton
              onPress={handleCancel}
              disabled={saving}
              text={t('editProfile.undo')}
            />
            <CreateButton
              onPress={handleSave}
              disabled={saving}
              loading={saving}
              text={saving ? t('editProfile.saving') : t('editProfile.save')}
            />
          </View>
        </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: scale(16),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(32),
  },
  inputCard: {
    width: '100%',
    maxWidth: scale(440),
    borderRadius: moderateScale(28),
    padding: scale(20),
    marginBottom: verticalScale(12),
    alignSelf: 'center',
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(12),
    gap: scale(8),
  },
  labelIcon: {
    marginRight: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: verticalScale(200),
    flexDirection: 'column',
    gap: verticalScale(-65),
  },
  profilePhotoContainer: {
    alignItems: 'center',
    marginTop: verticalScale(8),
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: verticalScale(16),
  },
  avatarLarge: {
    width: scale(120),
    height: scale(120),
    borderRadius: moderateScale(60),
    backgroundColor: '#eee',
    borderWidth: moderateScale(3),
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: moderateScale(3),
    borderColor: '#fff',
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: scale(12),
    width: '100%',
    justifyContent: 'center',
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: moderateScale(1.5),
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(16),
    justifyContent: 'center',
    flex: 1,
    maxWidth: scale(150),
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    width: '100%',
    fontSize: 16,
  },
  passwordInputContainer: {
    position: 'relative',
    marginBottom: verticalScale(12),
  },
  passwordInput: {
    paddingRight: scale(45),
  },
  eyeButton: {
    position: 'absolute',
    right: scale(12),
    top: verticalScale(14),
    padding: scale(4),
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: scale(20),
    marginTop: verticalScale(16),

    width: '100%',
    maxWidth: scale(440),
    alignSelf: 'center',
  },
}); 