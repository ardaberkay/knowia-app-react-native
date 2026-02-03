import { useState, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ImageBackground, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import LanguageSelector from '../../components/modals/LanguageSelector';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const emailInputRef = useRef(null);
  const { login, signInWithGoogle, signInWithApple, resetPasswordForEmail } = useAuth();
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  
  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  // Küçük cihazlar ve tablet için responsive paddingTop - useMemo ile optimize edilmiş
  const containerPaddingTop = useMemo(() => {
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    const isSmallScreen = height < RESPONSIVE_CONSTANTS.SMALL_SCREEN_MAX_HEIGHT;
    
    // Tablet için paddingTop'u azalt
    if (isTablet) {
      return height * 0.30; // Tablet: %20
    }
    // Küçük telefonlarda paddingTop'u azalt
    if (isSmallPhone) {
      return height * 0.25; // Küçük telefon: %25
    } else if (isSmallScreen) {
      return height * 0.70; // Küçük ekran: %70
    } else {
      return height * 0.4; // Normal ekranlar: %40
    }
  }, [width, height, isTablet]);


  const handleLogin = async () => {
    if (loading) return;

    try {
      setLoading(true);
      const { error } = await login(email, password);
      if (error) throw error;
    } catch (error) {
      // Hata mesajını veya kodunu kontrol ediyoruz
      let errorMessage = t('login.error_generic', 'Bir hata oluştu');

      if (error.message === 'Invalid login credentials' || error.status === 400) {
        errorMessage = t('login.invalid_credentials', 'E-posta veya şifre hatalı.');
      } else if (error.message.includes('network')) {
        errorMessage = t('login.network_error', 'İnternet bağlantınızı kontrol edin.');
      }

      Alert.alert(t('login.error_title', 'Hata'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;

    try {
      console.log('Google girişi başlatılıyor...');
      setLoading(true);
      const { error } = await signInWithGoogle();
      console.log('Google girişi yanıtı:', error ? 'Hata var' : 'Başarılı');
      if (error) {
        console.log('Google giriş hatası:', error.message);
        throw error;
      }
    } catch (error) {
      console.log('Google giriş catch bloğu:', error);
      Alert.alert(t('login.error', 'Hata'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    if (loading) return;

    try {
      console.log('Apple girişi başlatılıyor...');
      setLoading(true);
      const { error } = await signInWithApple();
      console.log('Apple girişi yanıtı:', error ? 'Hata var' : 'Başarılı');
      if (error) {
        console.log('Apple giriş hatası:', error.message);
        throw error;
      }
    } catch (error) {
      console.log('Apple giriş catch bloğu:', error);
      Alert.alert(t('login.error', 'Hata'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = async (lng) => {
    await i18n.changeLanguage(lng);
    setLanguageModalVisible(false);
  };

  return (
    <ImageBackground
      source={require('../../assets/bg.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.container, { paddingTop: containerPaddingTop }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={verticalScale(50)}
      >
        <View style={styles.form}>
          {/* Dil seçimi butonu */}
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setLanguageModalVisible(true)}
          >
            <Iconify icon="material-symbols:translate-rounded" size={moderateScale(20)} color="#fff" />
            <Text style={[styles.languageButtonText, { color: '#fff' }]}>
              {i18n.language === 'tr' ? 'Türkçe' : i18n.language === 'en' ? 'English' : i18n.language === 'es' ? 'Spanish' : i18n.language === 'fr' ? 'French' : i18n.language === 'pt' ? 'Portuguese' : i18n.language === 'ar' ? 'Arabic' : ''}
            </Text>
          </TouchableOpacity>
          <View style={[styles.inputContainer, emailError && { borderColor: colors.error || '#FF3B30', borderWidth: moderateScale(2) }]}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: scale(25), height: verticalScale(22)}}>
              <Iconify icon="tabler:mail-filled" size={moderateScale(22)} color={emailError ? (colors.error || '#FF3B30') : colors.muted} /></View>
            <TextInput
              ref={emailInputRef}
              style={[styles.input, typography.styles.body]}
              placeholder={t('login.emailPlaceholder', 'E-posta')}
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError(false);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.inputContainer}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: scale(25), height: verticalScale(22)}}>
              <Iconify icon="carbon:password" size={moderateScale(22)} color={colors.muted} /></View>
            <TextInput
              style={[styles.input, typography.styles.body]}
              placeholder={t('login.passwordPlaceholder', 'Şifre')}
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(prev => !prev)}
              style={{justifyContent: 'center', alignItems: 'center', width: scale(28), height: verticalScale(22)}}
              disabled={loading}
            >
              <Iconify icon={showPassword ? 'oi:eye' : 'system-uicons:eye-no'} size={moderateScale(22)} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotTextButton}
            onPress={async () => {
              if (!email.trim()) {
                setEmailError(true);
                emailInputRef.current?.focus();
                Alert.alert(
                  t('login.error', 'Hata'),
                  t('login.emailRequired', 'Lütfen e-posta adresinizi girin.')
                );
                return;
              }
              
              try {
                setLoading(true);
                const { error } = await resetPasswordForEmail(email.trim());
                if (error) throw error;
                
                Alert.alert(
                  t('login.success', 'Başarılı'),
                  t('login.resetPasswordSent', 'Şifre sıfırlama linki e-posta adresinize gönderildi. Lütfen e-postanızı kontrol edin.'),
                  [{ text: t('login.ok', 'Tamam') }]
                );
              } catch (error) {
                Alert.alert(t('login.error', 'Hata'), error.message);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            <Text style={[typography.styles.link, { color: colors.secondary, fontWeight: 'semibold', right: scale(6), marginBottom: verticalScale(-10)}]}>{t('login.forgotPassword', 'Şifremi Unuttum')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.buttonColor }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={[styles.buttonText, typography.styles.button, { color: colors.buttonText }]}>
              {loading ? t('login.loading', 'Giriş yapılıyor...') : t('login.login', 'Giriş Yap')}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, typography.styles.caption, { color: colors.text }]}>{t('login.or', 'YA DA')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, { backgroundColor: 'rgba(255, 255, 255, 0.95)' }]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Iconify icon="logos:google-icon" size={moderateScale(24)} color="#DB4437" />
            <Text style={[styles.googleButtonText, typography.styles.button, { color: '#000' }]}>
              {t('login.loginWithGoogle', 'Google ile devam et')}
            </Text>
          </TouchableOpacity>

          {/* Apple ile giriş butonu - sadece iOS'ta görünür */}
          
            <TouchableOpacity
              style={[styles.appleButton, { backgroundColor: 'rgba(255, 255, 255, 0.95)' }]}
              onPress={handleAppleLogin}
              disabled={loading}
            >
              <Iconify icon="grommet-icons:apple" size={moderateScale(24)} color="#000" />
              <Text style={[styles.appleButtonText, typography.styles.button, { color: '#000' }]}>
                {t('login.loginWithApple', 'Apple ile Giriş Yap')}
              </Text>
            </TouchableOpacity>
          

          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: moderateScale(8), paddingHorizontal: scale(12), paddingVertical: verticalScale(8) }]}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={[styles.linkText, typography.styles.link, { color: colors.secondary }]}>
              {t('login.didUAcc', 'Hesabın yok mu?')} {' '}
              <Text style={typography.styles.linkBold}>{t('login.register', 'Kayıt ol')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>

      {/* Dil seçici component */}
      <LanguageSelector
        isVisible={isLanguageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
        onLanguageChange={handleLanguageChange}
      />
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
    padding: scale(20),
    // paddingTop dinamik olarak uygulanacak
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: verticalScale(10),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: scale(1), height: verticalScale(1) },
    textShadowRadius: moderateScale(3),
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
  button: {
    padding: moderateScale(15),
    borderRadius: moderateScale(10),
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    // fontSize ve fontFamily artık typography'den geliyor
  },
  linkButton: {

    alignItems: 'center',
  },
  linkText: {
    // fontSize ve fontFamily artık typography'den geliyor
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',

  },
  dividerLine: {
    flex: 1,
    height: moderateScale(1),
  },
  dividerText: {
    marginHorizontal: scale(10),
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(15),
    borderRadius: moderateScale(10),
    gap: scale(10),
  },
  googleButtonText: {
    marginLeft: scale(10),
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(15),
    borderRadius: moderateScale(10),
    gap: scale(10),
  },
  appleButtonText: {
    marginLeft: scale(10),
  },
  buttonRow: {
    flexDirection: 'row',
    gap: scale(4),
    marginBottom: verticalScale(10),
  },
  forgotButton: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: moderateScale(1),
    borderColor: '#FF992B',
  },
  forgotTextButton: {
    alignSelf: 'flex-end',
    marginBottom: verticalScale(6),
  },
  languageButton: {
    position: 'absolute',
    right: 0,
    top: verticalScale(-50),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(20),
    gap: scale(6),
  },
  languageButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
}); 