// BottomNavBar.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

// --- Icons (Ideally, import from a shared icon file or use react-native-vector-icons) ---
const HomeIcon = ({ active }) => <Text style={[navBarStyles.navBarIcon, active && navBarStyles.activeNavBarIcon]}>🏠</Text>;
const StatsIcon = ({ active }) => <Text style={[navBarStyles.navBarIcon, active && navBarStyles.activeNavBarIcon]}>📊</Text>;
const GroupsIcon = ({ active }) => <Text style={[navBarStyles.navBarIcon, active && navBarStyles.activeNavBarIcon]}>👥</Text>;
const SettingsIcon = ({ active }) => <Text style={[navBarStyles.navBarIcon, active && navBarStyles.activeNavBarIcon]}>⚙️</Text>;

const PRIMARY_COLOR = '#4A3780'; // Define or import

const BottomNavBar = ({ activeTab, onTabPress }) => {
  const imageBottomNavTabs = [
    { name: 'Home', icon: HomeIcon, screenName: 'Home' },
    { name: 'Stats', icon: StatsIcon, screenName: 'Leaderboard' }, // Or 'Stats'
    { name: 'Make Picks', icon: GroupsIcon, screenName: 'MakePicks' }, // Changed Groups to Make Picks for example
    { name: 'Settings', icon: SettingsIcon, screenName: 'Settings' },
  ];

  return (
    <View style={navBarStyles.navBar}>
      {imageBottomNavTabs.map(tab => (
        <TouchableOpacity
          key={tab.name}
          style={navBarStyles.navBarItem}
          onPress={() => onTabPress(tab.screenName)}
        >
          <tab.icon active={activeTab === tab.screenName} /> {/* Compare with screenName for active state */}
          <Text style={[navBarStyles.navBarText, activeTab === tab.screenName && navBarStyles.activeNavBarText]}>
            {tab.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const navBarStyles = StyleSheet.create({
  navBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#DDDDDD', paddingVertical: 8, paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
  navBarItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navBarIcon: { fontSize: 24, color: '#777777' },
  activeNavBarIcon: { color: PRIMARY_COLOR },
  navBarText: { fontSize: 10, color: '#777777', marginTop: 2 },
  activeNavBarText: { color: PRIMARY_COLOR, fontWeight: '600' },
});

export default BottomNavBar;