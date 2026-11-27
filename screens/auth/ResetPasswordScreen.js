import { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, ImageBackground, ActivityIndicator } from 'react-native';
import { Text, TextInput } from '../../components/ui/AppText';
import FormScrollView from '../../components/layout/FormScrollView';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PhosphorIcon from '../../components/ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { setIsRecoveryMode } = useAuth();

  // Şifre validasyonu
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasMinLength = password.length >= 6;
  const passwordsMatch = password === confirmPassword && password.length > 0;
  
  const isPasswordValid = hasUpperCase && hasLowerCase && hasNumber && hasMinLength && passwordsMatch;

  const completedRef = useRef(false);

  // AuthContext already exchanged the reset link's one-time code for a session
  // (PKCE) and switched the app into recovery mode. No session = bad/expired link.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data?.session) {
        Alert.alert(
          t('resetPassword.error', 'Hata'),
          t('resetPassword.tokenNotFound', 'Şifre sıfırlama linki geçersiz veya süresi dolmuş. Lütfen yeni bir link talep edin.'),
          [{ text: t('resetPassword.ok', 'Tamam'), onPress: () => setIsRecoveryMode(false) }]
        );
      }
      setInitializing(false);
    });
    return () => { active = false; };
  }, []);

  // Leaving without saving: drop the recovery session so it can't be used to log in.
  const exitRecovery = useCallback(async () => {
    if (!completedRef.current) {
      try { await supabase.auth.signOut(); } catch { }
    }
    setIsRecoveryMode(false);
  }, [setIsRecoveryMode]);

  const handleResetPassword = async () => {
    if (loading || !isPasswordValid) return;
    try {
      setLoading(true);
      const { error: updateError } = await supabase.auth.updateUser({
        password: password.trim()
      });
      if (updateError) throw updateError;

      // The user logs in again with the new password.
      completedRef.current = true;
      await supabase.auth.signOut();

      Alert.alert(
        t('resetPassword.success', 'Başarılı'),
        t('resetPassword.successMessage', 'Şifreniz başarıyla güncellendi. Lütfen yeni şifrenizle giriş yapın.'),
        [{ text: t('resetPassword.ok', 'Tamam'), onPress: () => setIsRecoveryMode(false) }]
      );
    } catch (error) {
      Alert.alert(t('resetPassword.error', 'Hata'), error.message);
    } finally {
      setLoading(false);
    }
  };

  // Validation item component
  const ValidationItem = ({ isValid, text }) => (
    <View style={styles.validationItem}>
      <PhosphorIcon 
        icon={isValid ? ICONS.valid : ICONS.invalid} 
        size={18} 
        color={isValid ? '#4CAF50' : colors.muted} 
      />
      <Text style={[
        styles.validationText, 
        { color: isValid ? '#4CAF50' : colors.muted }
      ]}>
        {text}
      </Text>
    </View>
  );

  // Token yüklenirken loading göster
  if (initializing) {
    return (
      <ImageBackground
        source={require('../../assets/images/bg.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.buttonColor} />
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/images/bg.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <FormScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        extraScrollHeight={50}
      >
        <View style={styles.form}>
          {/* Şifre input */}
          <View style={styles.inputContainer}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: 25, height: 22}}>
              <PhosphorIcon icon={ICONS.password} size={22} color={colors.muted} />
            </View>
            <TextInput
              style={[styles.input, typography.styles.body]}
              placeholder={t('resetPassword.newPassword', 'Yeni Şifre')}
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(prev => !prev)}
              style={{justifyContent: 'center', alignItems: 'center', width: 28, height: 22}}
              disabled={loading}
            >
              <PhosphorIcon icon={showPassword ? ICONS.visible : ICONS.hidden} size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Şifre onay input */}
          <View style={styles.inputContainer}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: 25, height: 22}}>
              <PhosphorIcon icon={ICONS.password} size={22} color={colors.muted} />
            </View>
            <TextInput
              style={[styles.input, typography.styles.body]}
              placeholder={t('resetPassword.confirmPassword', 'Şifreyi Onayla')}
              placeholderTextColor={colors.muted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(prev => !prev)}
              style={{justifyContent: 'center', alignItems: 'center', width: 28, height: 22}}
              disabled={loading}
            >
              <PhosphorIcon icon={showConfirmPassword ? ICONS.visible : ICONS.hidden} size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Şifre koşulları */}
          <View style={[styles.validationContainer, { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 10, padding: 12 }]}>
            <ValidationItem 
              isValid={hasMinLength} 
              text={t('resetPassword.minLength', 'En az 6 karakter')} 
            />
            <ValidationItem 
              isValid={hasUpperCase} 
              text={t('resetPassword.hasUpperCase', 'En az 1 büyük harf (A-Z)')} 
            />
            <ValidationItem 
              isValid={hasLowerCase} 
              text={t('resetPassword.hasLowerCase', 'En az 1 küçük harf (a-z)')} 
            />
            <ValidationItem 
              isValid={hasNumber} 
              text={t('resetPassword.hasNumber', 'En az 1 rakam (0-9)')} 
            />
            <ValidationItem 
              isValid={passwordsMatch} 
              text={t('resetPassword.passwordsMatch', 'Şifreler eşleşiyor')} 
            />
          </View>

          {/* Güncelle butonu - koşullar sağlanmazsa disabled */}
          <TouchableOpacity
            style={[
              styles.button, 
              { backgroundColor: isPasswordValid ? colors.buttonColor : colors.muted },
              loading && styles.buttonDisabled
            ]}
            onPress={handleResetPassword}
            disabled={loading || !isPasswordValid}
          >
            <Text style={[styles.buttonText, typography.styles.headline, { color: colors.buttonText }]}>
              {loading ? t('resetPassword.updating', 'Güncelleniyor...') : t('resetPassword.updatePassword', 'Şifreyi Güncelle')}
            </Text>
          </TouchableOpacity>

          {/* Giriş yap linki */}
          <View style={styles.loginLinkContainer}>
            <Text style={[typography.styles.body, { color: colors.text }]}>
              {t('resetPassword.rememberPassword', 'Şifreni mi hatırladın?')}
            </Text>
            <TouchableOpacity onPress={exitRecovery} disabled={loading}>
              <Text style={[typography.styles.body, { color: colors.secondary, fontFamily: fonts.semibold, marginLeft: 5 }]}>
                {t('resetPassword.loginLink', 'Giriş yap')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </FormScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 20,
    marginTop: 180,
    justifyContent: 'center',
  },
  form: {
    gap: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    gap: 8,
  },
  validationContainer: {
    gap: 8,
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  validationText: {
    fontSize: fontSizes.subhead,
    fontFamily: fonts.regular,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    // fontSize ve fontFamily typography'den geliyor
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },
});
