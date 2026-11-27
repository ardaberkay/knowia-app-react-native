import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/theme';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Alert, AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { updateLastActiveAt } from '../services/ProfileService';
import i18n from '../lib/i18n';

const OAUTH_REDIRECT = 'knowia://auth/callback';
const RESET_REDIRECT = 'knowia://auth/reset';

// knowia://auth/(callback|reset)?code=…  →  { kind, code } | null
function parseAuthLink(url) {
  const m = /^knowia:\/\/auth\/(callback|reset)\/?\?([^#]*)/.exec(url || '');
  if (!m) return null;
  const code = new URLSearchParams(m[2]).get('code');
  return code ? { kind: m[1], code } : null;
}

// Context oluştur
const AuthContext = createContext({});

// Provider component
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const { colors } = useTheme();
  const currentUserIdRef = useRef(null);
  const oauthInProgressRef = useRef(false);

  const touchLastActive = useCallback(async (userId) => {
    if (!userId) return;
    try {
      await updateLastActiveAt(userId);
    } catch (err) {
      console.error('last_active_at update failed:', err?.message || err);
    }
  }, []);

  useEffect(() => {
    console.log('AuthContext useEffect çalıştı');
    
    // 1. MEVCUT OTURUMU KONTROL ET (Senin Kodun)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('Session check sonucu:', session ? 'oturum var' : 'oturum yok', error?.message ?? '');
      setSession(session);
      const currentUserId = session?.user?.id || null;
      currentUserIdRef.current = currentUserId;
      if (currentUserId) {
        touchLastActive(currentUserId);
      }
      setLoading(false);
    }).catch(err => {
      console.error('Session check hatası:', err);
      setLoading(false);
    });

    // 2. OTURUM DEĞİŞİKLİKLERİNİ DİNLE (Senin Kodun)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state change:', _event, session ? 'oturum var' : 'oturum yok');
      setSession(session);
      const currentUserId = session?.user?.id || null;
      currentUserIdRef.current = currentUserId;
      if ((_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') && currentUserId) {
        touchLastActive(currentUserId);
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && currentUserIdRef.current) {
        touchLastActive(currentUserIdRef.current);
      }
    });

    // 3. Auth links (PKCE). Only knowia://auth/callback?code=… (sign-up
    // confirmation, OAuth) and knowia://auth/reset?code=… (password reset) are
    // accepted. Links carrying access/refresh tokens are ignored: a code can only
    // be exchanged with the verifier this device stored, so a forged link can't
    // log anyone in.
    const handleDeepLink = async ({ url }) => {
      const link = parseAuthLink(url);
      if (!link) return;
      if (link.kind === 'callback' && oauthInProgressRef.current) return; // signInWithGoogle exchanges it
      const isRecovery = link.kind === 'reset';
      if (isRecovery) setIsRecoveryMode(true);
      const { error } = await supabase.auth.exchangeCodeForSession(link.code);
      if (error) {
        if (__DEV__) console.warn('Auth link exchange failed:', error.message);
        if (isRecovery) {
          setIsRecoveryMode(false);
          Alert.alert(
            i18n.t('resetPassword.error', 'Hata'),
            i18n.t('resetPassword.tokenNotFound', 'Şifre sıfırlama linki geçersiz veya süresi dolmuş. Lütfen yeni bir link talep edin.'),
          );
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
      appStateSubscription.remove();
    };
  }, [touchLastActive]);

  // Login fonksiyonu
  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data?.user?.id) {
        await touchLastActive(data.user.id);
      }
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
        emailRedirectTo: OAUTH_REDIRECT
      }
    });

    if (error) {
      console.log("SUPABASE SIGNUP ERROR FULL:", error);
      throw error;
    }

    console.log("SIGNUP:", data?.user ? "kullanıcı oluşturuldu" : "kullanıcı yok");
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
    oauthInProgressRef.current = true;
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
          const link = parseAuthLink(result.url);
          if (!link) {
            Alert.alert("Bağlantı Hatası", "Google bilgileri göndermedi.");
          } else {
            const { error: sessionError } = await supabase.auth.exchangeCodeForSession(link.code);
            if (sessionError) Alert.alert("Giriş Başarısız", sessionError.message);
          }
        }
      }
      return { error: null };
    } catch (error) {
      console.log('Supabase OAuth catch bloğu:', error);
      Alert.alert("Hata", "Beklenmeyen bir hata oluştu.");
      return { error };
    } finally {
      oauthInProgressRef.current = false;
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
  
      console.log('Giriş başarılı!');
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
        redirectTo: RESET_REDIRECT,
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