import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ImageBackground } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { useTranslation } from 'react-i18next';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const handleRegister = async () => {
    if (loading) return;
    if (password !== confirmPassword) {
      Alert.alert(t('register.error', 'Hata'), t('register.passwordMatchError', 'Şifreler eşleşmiyor'));
      return;
    }

    try {
      setLoading(true);
      const { error } = await register(email, password);
      if (error) throw error;
      
      Alert.alert(
        t('register.success', 'Başarılı'),
        t('register.successMessage', 'Kayıt işlemi tamamlandı. Lütfen e-posta adresinizi doğrulayın.'),
        [{ text: t('register.ok', 'Tamam'), onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Hata', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../assets/bgtwo.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={[styles.subtitle, typography.styles.subtitle, { color: '#fff' }]}>{t('register.register', 'Kayıt Ol')}</Text>
        <View style={styles.form}>
          <TextInput
            style={[styles.input, typography.styles.body, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('register.emailPlaceholder', 'E-posta')}
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={[styles.input, typography.styles.body, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('register.passwordPlaceholder', 'Şifre')}
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={[styles.input, typography.styles.body, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('register.confirmPasswordPlaceholder', 'Şifre Tekrar')}
            placeholderTextColor={colors.muted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#FF992B'}, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={[styles.buttonText, typography.styles.button, { color: colors.buttonText }]}>
              {loading ? t('register.registering', 'Kayıt yapılıyor...') : t('register.register', 'Kayıt Ol')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.linkText, typography.styles.link, { color: colors.secondary }]}>
              {t('register.didUAcc', 'Zaten hesabınız var mı?')} {' '}
              <Text style={typography.styles.linkBold}>{t('register.login', 'Giriş yapın')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    paddingTop: '65%',
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 30,
  },
  form: {
    gap: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
}); 