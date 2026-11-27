// 🔥 1. ADIM: Native Splash'i kilitliyoruz.
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync().catch(() => {});

import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ThemeProvider, useTheme } from './theme/theme';
import { SnackbarProvider } from './components/ui/Snackbar';
import AppNavigator from './navigation/AppNavigator';
import { useEffect, useCallback } from 'react';
import { useFonts } from 'expo-font';
import { View, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import './lib/i18n';
import { cleanupStaleCache } from './services/CacheService';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persistOptions } from './lib/queryClient';

// Splash ayarlarını sabitliyoruz (fade efekti ile yumuşak geçiş)
SplashScreen.setOptions({
  fade: true,
  duration: 250,
});

// Since SDK 58 a push received while the app is open is shown by default.
// The only push we send is the "come back and study" nudge, which is pointless
// while the user is already in the app, so keep foreground pushes silent.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// The OS font-size cap lives in components/ui/AppText (Text.defaultProps is
// ignored for function components under React 19).

export const navigationRef = createNavigationContainerRef();

function MainAppRunner({ colors, isDarkMode, linking, navigationTheme }) {
  const { loading: isAuthLoading } = useAuth();
  // TEMPORARY: Phosphor-Bold is embedded from the next native build on (expo-font
  // plugin, app.config.js). Until every installed build has it, load it at
  // runtime too so bold icons don't render empty. Remove after that build.
  const [boldIconsLoaded] = useFonts({ 'Phosphor-Bold': require('./assets/fonts/Phosphor-Bold.ttf') });
  
  const isReady = !isAuthLoading && boldIconsLoaded;

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

  // Inter and Phosphor are embedded at build time (expo-font plugin in
  // app.config.js, files in assets/), so there is nothing to load at runtime.

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    cleanupStaleCache();
  }, []);

  // Auth deep links (PKCE code exchange, password reset) are handled in
  // contexts/AuthContext.js; links carrying raw tokens are no longer accepted.

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
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <SafeAreaProvider initialWindowMetrics={initialWindowMetrics}>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </SafeAreaProvider>
      </PersistQueryClientProvider>
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