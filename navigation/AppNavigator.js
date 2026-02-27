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
import ProfileAvatarButton from '../components/layout/ProfileAvatarButton';
import DeckEditScreen from '../screens/decks/EditDeckScreen';
import CustomTabBar from '../components/ui/CustomTabBar';
import AddCardScreen from '../screens/cards/CreateCardScreen';
import DeckCardsScreen from '../screens/cards/CardsOfDeckScreen';
import ChaptersScreen from '../screens/decks/ChaptersScreen';
import ChapterCardsScreen from '../screens/decks/CardsOfChapter.js';
import FavoriteDecks from '../screens/library/FavoriteDecks';
import FavoriteCards from '../screens/library/FavoriteCards';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import { scale, moderateScale, verticalScale } from '../lib/scaling';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerHaptic } from '../lib/hapticManager';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.buttonColor,
        tabBarInactiveTintColor: colors.subtext,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          display: 'none', // Varsayılan tab bar'ı gizle, custom tab bar kullanacağız
        },
        headerStyle: {
          backgroundColor: colors.tabBarBackground,
        },
        tabBarLabelStyle: {
          fontSize: moderateScale(12),
          marginBottom: verticalScale(10),
          fontFamily: 'Inter',
          textAlign: 'center',
          marginTop: verticalScale(-8),
        },
        tabBarIconStyle: {
          marginTop: verticalScale(4),
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
          } else if (route.name === 'Create') {
            homeIcon = focused ? 'fluent:note-add-20-filled' : 'fluent:note-add-20-regular';
          } else if (route.name === 'Library') {
            homeIcon = focused ? 'solar:library-bold-duotone' : 'solar:library-line-duotone';
          } else if (route.name === 'Profile') {
            homeIcon = focused ? 'solar:user-bold' : 'solar:user-broken';
          }

          return (
            <Iconify
              icon={homeIcon}
              size={moderateScale(28)}
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
      <Tab.Screen name="Create" component={CreateScreen} options={{ tabBarLabel: t('tabs.create', 'Oluştur'), title: t('tabs.create', 'Oluştur'), headerShown: true, headerTitleAlign: 'center', headerRight: () => <ProfileAvatarButton />}} />
      <Tab.Screen 
        name="Library" 
        component={LibraryScreen} 
        options={{ 
          title: t('tabs.myLibrary', 'Kitaplığım'), 
          tabBarLabel: t('tabs.library', 'Kitaplığım'), 
          headerShown: false,
        }} 
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tabs.profile', 'Profilim'), tabBarLabel: t('tabs.profile', 'Profilim') }} />
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

  console.log('AppNavigator render:', { session, loading, isRecoveryMode });

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
      headerTitleStyle: {
        fontFamily: 'Inter-SemiBold',
        fontSize: 18
      }
    }}>
      {showOnboarding ? (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        </>
      ) : showAuthStack ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: false }} />
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="DeckDetail" component={DeckDetailScreen} options={{ headerShown: true, title: t('tabs.deckInfo', 'Deste Bilgisi'), headerTitleAlign: 'center' }} />
          <Stack.Screen
            name="Discover"
            component={DiscoverScreen}
            options={{
              headerShown: true,
              title: '',
              headerTitleAlign: 'center',
              headerTransparent: true,
              headerStyle: {
                backgroundColor: 'transparent',
              },
              headerTintColor: '#fff', // Geri butonu beyaz olsun
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
              headerStyle: {
                backgroundColor: 'transparent',
              },
              headerTintColor: '#fff', // Geri butonu beyaz olsun
            })}
          />
          <Stack.Screen name="SwipeDeck" component={SwipeDeckScreen} options={{ headerShown: true, title: t('tabs.deckCards', 'Öğren'), headerTitleAlign: 'center', }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: true, title: t('tabs.profileEdit', 'Profili Düzenle'), headerTitleAlign: 'center' }} />
          <Stack.Screen name="DeckEdit" component={DeckEditScreen} options={{ headerShown: true, title: t('tabs.deckEdit', 'Desteyi Düzenle'), headerTitleAlign: 'center' }} />
          <Stack.Screen name="AddCard" component={AddCardScreen} options={({ navigation }) => ({
            headerShown: true,
            title: t('tabs.addCard', 'Kart Ekle'),
            headerTitleAlign: 'center',
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
                  marginRight: scale(12),
                  borderWidth: moderateScale(1), borderColor: colors.text, paddingHorizontal: scale(6), paddingVertical: verticalScale(2), borderRadius: moderateScale(8)
                }}
              >
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: moderateScale(15), marginRight: scale(6)}}>CSV</Text>
                <Iconify icon="solar:cloud-upload-broken" size={moderateScale(22)} color={colors.text} />
              </TouchableOpacity>
            ),
          })} />
          <Stack.Screen name="DeckCards" component={DeckCardsScreen} options={{ headerShown: true, title: t('tabs.cards', 'Kartlar'), headerTitleAlign: 'center' }} />
          <Stack.Screen name="Chapters" component={ChaptersScreen} options={{ headerShown: true, title: t('tabs.chapters', 'Bölümler'), headerTitleAlign: 'center' }} />
          <Stack.Screen name="ChapterCards" component={ChapterCardsScreen} options={{
            headerShown: true,
            title: '',
            headerTitleAlign: 'center',
            headerTransparent: true,
            headerStyle: {
              backgroundColor: 'transparent',
            },
            headerTintColor: '#fff', // Geri butonu beyaz olsun
          }} />
          <Stack.Screen name="FavoriteDecks" component={FavoriteDecks} options={{ headerShown: true, title: t('library.favoriteDecksTitle', 'Favori Desteler'), headerTitleAlign: 'center' }} />
          <Stack.Screen name="FavoriteCards" component={FavoriteCards} options={{ headerShown: true, title: t('library.favoriteCardsTitle', 'Favori Kartlar'), headerTitleAlign: 'center' }} />
        </>
      )}
    </Stack.Navigator>
    </OnboardingFinishContext.Provider>
  );
} 