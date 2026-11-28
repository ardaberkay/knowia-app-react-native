import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, StatusBar, Alert, Keyboard, Platform, Pressable } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { MenuView } from '@expo/ui/community/menu';
import { Image } from '../../components/ui/AppImage';
import { Text } from '../../components/ui/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FormScrollView from '../../components/layout/FormScrollView';
import {
  useForm, useUnsavedChangesGuard, confirmDiscard, FORM_SIDE_PADDING,
  FormActions, FormCard, FormField,
} from '../../components/layout/FormField';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { getCurrentUserProfile, updateProfile } from '../../services/ProfileService';
import { uploadAvatar, removeAvatar, storagePathFromPublicUrl, pickResizedImage, readFileBuffer } from '../../services/StorageService';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { cacheProfile, cacheProfileImage, clearUserCache } from '../../services/CacheService';
import { useTranslation } from 'react-i18next';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { triggerHaptic } from '../../lib/hapticManager';
import { PROFILE_LIMITS } from '../../lib/limits';
import CreateButton from '../../components/tools/CreateButton';
import LottieView from 'lottie-react-native';
import PhosphorIcon from '../../components/ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

const ACCENT = '#F98A21';
const AVATAR_SIZE = 112;
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isLocalFile = (uri) => Boolean(uri) && !/^https?:\/\//i.test(uri);

// The current password is checked by signing in with it again.
const verifyPassword = async (email, password) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password }).catch((e) => ({ error: e }));
  return !error;
};

/**
 * E-mail or password change in its own native sheet (only the fields that
 * change needs). kind: 'email' | 'password'. Saves on its own; onDone closes.
 */
function AccountSheet({ kind, visible, currentEmail, onClose }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError } = useSnackbarHelpers();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);
  const confirmRef = useRef(null);
  const currentRef = useRef(null);

  const sheetRef = useRef(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    if (visible) {
      setEmail(''); setPassword(''); setPasswordConfirm(''); setCurrentPassword(''); setErrors({});
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);
  const handleSheetDismiss = () => { if (visibleRef.current) onClose(); };

  const fail = (field, message, ref) => {
    setErrors({ [field]: message });
    triggerHaptic('error');
    requestAnimationFrame(() => ref?.current?.focus());
  };
  const clearError = (field) => setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (kind === 'email') {
      const next = email.trim();
      if (!isValidEmail(next)) return fail('email', t('editProfile.invalidEmail'), firstRef);
      if (next.toLowerCase() === (currentEmail || '').toLowerCase()) return fail('email', t('editProfile.sameEmail', 'Bu zaten mevcut e-posta adresin.'), firstRef);
    } else {
      if (!password) return fail('password', t('editProfile.newPasswordRequired', 'Yeni şifreyi yaz.'), firstRef);
      if (password !== passwordConfirm) return fail('passwordConfirm', t('common.passwordMatchError'), confirmRef);
    }
    if (!currentPassword) return fail('currentPassword', t('editProfile.currentPasswordRequired'), currentRef);

    setSaving(true);
    try {
      if (!(await verifyPassword(currentEmail, currentPassword))) {
        fail('currentPassword', t('editProfile.invalidCurrentPassword'), currentRef);
        return;
      }
      if (kind === 'email') {
        const { error } = await supabase.auth.updateUser({ email: email.trim() });
        if (error) {
          const exists = /already registered|already exists/i.test(error.message || '');
          fail('email', exists ? t('editProfile.emailAlreadyExists') : error.message, firstRef);
          return;
        }
        onClose();
        Alert.alert(t('editProfile.emailChangeTitle'), t('editProfile.emailChangeMessage'), [{ text: t('common.ok') }]);
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          showError(error.message);
          return;
        }
        onClose();
        showSuccess(t('editProfile.passwordUpdated', 'Şifren güncellendi.'));
      }
    } catch (e) {
      showError(e?.message || t('common.profileUpdatedError'));
    } finally {
      setSaving(false);
    }
  };

  const title = kind === 'email' ? t('editProfile.changeEmail', 'E-postayı değiştir') : t('editProfile.changePassword', 'Şifreyi değiştir');

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={handleSheetDismiss}
      enablePanDownToClose={!saving}
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
    >
      <BottomSheetView style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={[typography.styles.title2, styles.sheetTitle, { color: colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} disabled={saving} style={styles.sheetClose} hitSlop={10}>
            <PhosphorIcon icon={ICONS.close} size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={[styles.sheetBody, { paddingBottom: insets.bottom + 16 }]}>
          {kind === 'email' ? (
            <FormField
              ref={firstRef}
              icon={ICONS.email}
              label={t('editProfile.newEmail', 'Yeni e-posta')}
              value={email}
              onChangeText={(v) => { setEmail(v); clearError('email'); }}
              placeholder={currentEmail || t('editProfile.emailPlaceholder')}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              error={errors.email}
            />
          ) : (
            <>
              <FormField
                ref={firstRef}
                icon={ICONS.password}
                label={t('editProfile.newPassword')}
                value={password}
                onChangeText={(v) => { setPassword(v); clearError('password'); }}
                placeholder={t('editProfile.newPasswordPlaceholder')}
                autoCapitalize="none"
                autoComplete="password-new"
                secure
                error={errors.password}
              />
              <FormField
                ref={confirmRef}
                icon={ICONS.password}
                label={t('editProfile.confirmPasswordPlaceholder')}
                value={passwordConfirm}
                onChangeText={(v) => { setPasswordConfirm(v); clearError('passwordConfirm'); }}
                placeholder={t('editProfile.confirmPasswordPlaceholder')}
                autoCapitalize="none"
                autoComplete="password-new"
                secure
                error={errors.passwordConfirm}
              />
            </>
          )}
          <FormField
            ref={currentRef}
            icon={ICONS.locked}
            label={t('editProfile.currentPassword')}
            value={currentPassword}
            onChangeText={(v) => { setCurrentPassword(v); clearError('currentPassword'); }}
            placeholder={t('editProfile.currentPasswordPlaceholder')}
            autoCapitalize="none"
            autoComplete="password"
            secure
            error={errors.currentPassword}
            hint={t('editProfile.currentPasswordWhy', 'Bu değişikliği senin yaptığından emin olmak için.')}
          />
          <CreateButton
            onPress={handleSubmit}
            disabled={saving}
            loading={saving}
            text={saving ? t('editProfile.saving') : t('editProfile.update', 'Güncelle')}
            style={styles.sheetButton}
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

/**
 * "Profili Düzenle": avatar (tap → choose / remove), username card, and the
 * e-mail / password rows that open their own sheets. Save covers photo + name.
 */
export default function EditProfileScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError } = useSnackbarHelpers();
  const { refetch: refetchProfile } = useProfile();
  const { session } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFilePath, setImageFilePath] = useState(null); // storage path of the saved photo
  const [sheet, setSheet] = useState(null); // 'email' | 'password' | null
  const { values, setValue, errors, setErrors, reset, isDirty, initialValues } = useForm({ username: '', image: '' });
  const leave = useUnsavedChangesGuard(isDirty);
  const usernameRef = useRef(null);
  const email = profile?.email || session?.user?.email || '';

  const isOAuthUser = useMemo(() => {
    const provider = session?.user?.app_metadata?.provider;
    if (provider === 'google' || provider === 'apple') return true;
    return session?.user?.identities?.some((i) => i.provider === 'google' || i.provider === 'apple') ?? false;
  }, [session]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        if (!session?.user?.id) throw new Error(t('common.sessionNotFound') || 'Oturum bulunamadı');
        const data = await getCurrentUserProfile(session.user.id);
        setProfile(data);
        reset({ username: data.username || '', image: data.image_url || '' });
        setImageFilePath(data.image_url ? storagePathFromPublicUrl(data.image_url, 'avatars') : null);
      } catch (err) {
        showError(err.message || t('common.profileUpdatedError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  const handlePickImage = async () => {
    try {
      const uri = await pickResizedImage();
      if (uri) setValue('image', uri);
    } catch {
      showError(t('common.imageNotSelected'));
    }
  };

  const photoActions = [
    { id: 'pick', title: t('editProfile.choosePhoto', 'Fotoğraf seç'), image: 'photo' },
    values.image ? { id: 'remove', title: t('editProfile.removePhotoAction', 'Fotoğrafı kaldır'), image: 'trash', attributes: { destructive: true } } : null,
  ].filter(Boolean);

  const handleUndo = () => {
    Keyboard.dismiss();
    confirmDiscard(t, isDirty, () => reset());
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    const name = values.username.trim();
    if (name.length < PROFILE_LIMITS.usernameMin || name.length > PROFILE_LIMITS.usernameMax) {
      setErrors({ username: t('common.usernameLengthError') });
      triggerHaptic('error');
      usernameRef.current?.focus();
      return;
    }
    setSaving(true);
    let uploadedFilePath = null;
    try {
      // new photo → upload (the old file is removed once the save succeeds); '' = removed
      const imageChanged = values.image !== initialValues.image;
      let newImageUrl = values.image;
      if (imageChanged && isLocalFile(values.image)) {
        const result = await uploadAvatar(profile.id, await readFileBuffer(values.image));
        uploadedFilePath = result.filePath;
        newImageUrl = result.publicUrl;
      }
      if (imageChanged && !values.image) newImageUrl = '';

      try {
        await updateProfile(profile.id, { username: name, imageUrl: newImageUrl });
      } catch (updateErr) {
        if (uploadedFilePath) removeAvatar(uploadedFilePath).catch(() => { });
        throw updateErr;
      }
      if (imageChanged && imageFilePath) removeAvatar(imageFilePath).catch(() => { });
      if (imageChanged) setImageFilePath(uploadedFilePath);

      await clearUserCache(profile.id);
      const updatedProfile = await getCurrentUserProfile(profile.id);
      await cacheProfile(profile.id, updatedProfile);
      if (newImageUrl) await cacheProfileImage(profile.id, newImageUrl);
      await refetchProfile();

      showSuccess(t('common.profileUpdated'));
      reset({ username: name, image: newImageUrl });
      leave(() => navigation.goBack());
    } catch (err) {
      showError(err?.message || t('common.profileUpdatedError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LottieView source={require('../../assets/animations/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 160, height: 160 }} />
        <LottieView source={require('../../assets/animations/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100, marginTop: -65 }} />
      </View>
    );
  }

  const renderAccountRow = (key, icon, label, value) => (
    <Pressable
      onPress={() => { if (isOAuthUser) return; triggerHaptic('selection'); Keyboard.dismiss(); setSheet(key); }}
      disabled={isOAuthUser}
      accessibilityRole="button"
      style={({ pressed }) => [styles.accountRow, { opacity: isOAuthUser ? 0.5 : pressed ? 0.7 : 1 }]}
    >
      <PhosphorIcon icon={icon} size={18} color={ACCENT} />
      <Text style={[styles.accountLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.accountValue, { color: colors.muted }]} numberOfLines={1}>{value}</Text>
      <PhosphorIcon icon={isOAuthUser ? ICONS.locked : ICONS.chevronRight} size={16} color={colors.muted} />
    </Pressable>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <FormScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* avatar: tap → choose / remove */}
        <MenuView
          actions={photoActions}
          onOpenMenu={() => triggerHaptic('selection')}
          onPressAction={({ nativeEvent }) => {
            if (nativeEvent.event === 'pick') handlePickImage();
            else if (nativeEvent.event === 'remove') setValue('image', ''); // removed from storage after Save
          }}
          style={styles.avatarWrap}
        >
          <View>
            <Image
              source={values.image ? { uri: values.image } : require('../../assets/images/avatar_default.webp')}
              style={[styles.avatar, { borderColor: colors.cardBorder }]}
            />
            <View style={[styles.avatarBadge, { backgroundColor: ACCENT, borderColor: colors.background }]}>
              <PhosphorIcon icon={ICONS.edit} size={16} color="#FFFFFF" />
            </View>
          </View>
        </MenuView>

        <FormCard>
          <FormField
            ref={usernameRef}
            icon={ICONS.user}
            label={t('editProfile.userName')}
            value={values.username}
            onChangeText={(v) => setValue('username', v)}
            maxLength={PROFILE_LIMITS.usernameMax}
            placeholder={t('editProfile.userNamePlaceholder')}
            autoCapitalize="none"
            error={errors.username}
            hint={t('editProfile.usernameHint')}
          />
        </FormCard>

        <FormCard style={styles.accountCard}>
          {renderAccountRow('email', ICONS.email, t('editProfile.email'), email)}
          <View style={[styles.rowDivider, { backgroundColor: colors.cardBorder }]} />
          {renderAccountRow('password', ICONS.password, t('editProfile.password', 'Şifre'), '••••••••')}
        </FormCard>
        {isOAuthUser ? (
          <Text style={[styles.oauthNote, { color: colors.muted }]}>
            {t('editProfile.oauthLocked', 'Google veya Apple ile giriş yaptığın için e-posta ve şifre buradan değiştirilemez.')}
          </Text>
        ) : null}

        <FormActions
          primaryText={saving ? t('editProfile.saving') : t('editProfile.save')}
          onPrimary={handleSave}
          loading={saving}
          secondaryText={t('form.undoChanges', 'Değişiklikleri geri al')}
          onSecondary={handleUndo}
          showSecondary={isDirty}
        />
      </FormScrollView>

      <AccountSheet kind="email" visible={sheet === 'email'} currentEmail={email} onClose={() => setSheet(null)} />
      <AccountSheet kind="password" visible={sheet === 'password'} currentEmail={email} onClose={() => setSheet(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: FORM_SIDE_PADDING, paddingTop: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200, marginTop: -120 },

  avatarWrap: { alignSelf: 'center', marginBottom: 22 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 3, backgroundColor: '#3A3A3A' },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  accountCard: { paddingVertical: 4 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  accountLabel: { fontSize: fontSizes.subhead, fontFamily: fonts.semibold },
  accountValue: { flex: 1, textAlign: 'right', fontSize: fontSizes.subhead, fontFamily: fonts.regular },
  rowDivider: { height: StyleSheet.hairlineWidth },
  oauthNote: { width: '100%', maxWidth: 440, fontSize: fontSizes.footnote, lineHeight: 18, paddingHorizontal: 8, marginTop: -4, marginBottom: 12 },


  sheet: { paddingHorizontal: 20, paddingTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { flex: 1, fontFamily: fonts.bold },
  sheetClose: { backgroundColor: 'rgba(150, 150, 150, 0.14)', padding: 7, borderRadius: 99 },
  sheetBody: { gap: 18 },
  sheetButton: { flex: 0, marginTop: 4 },
});
