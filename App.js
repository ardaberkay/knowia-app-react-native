import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './theme/theme';
import AppNavigator from './navigation/AppNavigator';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_300Light } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useTheme } from './theme/theme';

// Splash screen'i otomatik gizlemeyi engelle
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { colors, isDarkMode } = useTheme();
  const [fontsLoaded] = useFonts({
    'Inter': Inter_400Regular,
    'Inter-Light': Inter_300Light,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
          <StatusBar style={isDarkMode ? "light" : "dark"} />
      </NavigationContainer>
    </AuthProvider>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
