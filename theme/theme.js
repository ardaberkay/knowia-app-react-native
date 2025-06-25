import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from './colors';
import { typography } from './typography';
import { getThemePreference, updateThemePreference } from '../services/ProfileService';
import { supabase } from '../lib/supabase';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const deviceTheme = useColorScheme();
  const [themePreference, setThemePreference] = useState('system');
  const [isDarkMode, setIsDarkMode] = useState(deviceTheme === 'dark');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // İlk yüklemede ve auth değişiminde theme_preference'ı oku
    const fetchTheme = async () => {
      try {
        const pref = await getThemePreference();
        setThemePreference(pref || 'system');
        if ((pref || 'system') === 'system') {
          setIsDarkMode(deviceTheme === 'dark');
        } else {
          setIsDarkMode(pref === 'dark');
        }
      } catch (e) {
        setThemePreference('system');
        setIsDarkMode(deviceTheme === 'dark');
      } finally {
        setLoading(false);
      }
    };
    fetchTheme();

    // Auth değişimini dinle
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      fetchTheme();
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [deviceTheme]);

  useEffect(() => {
    // themePreference veya cihaz teması değişirse güncelle
    if (themePreference === 'system') {
      setIsDarkMode(deviceTheme === 'dark');
    }
  }, [deviceTheme, themePreference]);

  const toggleTheme = async () => {
    let newPref;
    if (themePreference === 'system') {
      newPref = 'dark';
    } else if (themePreference === 'dark') {
      newPref = 'light';
    } else {
      newPref = 'dark';
    }
    setThemePreference(newPref);
    setIsDarkMode(newPref === 'dark');
    await updateThemePreference(newPref);
  };

  const theme = {
    colors: isDarkMode ? darkColors : lightColors,
    typography,
    isDarkMode,
    themePreference,
    toggleTheme,
    loading,
  };

  if (loading) return null; // Tema yüklenene kadar render etme

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for using theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
