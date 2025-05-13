import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from './colors';
import { typography } from './typography';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const deviceTheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(deviceTheme === 'dark');

  // Cihaz teması değiştiğinde otomatik güncelleme
  useEffect(() => {
    setIsDarkMode(deviceTheme === 'dark');
  }, [deviceTheme]);

  const theme = {
    colors: isDarkMode ? darkColors : lightColors,
    typography,
    isDarkMode,
    toggleTheme: () => setIsDarkMode(!isDarkMode),
  };

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
