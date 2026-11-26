import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { OnboardingFinishContext } from '../contexts/OnboardingFinishContext';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import HomeScreen from '../screens/home/HomeScreen';
import CreateScreen from '../screens/create/CreateDeckScreen';
import LibraryScreen from '../screens/library/LibraryScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import DeckDetailScreen from '../screens/decks/DeckDetailScreen';
import DiscoverScreen from '../screens/home/DiscoverScreen';
import CategoryDeckListScreen from '../screens/home/CategoryDeckListScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { useTheme } from '../theme/theme';
import SwipeDeckScreen from '../screens/cards/SwipeDeckScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import BlockedScreen from '../screens/profile/BlockedScreen';
import AccountScreen from '../screens/profile/AccountScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import InfoScreen from '../screens/profile/InfoScreen';
import DeckEditScreen from '../screens/decks/EditDeckScreen';
import CustomTabBar from '../components/ui/CustomTabBar';
import AddCardScreen from '../screens/cards/CreateCardScreen';
import DeckCardsScreen from '../screens/cards/CardsOfDeckScreen';
import { EditCardScreen } from '../components/layout/EditCardForm';
import ChaptersScreen from '../screens/decks/ChaptersScreen';
import ChapterCardsScreen from '../screens/decks/CardsOfChapter.js';
import FavoriteDecks from '../screens/library/FavoriteDecks';
import FavoriteCards from '../screens/library/FavoriteCards';
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Text } from '../components/ui/AppText';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerHaptic } from '../lib/hapticManager';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { fontSizes, fonts } from '../theme/typography';

const Stack = createNativeStackNavigator();

// iOS: a see-through header that the list scrolls under, with the system
// scroll edge effect (iOS 26 soft blur) once content is beneath it. The
// screen's list must use contentInsetAdjustmentBehavior="automatic" so it
// starts below the header. Android keeps the opaque header.
const SCROLL_EDGE_HEADER = Platform.OS === 'ios'
  ? {
    headerTransparent: true,
    headerStyle: { backgroundColor: 'transparent' },
    scrollEdgeEffects: { top: 'automatic' },
  }
  : {};
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      tabBar={(props) => {
        const route = props.state.routes[props.state.index];
        const routeName = getFocusedRouteNameFromRoute(route) ?? route.name;

        const hideOnScreens = ['Discover', 'CategoryDeckList', 'SwipeDeck'];

        if (hideOnScreens.includes(routeName)) {
          return null;
        }

        return <CustomTabBar {...props} />;
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.buttonColor,
        tabBarInactiveTintColor: colors.subtext,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          display: 'none',
        },
        headerStyle: {
          backgroundColor: colors.tabBarBackground,
        },
        tabBarLabelStyle: {
          fontSize: fontSizes.caption,
          marginBottom: 10,
          fontFamily: fonts.regular,
          textAlign: 'center',
          marginTop: -8,
        },
        tabBarIconStyle: {
          marginTop: 4,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let homeIcon;
          if (route.name === 'Home') {
            homeIcon = focused ? 'solar:home-smile-bold' : 'solar:home-angle-broken';
          } else if (route.name === 'DiscoverTab') {
            homeIcon = focused ? 'solar:compass-bold' : 'solar:compass-broken';
          } else if (route.name === 'Library') {
            homeIcon = focused ? 'solar:library-bold-duotone' : 'solar:library-line-duotone';
          } else if (route.name === 'Profile') {
            homeIcon = focused ? 'solar:user-bold' : 'solar:user-broken';
          }

          return (
            <Iconify
              icon={homeIcon}
              size={28}
              color={color}
              style={{
                opacity: focused ? 1 : 0.7,
                alignSelf: 'center',
                marginBottom: 0,
              }}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tabs.home', 'Anasayfa'), tabBarLabel: t('tabs.home', 'Anasayfa') }} />
      <Tab.Screen name="DiscoverTab" component={DiscoverScreen} options={{ tabBarLabel: t('tabs.discover', 'Keşfet'), title: '', headerShown: false }} />
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          title: t('tabs.myLibrary', 'Kitaplığım'),
          tabBarLabel: t('tabs.library', 'Kitaplığım'),
          headerShown: false,
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tabs.profile', 'Profilim'), tabBarLabel: t('tabs.profile', 'Profilim'), headerShown: false }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { colors } = useTheme();
  const { session, loading, isRecoveryMode } = useAuth();
  const { t } = useTranslation();
  const [hasSeenOnboarding, setHasSeenOnboarding] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const v = await AsyncStorage.getItem('hasSeenOnboarding');
        if (mounted) setHasSeenOnboarding(v === 'true');
      } catch (e) {
        if (mounted) setHasSeenOnboarding(false);
      }
    };
    check();
    return () => {
      mounted = false;
    };
  }, []);

  const onFinishOnboarding = React.useCallback(async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setHasSeenOnboarding(true);
  }, []);

  console.log('AppNavigator render:', { hasSession: !!session, loading, isRecoveryMode });

  if (loading) {
    console.log('Loading state, null döndürülüyor');
    return null; // veya bir loading ekranı
  }

  if (hasSeenOnboarding === null) {
    return null;
  }

  console.log('Session durumu:', session ? 'Var' : 'Yok', 'Recovery mode:', isRecoveryMode);

  // Recovery modundayken session olsa bile auth stack'i göster
  const showAuthStack = !session || isRecoveryMode;
  const showOnboarding = !session && !isRecoveryMode && hasSeenOnboarding === false;

  return (
    <OnboardingFinishContext.Provider value={showOnboarding ? onFinishOnboarding : null}>
      <Stack.Navigator screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.tabBarBackground },
        animation: 'default',
        headerBackButtonDisplayMode: 'minimal',
        headerTitleStyle: {
          fontFamily: fonts.semibold,
          fontSize: fontSizes.bodyLarge
        },
        // DeckDetail vb. geri çıkışta bir karelik yanlış ekran / flash azaltır (native stack + detach etkileşimi)
        detachInactiveScreens: false,
      }}>
        {showOnboarding ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        ) : showAuthStack ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: false, headerBackButtonDisplayMode: 'minimal' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ freezeOnBlur: true, headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen
              name="DeckDetail"
              component={DeckDetailScreen}
              options={{
                headerShown: true,
                title: t('tabs.deckInfo', 'Deste Bilgisi'),
                headerTitleAlign: 'center',
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.background },
                ...(Platform.OS === 'android' && {
                  headerRightContainerStyle: { minWidth: 72 },
                  headerLeftContainerStyle: { minWidth: 56 },
                }),
              }}
            />
            <Stack.Screen
              name="Discover"
              component={DiscoverScreen}
              options={{
                headerShown: true,
                title: '',
                headerTransparent: true,
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: {
                  backgroundColor: colors.background,
                },
                headerTitleAlign: 'center',
                headerStyle: {
                  backgroundColor: 'transparent',
                },
                headerTintColor: colors.text, // Geri butonu beyaz olsun
              }}
            />
            <Stack.Screen
              name="CategoryDeckList"
              component={CategoryDeckListScreen}
              options={({ route }) => ({
                headerShown: true,
                title: '',
                headerTitleAlign: 'center',
                headerTransparent: true,
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: {
                  backgroundColor: colors.background,
                },
                headerStyle: {
                  backgroundColor: 'transparent',
                },
                headerTintColor: '#fff', // Geri butonu beyaz olsun
              })}
            />
            <Stack.Screen
              name="CreateDeck"
              component={CreateScreen}
              options={{
                headerShown: true,
                title: t('tabs.createDeck', 'Deste Oluştur'),
                headerTitleAlign: 'center',
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.background },
              }}
            />
            <Stack.Screen name="SwipeDeck" component={SwipeDeckScreen} options={{ headerShown: true, headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', gestureEnabled: false }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: true, title: t('tabs.profileEdit', 'Profili Düzenle'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="Blocked" component={BlockedScreen} options={{ headerShown: true, title: t('profile.blockedSection', 'Engellenenler'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="ProfileAccount" component={AccountScreen} options={{ headerShown: true, title: t('profile.account', 'Hesap'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="ProfileSettings" component={SettingsScreen} options={{ headerShown: true, title: t('profile.settings', 'Ayarlar'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="ProfileInfo" component={InfoScreen} options={{ headerShown: true, title: t('profile.info', 'Bilgi ve destek'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="DeckEdit" component={DeckEditScreen} options={{ headerShown: true, title: t('tabs.deckEdit', 'Desteyi Düzenle'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen
              name="AddCard"
              component={AddCardScreen}
              options={({ navigation }) => ({
                headerShown: true,
                title: t('tabs.addCard', 'Kart Ekle'),
                headerTitleAlign: 'center',
                headerBackButtonDisplayMode: 'minimal',
                headerRight: () => (
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic('selection');
                      requestAnimationFrame(() => {
                        navigation.setParams({ openCsvModal: true });
                      });
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      // Sadece Android'e özel border ve padding ayarları:
                      ...Platform.select({
                        android: {
                          borderWidth: 1,
                          borderColor: colors.text,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 8
                        },
                        ios: {
                          paddingHorizontal: 8,
                        }
                      })
                    }}
                  >
                    <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: fontSizes.body, marginRight: 6 }}>
                      CSV
                    </Text>
                    <Iconify icon="solar:cloud-upload-broken" size={22} color={colors.text} />
                  </TouchableOpacity>
                ),
              })}
            />
            <Stack.Screen name="EditCard" component={EditCardScreen} options={{ headerShown: true, title: t('cardDetail.edit', 'Kartı Düzenle'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="DeckCards" component={DeckCardsScreen} options={{ headerShown: true, title: t('tabs.cards', 'Kartlar'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
            <Stack.Screen name="Chapters" component={ChaptersScreen} options={{ headerShown: true, title: t('tabs.chapters', 'Bölümler'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="ChapterCards" component={ChapterCardsScreen} options={{
              headerShown: true,
              title: '',
              headerTitleAlign: 'center',
              headerBackButtonDisplayMode: 'minimal',
            }} />
            <Stack.Screen name="FavoriteDecks" component={FavoriteDecks} options={{ headerShown: true, title: t('library.favoriteDecksTitle', 'Favori Desteler'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="FavoriteCards" component={FavoriteCards} options={{ headerShown: true, title: t('library.favoriteCardsTitle', 'Favori Kartlar'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
          </>
        )}
      </Stack.Navigator>
    </OnboardingFinishContext.Provider>
  );
} 