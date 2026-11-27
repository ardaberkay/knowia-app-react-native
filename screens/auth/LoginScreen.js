import { useState, useRef, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, ImageBackground, Platform, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '../../components/ui/AppText';
import FormScrollView from '../../components/layout/FormScrollView';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import LanguageSelector from '../../components/modals/LanguageSelector';
import PhosphorIcon from '../../components/ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

// Google's multicolour "G" (Google sign-in branding asks for the full-colour
// mark). Same artwork the button used before (Iconify logos:google-icon).
function GoogleLogo({ size = 24 }) {
  return (
    <Svg width={size} height={size * 262 / 256} viewBox="0 0 256 262">
      <Path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" />
      <Path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" />
      <Path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z" />
      <Path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" />
    </Svg>
  );
}

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
  const { height } = useWindowDimensions();
  
  const containerPaddingTop = useMemo(() => {
    return height * 0.35;
  }, [height]);


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
      
      if (error) {
        console.log('Apple giriş hatası:', error.message);
        throw error;
      }
      
      console.log('Apple girişi başarılı, yönlendirme bekleniyor...');
  
    } catch (error) {
      console.log('Apple giriş catch bloğu:', error);
      
      // 🔥 Sadece kullanıcı gerçekten bir hata yaşarsa Alert göster, 
      // kendi isteğiyle pencereyi kapattıysa sessizce işlemi bitir.
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert(t('login.error', 'Hata'), error.message || 'Giriş yapılamadı.');
      }
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
      source={require('../../assets/images/bg.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <FormScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.container, { paddingTop: containerPaddingTop }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        extraScrollHeight={50}
      >
        <View style={styles.form}>
          {/* Dil seçimi butonu */}
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setLanguageModalVisible(true)}
          >
            <PhosphorIcon icon={ICONS.language} size={20} color="#fff" />
            <Text style={[styles.languageButtonText, { color: '#fff' }]}>
              {i18n.language === 'tr' ? 'Türkçe' : i18n.language === 'en' ? 'English' : i18n.language === 'es' ? 'Spanish' : i18n.language === 'fr' ? 'French' : i18n.language === 'pt' ? 'Portuguese' : i18n.language === 'de' ? 'German' : ''}
            </Text>
          </TouchableOpacity>
          <View style={[styles.inputContainer, emailError && { borderColor: colors.error || '#FF3B30', borderWidth: 2 }]}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: 25, height: 22}}>
              <PhosphorIcon icon={ICONS.email} size={22} color={emailError ? (colors.error || '#FF3B30') : colors.muted} /></View>
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
            <View style={{justifyContent: 'center', alignItems: 'center', width: 25, height: 22}}>
              <PhosphorIcon icon={ICONS.password} size={22} color={colors.muted} /></View>
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
              style={{justifyContent: 'center', alignItems: 'center', width: 28, height: 22}}
              disabled={loading}
            >
              <PhosphorIcon icon={showPassword ? ICONS.visible : ICONS.hidden} size={22} color={colors.muted} />
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
            <Text style={[typography.styles.body, { color: colors.secondary, fontFamily: fonts.semibold, right: 6, marginBottom: -10}]}>{t('login.forgotPassword', 'Şifremi Unuttum')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.buttonColor }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={[styles.buttonText, typography.styles.headline, { color: colors.buttonText }]}>
              {loading ? t('login.loading', 'Giriş yapılıyor...') : t('login.login', 'Giriş Yap')}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, typography.styles.subhead, { color: colors.text }]}>{t('login.or', 'YA DA')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, { backgroundColor: 'rgba(255, 255, 255, 0.95)' }]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <GoogleLogo size={24} />
            <Text style={[styles.googleButtonText, typography.styles.headline, { color: '#000' }]}>
              {t('login.loginWithGoogle', 'Google ile devam et')}
            </Text>
          </TouchableOpacity>

          {/* Apple ile giriş butonu - sadece iOS'ta görünür (Android'de gizli) */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.appleButton, { backgroundColor: 'rgba(255, 255, 255, 0.95)' }]}
              onPress={handleAppleLogin}
              disabled={loading}
            >
              <PhosphorIcon icon={ICONS.apple} size={24} color="#000" />
              <Text style={[styles.appleButtonText, typography.styles.headline, { color: '#000' }]}>
                {t('login.loginWithApple', 'Apple ile Giriş Yap')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }]}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={[styles.linkText, typography.styles.body, { color: colors.secondary }]}>
              {t('login.didUAcc', 'Hesabın yok mu?')} {' '}
              <Text style={typography.styles.headline}>{t('login.register', 'Kayıt ol')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </FormScrollView>

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
    padding: 20,
    // paddingTop dinamik olarak uygulanacak
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
  button: {
    padding: 15,
    borderRadius: 10,
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
    height: 1,
  },
  dividerText: {
    marginHorizontal: 10,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  googleButtonText: {
    marginLeft: 10,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  appleButtonText: {
    marginLeft: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
  },
  forgotButton: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: '#FF992B',
  },
  forgotTextButton: {
    alignSelf: 'flex-end',
    marginBottom: 6,
  },
  languageButton: {
    position: 'absolute',
    right: 0,
    top: -50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  languageButtonText: {
    fontSize: fontSizes.subhead,
    fontFamily: fonts.medium,
  },
}); 