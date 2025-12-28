import { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Context oluştur
const AuthContext = createContext({});

// Provider component
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthContext useEffect çalıştı');
    
    // Mevcut oturumu kontrol et
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('Session check sonucu:', { session, error });
      setSession(session);
      setLoading(false);
    }).catch(err => {
      console.error('Session check hatası:', err);
      setLoading(false);
    });

    // Oturum değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state change:', _event, session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
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
          redirectTo: 'knowia://auth/callback'
        }
      });
      console.log('Supabase OAuth yanıtı:', data ? 'Data var' : 'Data yok', error ? 'Hata var' : 'Hata yok');
      if (error) {
        console.log('Supabase OAuth hatası:', error.message);
        throw error;
      }
      return { error: null };
    } catch (error) {
      console.log('Supabase OAuth catch bloğu:', error);
      return { error };
    }
  };

  // Apple ile giriş fonksiyonu
  const signInWithApple = async () => {
    try {
      console.log('Supabase Apple OAuth başlatılıyor...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'knowia://auth/callback'
        }
      });
      console.log('Supabase Apple OAuth yanıtı:', data ? 'Data var' : 'Data yok', error ? 'Hata var' : 'Hata yok');
      if (error) {
        console.log('Supabase Apple OAuth hatası:', error.message);
        throw error;
      }
      return { error: null };
    } catch (error) {
      console.log('Supabase Apple OAuth catch bloğu:', error);
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