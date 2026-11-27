import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, StatusBar, Alert, Keyboard } from 'react-native';
import { Text, TextInput } from '../../components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormScrollView from '../../components/layout/FormScrollView';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { getCurrentUserProfile, updateProfile } from '../../services/ProfileService';
import { uploadAvatar, removeAvatar } from '../../services/StorageService';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { cacheProfile, cacheProfileImage, clearUserCache } from '../../services/CacheService';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { useTranslation } from 'react-i18next';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import UndoButton from '../../components/tools/UndoButton';
import CreateButton from '../../components/tools/CreateButton';
import LottieView from 'lottie-react-native';
import PhosphorIcon from '../../components/ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';


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
  const { session } = useAuth();

  const isOAuthUser = React.useMemo(() => {
    const provider = session?.user?.app_metadata?.provider;
    if (provider === 'google' || provider === 'apple') return true;
    return session?.user?.identities?.some(i => i.provider === 'google' || i.provider === 'apple') ?? false;
  }, [session]);

  // Email validasyonu için regex
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Session veya user id yoksa işlemi durdur
        if (!session?.user?.id) {
          throw new Error(t('common.sessionNotFound') || 'Oturum bulunamadı');
        }

        // userId'yi parametre olarak gönderiyoruz
        const data = await getCurrentUserProfile(session.user.id);

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
  }, [session]); // session değiştiğinde useEffect'in tetiklenmesi için dependency array'e ekledik

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
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 512 } }],
          { compress: 0.7, format: 'webp' }
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
      if (imageFilePath) {
        await removeAvatar(imageFilePath);
      }
      setImageUrl('');
      setImageChanged(true);
      setImageFilePath(null);
    } catch (err) {
      showError(t('common.imageRemoveError') + ': ' + err.message);
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
        await removeAvatar(imageFilePath);
      }
      // 2. Fotoğraf değiştiyse yeni fotoğrafı yükle
      if (imageChanged && imageUrl) {
        const base64 = await FileSystem.readAsStringAsync(imageUrl, { encoding: FileSystem.EncodingType.Base64 });
        const buffer = Buffer.from(base64, 'base64');
        const result = await uploadAvatar(profile.id, buffer);
        newImageFilePath = result.filePath;
        newImageUrl = result.publicUrl;
      }
      // Fotoğraf kaldırıldıysa profil tablosunda image_url alanını boşalt
      if (imageChanged && !imageUrl) {
        newImageUrl = '';
      }
      // 3. Profil tablosunu güncelle
      await updateProfile(profile.id, { username, imageUrl: newImageUrl });

      // 4. Cache'i güncelle - eski cache'i temizle ve yeni veriyi cache'le
      await clearUserCache(profile.id);

      // Güncellenmiş profil bilgilerini al ve cache'le
      const updatedProfile = await getCurrentUserProfile(profile.id);
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
        <LottieView source={require('../../assets/animations/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 160, height: 160 }} />
        <LottieView source={require('../../assets/animations/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100, marginTop: -65 }} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <FormScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Photo Card */}
        <View style={[styles.inputCard, {
          backgroundColor: colors.cardBackground,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
          borderColor: colors.cardBorder,
          borderWidth: 1,
        }]}>
          <View style={styles.labelRow}>
            <PhosphorIcon icon={ICONS.image} size={20} color={colors.buttonColor} style={styles.labelIcon} />
            <Text style={[typography.styles.body, { color: colors.text, fontFamily: fonts.semibold }]}>
              {t('editProfile.profilePhoto')}
            </Text>
          </View>
          <View style={styles.profilePhotoContainer}>
            <View style={styles.avatarContainer}>
              <Image
                source={imageUrl ? { uri: imageUrl } : require('../../assets/images/avatar_default.webp')}
                style={[styles.avatarLarge, { borderColor: colors.border }]}
              />
              <TouchableOpacity
                style={[styles.cameraButton, { backgroundColor: colors.buttonColor }]}
                onPress={handlePickImage}
                activeOpacity={0.8}
              >
                <PhosphorIcon icon={ICONS.image} size={18} color="#fff" />
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
                <PhosphorIcon icon={ICONS.edit} size={18} color={colors.buttonColor} style={{ marginRight: 6 }} />
                <Text style={[typography.styles.headline, { color: colors.buttonColor, fontSize: fontSizes.subhead }]}>
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
                  <PhosphorIcon icon={ICONS.delete} size={18} color={colors.error} style={{ marginRight: 6 }} />
                  <Text style={[typography.styles.headline, { color: colors.error, fontSize: fontSizes.subhead }]}>
                    {t('editProfile.removePhoto')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Username Card */}
        <View style={[styles.inputCard, {
          backgroundColor: colors.cardBackground,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
          borderColor: colors.cardBorder,
          borderWidth: 1,
        }]}>
          <View style={styles.labelRow}>
            <PhosphorIcon icon={ICONS.user} size={20} color={colors.buttonColor} style={styles.labelIcon} />
            <Text style={[typography.styles.body, { color: colors.text, fontFamily: fonts.semibold }]}>
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
          <Text style={[typography.styles.subhead, { color: colors.muted, marginTop: 4 }]}>
            {t('editProfile.usernameHint')}
          </Text>
        </View>

        {/* Email Card - OAuth kullanıcıda kilitli */}
        <View style={[styles.inputCard, {
          backgroundColor: colors.cardBackground,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
          borderColor: colors.cardBorder,
          borderWidth: 1,
          opacity: isOAuthUser ? 0.80 : 1,
          position: 'relative',
        }]}>
          {isOAuthUser && (
            <View style={{ position: 'absolute', top: 16, right: 20, zIndex: 10 }}>
              <PhosphorIcon icon={ICONS.locked} size={22} color={colors.muted} />
            </View>
          )}
          <View style={styles.labelRow}>
            <PhosphorIcon icon={ICONS.email} size={20} color={colors.buttonColor} style={styles.labelIcon} />
            <Text style={[typography.styles.body, { color: colors.text, fontFamily: fonts.semibold }]}>
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
            editable={!isOAuthUser}
            pointerEvents={isOAuthUser ? 'none' : 'auto'}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        {/* Current Password Card - OAuth kullanıcıda kilitli */}
        <View style={[styles.inputCard, {
          backgroundColor: colors.cardBackground,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
          borderColor: colors.cardBorder,
          borderWidth: 1,
          opacity: isOAuthUser ? 0.80 : 1,
          position: 'relative',
        }]}>
          {isOAuthUser && (
            <View style={{ position: 'absolute', top: 16, right: 20, zIndex: 10 }}>
              <PhosphorIcon icon={ICONS.locked} size={22} color={colors.muted} />
            </View>
          )}
          <View style={styles.labelRow}>
            <PhosphorIcon icon={ICONS.password} size={20} color={colors.buttonColor} style={styles.labelIcon} />
            <Text style={[typography.styles.body, { color: colors.text, fontFamily: fonts.semibold }]}>
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
              editable={!isOAuthUser}
              pointerEvents={isOAuthUser ? 'none' : 'auto'}
              autoCapitalize="none"
              secureTextEntry={!showCurrentPassword}
              autoComplete="password"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isOAuthUser}
            >
              <PhosphorIcon
                icon={showCurrentPassword ? ICONS.visible : ICONS.hidden}
                size={20}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <View style={{
              width: 20,
              height: 20,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: colors.muted,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 6,
            }}>
              <PhosphorIcon icon={ICONS.info} size={14} color={colors.muted} />
            </View>
            <Text style={[typography.styles.subhead, { color: colors.muted, flex: 1 }]}>
              {t('editProfile.currentPasswordNote')}
            </Text>
          </View>
        </View>

        {/* Password Card - OAuth kullanıcıda kilitli */}
        <View style={[styles.inputCard, {
          backgroundColor: colors.cardBackground,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
          borderColor: colors.cardBorder,
          borderWidth: 1,
          opacity: isOAuthUser ? 0.80 : 1,
          position: 'relative',
        }]}>
          {isOAuthUser && (
            <View style={{ position: 'absolute', top: 16, right: 20, zIndex: 10 }}>
              <PhosphorIcon icon={ICONS.locked} size={22} color={colors.muted} />
            </View>
          )}
          <View style={styles.labelRow}>
            <PhosphorIcon icon={ICONS.password} size={20} color={colors.buttonColor} style={styles.labelIcon} />
            <Text style={[typography.styles.body, { color: colors.text, fontFamily: fonts.semibold }]}>
              {t('editProfile.newPassword')}
            </Text>
            <Text style={[typography.styles.subhead, { color: colors.muted, marginLeft: 6 }]}>
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
              editable={!isOAuthUser}
              pointerEvents={isOAuthUser ? 'none' : 'auto'}
              autoCapitalize="none"
              secureTextEntry={!showPassword}
              autoComplete="password-new"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isOAuthUser}
            >
              <PhosphorIcon
                icon={showPassword ? ICONS.visible : ICONS.hidden}
                size={20}
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
              editable={!isOAuthUser}
              pointerEvents={isOAuthUser ? 'none' : 'auto'}
              autoCapitalize="none"
              secureTextEntry={!showPasswordConfirm}
              autoComplete="password-new"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isOAuthUser}
            >
              <PhosphorIcon
                icon={showPasswordConfirm ? ICONS.visible : ICONS.hidden}
                size={20}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
            <PhosphorIcon icon={ICONS.info} size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={[typography.styles.subhead, { color: colors.error, flex: 1 }]}>{error}</Text>
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
      </FormScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  inputCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    padding: 20,
    marginBottom: 12,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  labelIcon: {
    marginRight: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    flexDirection: 'column',
    marginTop: -120,
  },
  profilePhotoContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eee',
    borderWidth: 3,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    flex: 1,
    maxWidth: 150,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    width: '100%',
    fontSize: fontSizes.body,
  },
  passwordInputContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  passwordInput: {
    paddingRight: 45,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 14,
    padding: 4,
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
    gap: 20,
    marginTop: 16,
    marginBottom: 32,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
}); 