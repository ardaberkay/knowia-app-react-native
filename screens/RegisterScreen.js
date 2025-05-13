import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { colors } = useTheme();

  const handleRegister = async () => {
    if (loading) return;
    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor');
      return;
    }

    try {
      setLoading(true);
      const { error } = await register(email, password);
      if (error) throw error;
      
      Alert.alert(
        'Başarılı',
        'Kayıt işlemi tamamlandı. Lütfen e-posta adresinizi doğrulayın.',
        [{ text: 'Tamam', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Hata', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, typography.styles.h1, { color: colors.text }]}>Knowia</Text>
      <Text style={[styles.subtitle, typography.styles.subtitle, { color: colors.subtext }]}>Kayıt Ol</Text>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, typography.styles.body, { borderColor: colors.border, color: colors.text }]}
          placeholder="E-posta"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, typography.styles.body, { borderColor: colors.border, color: colors.text }]}
          placeholder="Şifre"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={[styles.input, typography.styles.body, { borderColor: colors.border, color: colors.text }]}
          placeholder="Şifre Tekrar"
          placeholderTextColor={colors.muted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.buttonColor }, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={[styles.buttonText, typography.styles.button, { color: colors.buttonText }]}>
            {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.linkButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={[styles.linkText, typography.styles.link, { color: colors.secondary }]}>
            Zaten hesabınız var mı?{' '}
            <Text style={typography.styles.linkBold}>Giriş yapın</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
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
    padding: 15,
    borderRadius: 10,
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
}); 