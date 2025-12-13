import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './theme/theme';
import { SnackbarProvider } from './components/ui/Snackbar';
import AppNavigator from './navigation/AppNavigator';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_300Light } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from './theme/theme';
import AddCardScreen from './screens/cards/CreateCardScreen';
import './lib/i18n';

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

  // Navigation için kendi temamızı oluştur
  const navigationTheme = {
    ...(isDarkMode ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDarkMode ? DarkTheme.colors : DefaultTheme.colors),
      ...colors,
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AuthProvider>
        <SnackbarProvider>
          <NavigationContainer theme={navigationTheme}>
            <AppNavigator />
            <StatusBar style={isDarkMode ? "light" : "dark"} />
          </NavigationContainer>
        </SnackbarProvider>
      </AuthProvider>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PaperProvider>
            <AppContent />
          </PaperProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
});
