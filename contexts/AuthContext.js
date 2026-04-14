import { createContext, useState, useContext, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/theme';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';

const OAUTH_REDIRECT = 'knowia://auth/callback';

// Context oluştur
const AuthContext = createContext({});

// Provider component
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    console.log('AuthContext useEffect çalıştı');
    
    // 1. MEVCUT OTURUMU KONTROL ET (Senin Kodun)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('Session check sonucu:', { session, error });
      setSession(session);
      setLoading(false);
    }).catch(err => {
      console.error('Session check hatası:', err);
      setLoading(false);
    });

    // 2. OTURUM DEĞİŞİKLİKLERİNİ DİNLE (Senin Kodun)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state change:', _event, session);
      setSession(session);
    });

    // 🔥 3. YENİ EKLENEN: DIŞARIDAN GELEN (GOOGLE) LİNKİ YAKALAYICI
    const handleDeepLink = async (event) => {
      const url = event.url;
      console.log("🔗 Dışarıdan link geldi:", url);

      // Şifre sıfırlama linki App.js tarafından işlenir; burada setSession yapma
      if (url && url.includes('type=recovery')) {
        return;
      }
      
      // Eğer gelen linkin içinde token varsa (Google girişi ise)
      if (url && url.includes('access_token')) {
        const tokenMatch = url.match(/access_token=([^&]+)/);
        const refreshMatch = url.match(/refresh_token=([^&]+)/);

        if (tokenMatch && refreshMatch) {
          const access_token = decodeURIComponent(tokenMatch[1]);
          const refresh_token = decodeURIComponent(refreshMatch[1]);

          console.log("🔑 Tokenlar yakalandı, Supabase'e veriliyor...");

          // Supabase'e manuel giriş emri ver!
          // Bu işlem başarılı olunca, yukarıdaki onAuthStateChange otomatik tetiklenecek!
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            console.error("Giriş Hatası:", error.message);
          } else {
            console.log("✅ Google ile giriş kusursuz tamamlandı!");
          }
        }
      }
    };

    // Uygulama açık veya arkaplandayken gelen linkleri dinle
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

    // Uygulama kapalıyken linkle açıldıysa dinle
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    // TEMİZLİK KISMI
    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  // Login fonksiyonu
  const login = async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

// Register fonksiyonu
const register = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'knowia://auth'
      }
    });

    if (error) {
      console.log("SUPABASE SIGNUP ERROR FULL:", error);
      throw error;
    }

    console.log("SIGNUP DATA:", data);
    return { error: null };
  } catch (error) {
    console.log("CATCH ERROR:", {
      message: error.message,
      status: error.status,
      code: error.code,
      details: error.details,
    });

    return { error };
  }
};
  

  // Logout fonksiyonu
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  // Google ile giriş fonksiyonu
  const signInWithGoogle = async () => {
    try {
      console.log('Supabase Google OAuth başlatılıyor...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: OAUTH_REDIRECT,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
            ios_client_id: '158481249201-f230dgm3cd55ru0qmcujglh9lgeadie8.apps.googleusercontent.com'
          },
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT, {
          toolbarColor: colors.buttonColor,
        });

        if (result.type === 'success' && result.url) {
          // 1. Google'dan gelen URL içindeki gizli şifreleri (token) çekiyoruz
          const tokenMatch = result.url.match(/access_token=([^&]+)/);
          const refreshMatch = result.url.match(/refresh_token=([^&]+)/);

          if (tokenMatch && refreshMatch) {
            const access_token = decodeURIComponent(tokenMatch[1]);
            const refresh_token = decodeURIComponent(refreshMatch[1]);

            // 2. Supabase'e "Al bu şifreleri, kapıyı aç" diyoruz (Manuel Giriş)
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (sessionError) {
              Alert.alert("Giriş Başarısız", sessionError.message);
            } else {
              // GİRİŞ BAŞARILI! 
              // Eğer uygulaman otomatik yönlenmezse buraya bir Alert ekleyebilir veya yönlendirme kodu yazabilirsin.
            }
          } else {
            // Eğer URL'de token yoksa, Google bir hata fırlatmış demektir
            Alert.alert("Bağlantı Hatası", "Google bilgileri göndermedi.");
          }
        }
      }
      return { error: null };
    } catch (error) {
      console.log('Supabase OAuth catch bloğu:', error);
      Alert.alert("Hata", "Beklenmeyen bir hata oluştu.");
      return { error };
    }
  };

  const signInWithApple = async () => {
    try {
      console.log('Native Apple Login başlatılıyor...');
  
      // 1. ADIM: Telefonun kendi FaceID/TouchID ekranını açıyoruz
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
  
      console.log('Apple onayladı, Supabase ile eşleştiriliyor...');
  
      // 2. ADIM: Apple'dan gelen o güvenli bileti (identityToken) Supabase'e veriyoruz
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
  
      if (error) throw error;
  
      console.log('Giriş başarılı!', data);
      return { data, error: null };
  
    } catch (error) {
      // Kullanıcı FaceID ekranını çarpıdan kapatırsa buraya düşer
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('Kullanıcı giriş yapmaktan vazgeçti.');
      } else {
        console.log('Native Apple Login hatası:', error);
      }
      return { error };
    }
  };
  // Şifre sıfırlama email'i gönderme fonksiyonu
  const resetPasswordForEmail = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'knowia://auth',
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  // Yeni şifre belirleme fonksiyonu
  const updatePassword = async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const value = {
    session,
    loading,
    login,
    register,
    logout,
    signInWithGoogle,
    signInWithApple,
    resetPasswordForEmail,
    updatePassword,
    isRecoveryMode,
    setIsRecoveryMode,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook
export function useAuth() {
  return useContext(AuthContext);
} 