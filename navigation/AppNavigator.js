import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import CreateScreen from '../screens/CreateScreen';
import LibraryScreen from '../screens/LibraryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DeckDetailScreen from '../screens/DeckDetailScreen';
import CategoryDeckListScreen from '../screens/CategoryDeckListScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { useTheme } from '../theme/theme';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SwipeDeckScreen from '../screens/SwipeDeckScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ProfileAvatarButton from '../components/ProfileAvatarButton';
import DeckEditScreen from '../screens/DeckEditScreen';
import CustomTabBar from '../components/CustomTabBar';
import AddCardScreen from '../screens/AddCardScreen';
import EditCardScreen from '../screens/EditCardScreen';
import DeckCardsScreen from '../screens/DeckCardsScreen';
import CardDetailScreen from '../screens/CardDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors } = useTheme();
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
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
        },
        headerStyle: {
          backgroundColor: colors.tabBarBackground,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 4,
          fontFamily: 'Inter-Light',
          textAlign: 'center',
          marginBottom: 10,
          marginTop: -8
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
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Create') {
            iconName = focused ? 'plus-circle' : 'plus-circle-outline';
          } else if (route.name === 'Library') {
            iconName = 'bookshelf';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'account-circle' : 'account-circle-outline';
          }
          return (
            <MaterialCommunityIcons
              name={iconName}
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Anasayfa', tabBarLabel: 'Anasayfa' }} />
      <Tab.Screen name="Create" component={CreateScreen} options={{ title: 'Deste Oluştur', tabBarLabel: 'Oluştur', headerShown: true, headerTitleAlign: 'center', headerRight: () => <ProfileAvatarButton />}} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ title: 'Kitaplığım', tabBarLabel: 'Kitaplığım', headerShown: true, headerTitleAlign: 'center', headerRight: () => <ProfileAvatarButton />}} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profilim', tabBarLabel: 'Profilim' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { colors } = useTheme();
  const { session, loading } = useAuth();

  if (loading) {
    return null; // veya bir loading ekranı
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, headerStyle: { backgroundColor: colors.tabBarBackground } }}>
      {!session ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="DeckDetail" component={DeckDetailScreen} options={{ headerShown: true, title: 'Deste Bilgisi', headerTitleAlign: 'center' }} />
          <Stack.Screen
            name="CategoryDeckList"
            component={CategoryDeckListScreen}
            options={({ route }) => ({
              headerShown: true,
              title: route.params?.title || 'Tüm Desteler',
              headerTitleAlign: 'center',
            })}
          />
          <Stack.Screen name="SwipeDeck" component={SwipeDeckScreen} options={{ headerShown: true, title: 'Kartları Öğren', headerTitleAlign: 'center' }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: true, title: 'Profili Düzenle', headerTitleAlign: 'center' }} />
          <Stack.Screen name="DeckEdit" component={DeckEditScreen} options={{ headerShown: true, title: 'Desteyi Düzenle', headerTitleAlign: 'center' }} />
          <Stack.Screen name="AddCard" component={AddCardScreen} options={{ headerShown: true, title: 'Kart Ekle', headerTitleAlign: 'center' }} />
          <Stack.Screen name="EditCard" component={EditCardScreen} options={{ headerShown: true, title: 'Kartı Düzenle', headerTitleAlign: 'center' }} />
          <Stack.Screen name="DeckCards" component={DeckCardsScreen} options={{ headerShown: true, title: 'Kartlar', headerTitleAlign: 'center' }} />
          <Stack.Screen name="CardDetail" component={CardDetailScreen} options={{ headerShown: true, title: 'Kart Detayı', headerTitleAlign: 'center' }} />
        </>
      )}
    </Stack.Navigator>
  );
} 