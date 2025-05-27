// App.js
import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, StatusBar, View, Text, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Import screen components
import LoginScreen from './screens/LoginScreen';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import MakePicksScreen from './screens/MakePicksScreen';
import MyPicksScreen from './screens/MyPicksScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import StatsScreen from './screens/StatsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ProfileScreen from './screens/ProfileScreen';

const ForgotPasswordScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Forgot Password Screen (Coming Soon)</Text>
  </View>
);

const AuthStackNav = createNativeStackNavigator();
const MainAppTabNav = createBottomTabNavigator();
const RootStackNav = createNativeStackNavigator();
const HomeStackNav = createNativeStackNavigator();

const COLORS = {
  primaryBlue: '#1A237E',
  appBackground: '#F4F6F8',
  activeTab: '#1A237E',
  inactiveTab: '#757575',
};

// Stack Navigator for the Home Tab flow, now also including Profile and Settings
const HomeStackNavigator = () => {
  return (
    <HomeStackNav.Navigator screenOptions={{ headerShown: false }}>
      <HomeStackNav.Screen name="HomeFeed" component={HomeScreen} />
      <HomeStackNav.Screen name="MakePicks" component={MakePicksScreen} />
      <HomeStackNav.Screen name="Profile" component={ProfileScreen} />
      <HomeStackNav.Screen name="Settings" component={SettingsScreen} />
    </HomeStackNav.Navigator>
  );
};

const MainAppTabs = () => {
  return (
    <MainAppTabNav.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeStack') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'MyPicks') {
            iconName = focused ? 'checkmark-done-circle' : 'checkmark-done-circle-outline';
          } else if (route.name === 'Leaderboard') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'Stats') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          }
          // Removed Settings and Profile from here
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.activeTab,
        tabBarInactiveTintColor: COLORS.inactiveTab,
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
        tabBarLabelStyle: { fontSize: 10, paddingBottom: 2 },
      })}
    >
      <MainAppTabNav.Screen
        name="HomeStack"
        component={HomeStackNavigator}
        options={{ tabBarLabel: 'Home' }}
      />
      <MainAppTabNav.Screen name="MyPicks" component={MyPicksScreen} options={{ tabBarLabel: 'My Picks'}} />
      <MainAppTabNav.Screen name="Leaderboard" component={LeaderboardScreen} />
      <MainAppTabNav.Screen name="Stats" component={StatsScreen} />
      {/* Settings and Profile tabs are removed from here */}
    </MainAppTabNav.Navigator>
  );
};

const AuthScreensStack = ({ onLoginSuccess }) => {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="Login">
        {(props) => <LoginScreen {...props} onLoginSuccess={onLoginSuccess} />}
      </AuthStackNav.Screen>
      <AuthStackNav.Screen name="SignUp" component={AuthScreen} />
      <AuthStackNav.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStackNav.Navigator>
  );
};

const App = () => {
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrapAsync = async () => {
      let userToken;
      try {
        userToken = await AsyncStorage.getItem('currentUser');
      } catch (e) {
        console.error("Restoring token failed", e);
      }
      setIsUserLoggedIn(!!userToken);
      setIsLoading(false);
    };
    bootstrapAsync();
  }, []);

  const handleLoginSuccess = () => {
    setIsUserLoggedIn(true);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primaryBlue }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryBlue} />
      <RootStackNav.Navigator screenOptions={{ headerShown: false }}>
        {isUserLoggedIn ? (
          <RootStackNav.Screen name="MainApp" component={MainAppTabs} />
        ) : (
          <RootStackNav.Screen name="Auth">
            {(props) => <AuthScreensStack {...props} onLoginSuccess={handleLoginSuccess} />}
          </RootStackNav.Screen>
        )}
      </RootStackNav.Navigator>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.appBackground,
  },
});

export default App;