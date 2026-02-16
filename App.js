import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ThemeProvider } from './theme/theme';
import { SnackbarProvider } from './components/ui/Snackbar';
import AppNavigator from './navigation/AppNavigator';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_300Light } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from './theme/theme';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import './lib/i18n';

// Splash screen'i otomatik gizlemeyi engelle
SplashScreen.preventAutoHideAsync();

// Navigation reference oluştur
export const navigationRef = createNavigationContainerRef();
 
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

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    const handleUrl = async ({ url }) => {
      console.log('DEEPLINK URL:', url)
  
      const parsed = Linking.parse(url)
      console.log('PARSED URL:', JSON.stringify(parsed, null, 2))
      
      // Auth callback'leri için path kontrolü (knowia://auth)
      const isAuthCallback = parsed.path === 'auth' || parsed.hostname === 'auth' || url.includes('/auth')
      
      // Fragment veya query params'dan parametreleri al
      let params = {}
      
      // Önce fragment'i kontrol et (Supabase genellikle fragment kullanır)
      if (parsed.fragment) {
        console.log('FRAGMENT:', parsed.fragment)
        try {
          params = Object.fromEntries(
            parsed.fragment.split('&').map(p => {
              const [key, value] = p.split('=')
              return [key, decodeURIComponent(value || '')]
            })
          )
        } catch (e) {
          console.log('Fragment parse error:', e)
        }
      }
      
      // Query params'ı da kontrol et (bazı durumlarda query params kullanılabilir)
      if (parsed.queryParams && Object.keys(parsed.queryParams).length > 0) {
        console.log('QUERY PARAMS:', parsed.queryParams)
        params = { ...params, ...parsed.queryParams }
      }
      
      // Eğer hala token bulunamadıysa, URL'den direkt parse etmeyi dene
      if (!params.access_token && url.includes('access_token')) {
        console.log('Token URL içinde bulundu, manuel parse deneniyor...')
        const tokenMatch = url.match(/access_token=([^&]+)/)
        const refreshMatch = url.match(/refresh_token=([^&]+)/)
        const typeMatch = url.match(/type=([^&]+)/)
        
        if (tokenMatch) params.access_token = decodeURIComponent(tokenMatch[1])
        if (refreshMatch) params.refresh_token = decodeURIComponent(refreshMatch[1])
        if (typeMatch) params.type = decodeURIComponent(typeMatch[1])
      }
      
      console.log('EXTRACTED PARAMS:', params)
  
      // Auth callback'i ise (knowia://auth ile gelen) veya access_token varsa işle
      if (isAuthCallback || (params.access_token && params.refresh_token)) {
        if (params.access_token && params.refresh_token) {
          // Link type kontrolü - URL'de recovery kelimesi var mı da kontrol et
          const linkType = params.type || 'default'
          const isRecovery = linkType === 'recovery' || url.includes('type=recovery') || url.includes('recovery')
          
          console.log('Link type:', linkType)
          console.log('Is recovery:', isRecovery)
          
          // Recovery (şifre sıfırlama) için: LOGIN YAPMA, token'ları kaydet ve ResetPassword'a yönlendir
          if (isRecovery) {
            console.log('Recovery linki tespit edildi, token\'lar kaydediliyor...')
            
            // Token'ları AsyncStorage'a kaydet (ResetPassword ekranında kullanılacak)
            await AsyncStorage.setItem('recovery_access_token', params.access_token)
            await AsyncStorage.setItem('recovery_refresh_token', params.refresh_token)
            
            console.log('Token\'lar kaydedildi, ResetPassword ekranına yönlendiriliyor...')
            
            // Navigation hazır olana kadar bekle
            const waitForNav = () => new Promise((resolve) => {
              if (navigationRef.isReady()) {
                resolve()
              } else {
                const interval = setInterval(() => {
                  if (navigationRef.isReady()) {
                    clearInterval(interval)
                    resolve()
                  }
                }, 100)
              }
            })
            
            await waitForNav()
            
            // ResetPassword ekranına yönlendir (session yok, login olmadan)
            if (navigationRef.isReady()) {
              navigationRef.navigate('ResetPassword')
            }
            
            return // Recovery için burada bitir, session set etme
          }
          
          // Diğer durumlar için (email confirmation, magic link vb.) session set et
          console.log('Setting session with tokens...')
          
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          })
    
          if (sessionError) {
            console.log('SESSION ERROR:', sessionError)
            console.log('SESSION ERROR DETAILS:', JSON.stringify(sessionError, null, 2))
            return
          }
          
          console.log('Session set successfully')
          console.log('Session data:', sessionData?.session ? 'Session var' : 'Session yok')
          console.log('User:', sessionData?.user ? sessionData.user.email : 'User yok')
          
          // Email confirmation için user'ın email_confirmed durumunu kontrol et
          if (sessionData?.user) {
            console.log('User email confirmed:', sessionData.user.email_confirmed_at ? 'Evet' : 'Hayır')
            console.log('User confirmed at:', sessionData.user.email_confirmed_at)
            
            // Eğer email confirmation linki ise (type=signup genellikle email confirmation için kullanılır)
            if (params.type === 'signup') {
              console.log('Email confirmation linki tespit edildi (type=signup)')
              const { data: userData } = await supabase.auth.getUser()
              if (userData?.user?.email_confirmed_at) {
                console.log('Email başarıyla confirm edildi')
              }
            }
          }
          
          // Email confirmation veya diğer durumlar için ana ekrana yönlendir
          setTimeout(() => {
            if (navigationRef.isReady()) {
              navigationRef.navigate('MainTabs', { screen: 'Home' })
            }
          }, 500)
        } else {
          console.log('Auth callback tespit edildi ancak access_token veya refresh_token bulunamadı')
          console.log('Mevcut params:', Object.keys(params))
        }
      } else {
        console.log('Auth callback değil veya token yok')
      }
    }
  
    const sub = Linking.addEventListener('url', handleUrl)
  
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('Initial URL:', url)
        handleUrl({ url })
      }
    }).catch(err => {
      console.log('Initial URL error:', err)
    })
  
    return () => sub.remove()
  }, [])

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

  // Deep link konfigürasyonu
  const linking = {
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
        Discover: 'discover',
        SwipeDeck: 'swipe/:deckId',
        Login: 'login',
        Register: 'register',
      },
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AuthProvider>
        <ProfileProvider>
          <SnackbarProvider>
            <NavigationContainer ref={navigationRef} theme={navigationTheme} linking={linking}>
              <AppNavigator />
              <StatusBar style={isDarkMode ? "light" : "dark"} />
            </NavigationContainer>
          </SnackbarProvider>
        </ProfileProvider>
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
