// 🔥 1. ADIM: Native Splash'i kilitliyoruz.
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync().catch(() => {});

import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ThemeProvider, useTheme } from './theme/theme';
import { SnackbarProvider } from './components/ui/Snackbar';
import AppNavigator from './navigation/AppNavigator';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_300Light } from '@expo-google-fonts/inter';
import { useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, Text, TextInput } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './lib/supabase';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import './lib/i18n';
import { cleanupStaleCache } from './services/CacheService';
import * as NavigationBar from 'expo-navigation-bar';

// Splash ayarlarını sabitliyoruz (fade efekti ile yumuşak geçiş)
SplashScreen.setOptions({
  fade: true,
  duration: 250,
});

if (Platform.OS === 'android') {
  NavigationBar.setBackgroundColorAsync("transparent");
  NavigationBar.setPositionAsync("absolute"); 
}

// Tüm Text bileşenleri için maksimum büyüme oranını sınırla
if (Text.defaultProps == null) {
  Text.defaultProps = {};
}
Text.defaultProps.maxFontSizeMultiplier = 1.1; 
// veya tamamen kapatmak için: Text.defaultProps.allowFontScaling = false;

// Input alanları için de aynı sorunu yaşamamak adına
if (TextInput.defaultProps == null) {
  TextInput.defaultProps = {};
}
TextInput.defaultProps.maxFontSizeMultiplier = 1.1;
// veya TextInput.defaultProps.allowFontScaling = false;

export const navigationRef = createNavigationContainerRef();

function MainAppRunner({ fontsLoaded, colors, isDarkMode, linking, navigationTheme }) {
  const { loading: isAuthLoading } = useAuth();
  
  // Fontlar ve Auth hazır mı kontrolü
  const isReady = fontsLoaded && !isAuthLoading;

  // 🔥 2. ADIM: Asıl sihir burada. 
  // Uygulama navigasyonu hazır olduğunda tetiklenir.
  const onNavReady = useCallback(() => {
    if (isReady) {

      setTimeout(async () => {
        await SplashScreen.hideAsync();
      }, 150); 
    }
  }, [isReady]);

  if (!isReady) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        linking={linking}
        onReady={onNavReady} 
      >
        <AppNavigator />
        <StatusBar style={isDarkMode ? "light" : "dark"} />
      </NavigationContainer>
    </View>
  );
}

function AppContent() {
  const { colors, isDarkMode } = useTheme();

  const [fontsLoaded] = useFonts({
    'Inter': Inter_400Regular,
    'Inter-Light': Inter_300Light,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    cleanupStaleCache();
  }, []);

  useEffect(() => {
    const handleUrl = async ({ url }) => {
      // ... (Senin Linking/Supabase mantığın aynı kalıyor, dokunmadım)
      const parsed = Linking.parse(url);
      let params = {};
      if (parsed.fragment) {
        try {
          params = Object.fromEntries(
            parsed.fragment.split('&').map(p => {
              const [key, value] = p.split('=');
              return [key, decodeURIComponent(value || '')];
            })
          );
        } catch {}
      }
      if (parsed.queryParams) {
        params = { ...params, ...parsed.queryParams };
      }
      if (!params.access_token && url.includes('access_token')) {
        const tokenMatch = url.match(/access_token=([^&]+)/);
        const refreshMatch = url.match(/refresh_token=([^&]+)/);
        if (tokenMatch) params.access_token = decodeURIComponent(tokenMatch[1]);
        if (refreshMatch) params.refresh_token = decodeURIComponent(refreshMatch[1]);
      }
      if (params.access_token && params.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (!error && data?.user) {
          setTimeout(() => {
            if (navigationRef.isReady()) {
              navigationRef.navigate('MainTabs', { screen: 'Home' });
            }
          }, 300);
        }
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });
    return () => sub.remove();
  }, []);

  // Theme renklerini zorla değiştirmedik, kendi temanın renklerini paslıyoruz.
  const navigationTheme = {
    ...(isDarkMode ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDarkMode ? DarkTheme.colors : DefaultTheme.colors),
      ...colors,
    },
  };

  const linking = {
    // ... (Linking ayarların aynı)
    prefixes: ['knowia://', Linking.createURL('/')],
    config: {
      screens: {
        MainTabs: {
          screens: {
            Home: 'home',
            Create: 'create',
            Library: 'library',
            Profile: 'profile',
          },
        },
        DeckDetail: 'deck/:id',
        SwipeDeck: 'swipe/:deckId',
        Login: 'login',
        Register: 'register',
      },
    },
  };

  return (
    <View style={styles.appContainer}>
      <AuthProvider>
        <ProfileProvider>
          <SnackbarProvider>
            <MainAppRunner
              fontsLoaded={fontsLoaded}
              colors={colors}
              isDarkMode={isDarkMode}
              linking={linking}
              navigationTheme={navigationTheme}
            />
          </SnackbarProvider>
        </ProfileProvider>
      </AuthProvider>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider initialWindowMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <PaperProvider>
            <BottomSheetModalProvider>
              <AppContent />
            </BottomSheetModalProvider>
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
  appContainer: {
    flex: 1,
  },
});