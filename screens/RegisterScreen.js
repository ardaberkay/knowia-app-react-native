import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ImageBackground } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Iconify } from 'react-native-iconify';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        <View style={styles.form}>
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: 25, height: 22}}>
              <Iconify icon="tabler:mail-filled" size={22} color={colors.muted} />
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, { color: colors.text }]}
              placeholder={t('register.emailPlaceholder', 'Email')}
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: 25, height: 22}}>
              <Iconify icon="carbon:password" size={22} color={colors.muted} />
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, { color: colors.text }]}
              placeholder={t('register.passwordPlaceholder', 'Şifre')}
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
              <Iconify icon={showPassword ? 'oi:eye' : 'system-uicons:eye-no'} size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <View style={{justifyContent: 'center', alignItems: 'center', width: 25, height: 22}}>
              <Iconify icon="carbon:password" size={22} color={colors.muted} />
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, { color: colors.text }]}
              placeholder={t('register.confirmPasswordPlaceholder', 'Şifre Tekrar')}
              placeholderTextColor={colors.muted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(prev => !prev)}
              style={{justifyContent: 'center', alignItems: 'center', width: 28, height: 22}}
              disabled={loading}
            >
              <Iconify icon={showConfirmPassword ? 'oi:eye' : 'system-uicons:eye-no'} size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#FF992B', borderWidth: 1, borderColor: colors.border}, loading && styles.buttonDisabled]}
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
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
}); 