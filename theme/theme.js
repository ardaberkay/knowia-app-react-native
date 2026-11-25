import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from './colors';
import { typography } from './typography';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Varsayılan her zaman dark
  const [themePreference, setThemePreference] = useState('dark'); // 'dark' | 'light'
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);

  // Dark mode only for now: the light palette needs a redesign, so the
  // setting is hidden and a saved 'light' preference is ignored. To bring
  // light mode back, read 'theme_preference' here again and restore the
  // switch in SettingsScreen.
  const LIGHT_MODE_ENABLED = false;

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const localPref = LIGHT_MODE_ENABLED ? await AsyncStorage.getItem('theme_preference') : null;
        const pref = localPref === 'light' ? 'light' : 'dark'; // default dark
        setThemePreference(pref);
        setIsDarkMode(pref === 'dark');
      } catch (e) {
        // Hata olursa da dark kalsın
        setThemePreference('dark');
        setIsDarkMode(true);
      } finally {
        setLoading(false);
      }
    };
    fetchTheme();
  }, []);

  const toggleTheme = async () => {
    const newPref = themePreference === 'dark' ? 'light' : 'dark';
    setThemePreference(newPref);
    setIsDarkMode(newPref === 'dark');

    // Sadece lokal storage'a yaz
    try {
      await AsyncStorage.setItem('theme_preference', newPref);
    } catch {
      // Yazılamazsa da uygulama çalışmaya devam etsin
    }
  };

  const theme = {
    colors: isDarkMode ? darkColors : lightColors,
    typography,
    isDarkMode,
    themePreference,
    toggleTheme,
    loading,
  };

  // Tema yüklenene kadar (sadece ilk açılışta) UI'ı beklet
  if (loading) return null;

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
