import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ImageBackground } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signInWithGoogle } = useAuth();
  const { colors } = useTheme();

  const handleLogin = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      const { error } = await login(email, password);
      if (error) throw error;
    } catch (error) {
      Alert.alert('Hata', error.message);
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
      Alert.alert('Hata', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground 
      source={require('../assets/bg.png')} 
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={[styles.title, typography.styles.h1, { color: '#fff' }]}>Knowia</Text>
        <Text style={[styles.subtitle, typography.styles.subtitle, { color: '#fff' }]}>Giriş Yap</Text>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, typography.styles.body]}
            placeholder="E-posta"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={[styles.input, typography.styles.body]}
            placeholder="Şifre"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.buttonColor }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={[styles.buttonText, typography.styles.button, { color: colors.buttonText }]}>
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, typography.styles.caption, { color: colors.muted }]}>veya</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity 
            style={[styles.googleButton, { backgroundColor: colors.cardBackground }]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={24} color="#DB4437" />
            <Text style={[styles.googleButtonText, typography.styles.button, { color: colors.text }]}>
              Google ile devam et
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={[styles.linkText, typography.styles.link, { color: colors.secondary }]}>
              Hesabın yok mu?{' '}
              <Text style={typography.styles.linkBold}>Kayıt ol</Text>
            </Text>
          </TouchableOpacity>
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
    padding: 20,
    paddingBottom: '15%',
    justifyContent: 'flex-end',
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
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
}); 