import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ImageBackground } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, signInWithGoogle } = useAuth();
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();


  const handleLogin = async () => {
    if (loading) return;

    try {
      setLoading(true);
      const { error } = await login(email, password);
      if (error) throw error;
    } catch (error) {
      Alert.alert(t('login.error', 'Hata'), error.message);
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

  const handleLanguageChange = async (lng) => {
    await i18n.changeLanguage(lng);
    setLanguageModalVisible(false);
  };

  return (
    <ImageBackground
      source={require('../assets/bg.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <View style={styles.form}>
          {/* Dil seçimi butonu */}
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setLanguageModalVisible(true)}
          >
            <Ionicons name="language" size={20} color="#fff" />
            <Text style={[styles.languageButtonText, { color: '#fff' }]}>
              {i18n.language === 'tr' ? 'Türkçe' : i18n.language === 'en' ? 'English' : i18n.language === 'es' ? 'Spanish' : i18n.language === 'fr' ? 'French' : i18n.language === 'pt' ? 'Portuguese' : i18n.language === 'ar' ? 'Arabic' : ''}
            </Text>
          </TouchableOpacity>
          <View style={styles.inputContainer}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: 25, height: 22}}>
              <Ionicons name="mail-outline" size={22} color={colors.muted} /></View>
            <TextInput
              style={[styles.input, typography.styles.body]}
              placeholder={t('login.emailPlaceholder', 'E-posta')}
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.inputContainer}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: 25, height: 22}}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.muted} /></View>
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
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotTextButton}
            onPress={() => Alert.alert(t('login.forgotPassword', 'Şifremi Unuttum'), t('login.forgotPasswordMessage', 'Şifre sıfırlama işlemi başlatılacak.'))}
            disabled={loading}
          >
            <Text style={[typography.styles.link, { color: colors.secondary, fontWeight: 'semibold', right: 6, marginBottom: -10}]}>{t('login.forgotPassword', 'Şifremi Unuttum')}</Text>
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
            <Text style={[styles.dividerText, typography.styles.caption, { color: colors.muted }]}>{t('login.or', 'YA DA')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, { backgroundColor: colors.cardBackground }]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={24} color="#DB4437" />
            <Text style={[styles.googleButtonText, typography.styles.button, { color: colors.text }]}>
              {t('login.loginWithGoogle', 'Google ile devam et')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={[styles.linkText, typography.styles.link, { color: colors.secondary }]}>
              {t('login.didUAcc', 'Hesabın yok mu?')} {' '}
              <Text style={typography.styles.linkBold}>{t('login.register', 'Kayıt ol')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
  container: {
    flex: 1,
    padding: 20,
    paddingTop: '95%',
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
    marginTop: 15,
    alignItems: 'center',
  },
  linkText: {
    // fontSize ve fontFamily artık typography'den geliyor
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
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
    fontSize: 14,
    fontWeight: '500',
  },
}); 