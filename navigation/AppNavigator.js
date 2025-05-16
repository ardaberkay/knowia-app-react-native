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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.tabBarBackground,
        tabBarInactiveTintColor: colors.tabBarBackground,
        tabBarStyle: {
          backgroundColor: colors.buttonColor,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          marginBottom: 8,
          marginTop: 0,
          padding: 0,
        },
        tabBarIconStyle: {
          marginTop: 8,
          marginBottom: 0,
          padding: 0,
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
          // Basit bir animasyon efekti: focused ise scale ve opacity artır
          return (
            <MaterialCommunityIcons
              name={iconName}
              size={36}
              color={color}
              style={{
                opacity: focused ? 1 : 0.7,
                transform: [{ scale: focused ? 1.15 : 1 }],
              }}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Anasayfa' }} />
      <Tab.Screen name="Create" component={CreateScreen} options={{ title: 'Oluştur' }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ title: 'Kitaplık' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return null; // veya bir loading ekranı
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
        </>
      )}
    </Stack.Navigator>
  );
} 