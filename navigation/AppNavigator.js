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
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { renderToImageAsync } from 'expo-font';
import React from 'react';
import { useTheme } from '../theme/theme';
import SwipeDeckScreen from '../screens/cards/SwipeDeckScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import BlockedScreen from '../screens/profile/BlockedScreen';
import AccountScreen from '../screens/profile/AccountScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import InfoScreen from '../screens/profile/InfoScreen';
import DeckEditScreen from '../screens/decks/EditDeckScreen';
import { withTabBarInset } from '../components/ui/TabBarInset';
import { PHOSPHOR_FAMILIES, phosphorGlyph } from '../components/ui/PhosphorIcon';
import { TAB_ICONS, ICONS } from '../theme/icons';
import AddCardScreen from '../screens/cards/CreateCardScreen';
import DeckCardsScreen from '../screens/cards/CardsOfDeckScreen';
import { EditCardScreen } from '../components/layout/EditCardForm';
import ChaptersScreen from '../screens/decks/ChaptersScreen';
import ChapterCardsScreen from '../screens/decks/CardsOfChapter.js';
import FavoriteDecks from '../screens/library/FavoriteDecks';
import FavoriteCards from '../screens/library/FavoriteCards';
import { TouchableOpacity, Platform, View } from 'react-native';
import { Text } from '../components/ui/AppText';
import { useTranslation } from 'react-i18next';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerHaptic } from '../lib/hapticManager';
import { fontSizes, fonts } from '../theme/typography';
import PhosphorIcon from '../components/ui/PhosphorIcon';

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
// For screens that make their header transparent with setOptions (both
// platforms): the same look from the first frame, before setOptions runs.
const TRANSPARENT_HEADER_FIRST_FRAME = {
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
};
const Tab = createNativeBottomTabNavigator();

// Tab screens, wrapped so useListBottomInset knows the native tab bar height.
const HomeTab = withTabBarInset(HomeScreen);
const DiscoverTab = withTabBarInset(DiscoverScreen);
const LibraryTab = withTabBarInset(LibraryScreen);
const ProfileTab = withTabBarInset(ProfileScreen);

// Phosphor icon per tab (TAB_ICONS, theme/icons.js): regular when idle, fill
// when selected. Android shows one icon for both states (native limitation),
// so it always uses regular.
const TAB_ICON_SIZE = Platform.OS === 'ios' ? 26 : 24;

// The native tab bar takes images, not React views, so the Phosphor glyphs are
// rendered to images once (expo-font). They are tinted by the tab bar, so the
// color here doesn't matter. Resolves to {} on failure: tabs then show labels only.
let tabIconsPromise = null;
function loadTabIcons() {
  if (!tabIconsPromise) {
    const render = async (name, weight) => {
      const { uri, width, height, scale } = await renderToImageAsync(phosphorGlyph(name), {
        fontFamily: PHOSPHOR_FAMILIES[weight],
        size: TAB_ICON_SIZE,
        color: 'black',
      });
      return { type: 'image', source: { uri, width, height, scale } };
    };
    tabIconsPromise = Promise.all(
      Object.entries(TAB_ICONS).map(async ([route, name]) => [
        route,
        { regular: await render(name, 'regular'), fill: await render(name, 'fill') },
      ])
    )
      .then(Object.fromEntries)
      .catch((e) => {
        console.warn('Tab icons could not be rendered', e);
        return {};
      });
  }
  return tabIconsPromise;
}

function MainTabs() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [icons, setIcons] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    loadTabIcons().then((loaded) => alive && setIcons(loaded));
    return () => {
      alive = false;
    };
  }, []);

  // Wait for the icons so the tab bar doesn't appear without them first.
  if (!icons) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Other tabs render in the background after the first screen (React
        // deferred render), so opening a tab shows its content at once instead
        // of an empty dark page and then a skeleton. Their lists mostly come
        // from the query cache (disk), so this costs few requests.
        lazy: false,
        // Tab screens lay out their own top/bottom spacing; don't let iOS add
        // automatic scroll insets (that would push the Home hero down).
        overrideScrollViewContentInsetAdjustmentBehavior: false,
        tabBarActiveTintColor: colors.buttonColor,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: { backgroundColor: colors.tabBarBackground }, // Android, iOS ≤18
        tabBarLabelStyle: { fontFamily: fonts.medium },
        tabBarIcon: icons[route.name]
          ? ({ focused }) => (focused && Platform.OS === 'ios' ? icons[route.name].fill : icons[route.name].regular)
          : undefined,
      })}
    >
      <Tab.Screen name="Home" component={HomeTab} options={{ title: t('tabs.home', 'Anasayfa'), tabBarLabel: t('tabs.home', 'Anasayfa') }} />
      <Tab.Screen name="DiscoverTab" component={DiscoverTab} options={{ title: t('tabs.discover', 'Keşfet'), tabBarLabel: t('tabs.discover', 'Keşfet') }} />
      <Tab.Screen name="Library" component={LibraryTab} options={{ title: t('tabs.myLibrary', 'Kitaplığım'), tabBarLabel: t('tabs.library', 'Kitaplığım') }} />
      <Tab.Screen name="Profile" component={ProfileTab} options={{ title: t('tabs.profile', 'Profilim'), tabBarLabel: t('tabs.profile', 'Profilim') }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { colors } = useTheme();
  const { session, loading, isRecoveryMode } = useAuth();
  const { t } = useTranslation();
  const [hasSeenOnboarding, setHasSeenOnboarding] = React.useState(null);
  // onboarding's last slide: 'register' (Hemen Başla) or 'login' (Zaten hesabım var)
  const [authStart, setAuthStart] = React.useState('login');

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

  const onFinishOnboarding = React.useCallback(async (target = 'login') => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setAuthStart(target === 'register' ? 'register' : 'login');
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
        ) : isRecoveryMode ? (
          // Password-reset link: AuthContext exchanged the code; this is the only
          // screen until the new password is saved or the flow is cancelled.
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: false }} />
        ) : showAuthStack ? (
          // the first screen listed opens first (onboarding picks it)
          authStart === 'register' ? (
            <>
              <Stack.Screen name="Register" component={RegisterScreen} options={{ headerBackButtonDisplayMode: 'minimal' }} />
              <Stack.Screen name="Login" component={LoginScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} options={{ headerBackButtonDisplayMode: 'minimal' }} />
            </>
          )
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ freezeOnBlur: true, headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen
              name="DeckDetail"
              component={DeckDetailScreen}
              options={{
                headerShown: true,
                // Same header look DeckDetailScreen sets with setOptions, given
                // here too so it applies from the first frame: setOptions only
                // runs once the screen is focused, so the first visit of a
                // session showed one frame of the default header (with the
                // scroll-edge shadow).
                title: '',
                headerTransparent: true,
                headerStyle: { backgroundColor: 'transparent' },
                // no bar shadow on the first frame either (it showed on the first visit)
                headerShadowVisible: false,
                headerTintColor: '#FFFFFF',
                scrollEdgeEffects: { top: 'hidden', bottom: 'automatic', left: 'automatic', right: 'automatic' },
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
                ...SCROLL_EDGE_HEADER,
              }}
            />
            <Stack.Screen name="SwipeDeck" component={SwipeDeckScreen} options={{ headerShown: true, headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', gestureEnabled: false, ...TRANSPARENT_HEADER_FIRST_FRAME, headerTintColor: '#FFFFFF' }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: true, title: t('tabs.profileEdit', 'Profili Düzenle'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
            <Stack.Screen name="Blocked" component={BlockedScreen} options={{ headerShown: true, title: t('profile.blockedSection', 'Engellenenler'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
            <Stack.Screen name="ProfileAccount" component={AccountScreen} options={{ headerShown: true, title: t('profile.account', 'Hesap'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
            <Stack.Screen name="ProfileSettings" component={SettingsScreen} options={{ headerShown: true, title: t('profile.settings', 'Ayarlar'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
            <Stack.Screen name="ProfileInfo" component={InfoScreen} options={{ headerShown: true, title: t('profile.info', 'Bilgi ve destek'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
            <Stack.Screen name="DeckEdit" component={DeckEditScreen} options={{ headerShown: true, title: t('tabs.deckEdit', 'Desteyi Düzenle'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
            <Stack.Screen
              name="AddCard"
              component={AddCardScreen}
              options={({ navigation }) => ({
                headerShown: true,
                title: t('tabs.addCard', 'Kart Ekle'),
                headerTitleAlign: 'center',
                headerBackButtonDisplayMode: 'minimal',
                ...SCROLL_EDGE_HEADER,
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
                    <PhosphorIcon icon={ICONS.upload} size={22} color={colors.text} />
                  </TouchableOpacity>
                ),
              })}
            />
            <Stack.Screen name="EditCard" component={EditCardScreen} options={{ headerShown: true, title: t('cardDetail.edit', 'Kartı Düzenle'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
            <Stack.Screen name="DeckCards" component={DeckCardsScreen} options={{ headerShown: true, title: t('tabs.cards', 'Kartlar'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
            <Stack.Screen name="Chapters" component={ChaptersScreen} options={{ headerShown: true, title: t('tabs.chapters', 'Bölümler'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
            <Stack.Screen name="ChapterCards" component={ChapterCardsScreen} options={{
              headerShown: true,
              title: '',
              ...TRANSPARENT_HEADER_FIRST_FRAME,
              headerTitleAlign: 'center',
              headerBackButtonDisplayMode: 'minimal',
            }} />
            <Stack.Screen name="FavoriteDecks" component={FavoriteDecks} options={{ headerShown: true, title: t('library.favoriteDecksTitle', 'Favori Desteler'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
            <Stack.Screen name="FavoriteCards" component={FavoriteCards} options={{ headerShown: true, title: t('library.favoriteCardsTitle', 'Favori Kartlar'), headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', ...SCROLL_EDGE_HEADER }} />
          </>
        )}
      </Stack.Navigator>
    </OnboardingFinishContext.Provider>
  );
} 