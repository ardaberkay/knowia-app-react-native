import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ImageBackground, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function ResetPasswordScreen({ navigation }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tokens, setTokens] = useState(null);
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

  // AsyncStorage'dan token'ları al
  useEffect(() => {
    // Recovery modunu aktifleştir (session olsa bile auth stack'te kal)
    setIsRecoveryMode(true);
    
    const loadTokens = async () => {
      try {
        const access_token = await AsyncStorage.getItem('recovery_access_token');
        const refresh_token = await AsyncStorage.getItem('recovery_refresh_token');
        
        console.log('ResetPassword: Token\'lar yükleniyor...', access_token ? 'Var' : 'Yok');
        
        if (access_token && refresh_token) {
          setTokens({ access_token, refresh_token });
          console.log('ResetPassword: Token\'lar yüklendi');
        } else {
          console.log('ResetPassword: Token bulunamadı');
          setIsRecoveryMode(false);
          Alert.alert(
            t('resetPassword.error', 'Hata'),
            t('resetPassword.tokenNotFound', 'Şifre sıfırlama linki geçersiz veya süresi dolmuş. Lütfen yeni bir link talep edin.'),
            [{ text: t('resetPassword.ok', 'Tamam'), onPress: () => navigation.navigate('Login') }]
          );
        }
      } catch (err) {
        console.log('ResetPassword: Token yükleme hatası:', err);
        setIsRecoveryMode(false);
        Alert.alert(
          t('resetPassword.error', 'Hata'),
          t('resetPassword.tokenError', 'Bir hata oluştu. Lütfen tekrar deneyin.'),
          [{ text: t('resetPassword.ok', 'Tamam'), onPress: () => navigation.navigate('Login') }]
        );
      } finally {
        setInitializing(false);
      }
    };
    
    loadTokens();
    
    // Cleanup: Sayfa unmount olduğunda
    return () => {
      // Recovery modunu kapat
      setIsRecoveryMode(false);
      // Session aktifse signOut yap
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          console.log('ResetPassword: Cleanup - Session temizleniyor');
          supabase.auth.signOut();
        }
      });
    };
  }, []);

  const handleResetPassword = async () => {
    if (loading || !isPasswordValid) return;
    
    if (!tokens) {
      Alert.alert(t('resetPassword.error', 'Hata'), t('resetPassword.tokenNotFound', 'Şifre sıfırlama linki geçersiz.'));
      return;
    }

    try {
      setLoading(true);
      
      // Önce token'larla session set et (şifre güncellemek için gerekli)
      console.log('ResetPassword: Session set ediliyor...');
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      
      if (sessionError) {
        console.log('ResetPassword: Session error:', sessionError);
        throw new Error(t('resetPassword.sessionError', 'Oturum açılamadı. Lütfen linki tekrar kontrol edin.'));
      }
      
      console.log('ResetPassword: Session set edildi, şifre güncelleniyor...');
      
      // Şifreyi güncelle
      const { error: updateError } = await supabase.auth.updateUser({
        password: password.trim()
      });
      
      if (updateError) throw updateError;
      
      console.log('ResetPassword: Şifre güncellendi');
      
      // Token'ları AsyncStorage'dan temizle
      await AsyncStorage.removeItem('recovery_access_token');
      await AsyncStorage.removeItem('recovery_refresh_token');
      
      // Logout yap (kullanıcı yeni şifresiyle giriş yapsın)
      await supabase.auth.signOut();
      
      // Recovery modunu kapat
      setIsRecoveryMode(false);
      
      Alert.alert(
        t('resetPassword.success', 'Başarılı'),
        t('resetPassword.successMessage', 'Şifreniz başarıyla güncellendi. Lütfen yeni şifrenizle giriş yapın.'),
        [
          {
            text: t('resetPassword.ok', 'Tamam'),
            onPress: () => navigation.navigate('Login')
          }
        ]
      );
    } catch (error) {
      console.log('ResetPassword: Hata:', error);
      // Session aktif kalır, kullanıcı tekrar deneyebilir
      // Sayfadan ayrılırsa cleanup'ta signOut yapılacak
      Alert.alert(t('resetPassword.error', 'Hata'), error.message);
    } finally {
      setLoading(false);
    }
  };

  // Validation item component
  const ValidationItem = ({ isValid, text }) => (
    <View style={styles.validationItem}>
      <Iconify 
        icon={isValid ? 'solar:library-bold-duotone' : 'solar:library-line-duotone'} 
        size={moderateScale(18)} 
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
        source={require('../../assets/bg.png')}
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
      source={require('../../assets/bg.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <View style={styles.form}>
          {/* Şifre input */}
          <View style={styles.inputContainer}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: scale(25), height: verticalScale(22)}}>
              <Iconify icon="carbon:password" size={moderateScale(22)} color={colors.muted} />
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
              style={{justifyContent: 'center', alignItems: 'center', width: scale(28), height: verticalScale(22)}}
              disabled={loading}
            >
              <Iconify icon={showPassword ? 'oi:eye' : 'system-uicons:eye-no'} size={moderateScale(22)} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Şifre onay input */}
          <View style={styles.inputContainer}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: scale(25), height: verticalScale(22)}}>
              <Iconify icon="carbon:password" size={moderateScale(22)} color={colors.muted} />
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
              style={{justifyContent: 'center', alignItems: 'center', width: scale(28), height: verticalScale(22)}}
              disabled={loading}
            >
              <Iconify icon={showConfirmPassword ? 'oi:eye' : 'system-uicons:eye-no'} size={moderateScale(22)} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Şifre koşulları */}
          <View style={[styles.validationContainer, { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: moderateScale(10), padding: scale(12) }]}>
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
            <Text style={[styles.buttonText, typography.styles.button, { color: colors.buttonText }]}>
              {loading ? t('resetPassword.updating', 'Güncelleniyor...') : t('resetPassword.updatePassword', 'Şifreyi Güncelle')}
            </Text>
          </TouchableOpacity>

          {/* Giriş yap linki */}
          <View style={styles.loginLinkContainer}>
            <Text style={[typography.styles.body, { color: colors.text }]}>
              {t('resetPassword.rememberPassword', 'Şifreni mi hatırladın?')}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
              <Text style={[typography.styles.link, { color: colors.secondary, fontWeight: '600', marginLeft: scale(5) }]}>
                {t('resetPassword.loginLink', 'Giriş yap')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  container: {
    flex: 1,
    padding: scale(20),
    marginTop: verticalScale(180),
    justifyContent: 'center',
  },
  form: {
    gap: verticalScale(15),
  },
  input: {
    flex: 1,
    paddingVertical: verticalScale(12),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: moderateScale(1),
    borderColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(10),
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    gap: scale(8),
  },
  validationContainer: {
    gap: verticalScale(8),
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  validationText: {
    fontSize: moderateScale(14),
    fontFamily: 'Inter',
  },
  button: {
    padding: moderateScale(15),
    borderRadius: moderateScale(10),
    alignItems: 'center',
    marginTop: verticalScale(10),
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
    marginTop: verticalScale(15),
  },
});
