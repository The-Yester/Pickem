// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  Button
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';

const ArrowRightIcon = () => <Text style={{color: 'white', fontSize: 16}}>GAME ON! ➤</Text>;

// Colors
const PRIMARY_COLOR = '#1f366a';
const SECONDARY_COLOR = 'green';
const ACCENT_COLOR = '#FF9800';
const HEADER_ICON_COLOR = '#FFFFFF';

// --- Configuration for Google Sheets API ---
const GOOGLE_SHEETS_API_KEY = 'AIzaSyAKWejwstrPy1vGOwoMeuO73FoOEbpJqKw';
const SPREADSHEET_ID = '1rVuE_BNO9C9M69uZnAHfD5pTI9sno9UXQI4NTDPCQLY';
const SHEET_NAME_AND_RANGE = '2025Matchups!A:M';

const parseSheetData = (jsonData) => {
  if (!jsonData || !jsonData.values || jsonData.values.length < 2) {
    console.warn("Google Sheets API: No data or insufficient data. JSON Response:", jsonData);
    return [];
  }
  const [headerRow, ...dataRows] = jsonData.values;
  const headers = headerRow.map(header => String(header).trim());
  return dataRows.map(row => {
    const entry = {};
    headers.forEach((header, index) => {
      const value = (row[index] !== undefined && row[index] !== null) ? String(row[index]).trim() : '';
      if (value.toUpperCase() === 'TRUE') { entry[header] = true; }
      else if (value.toUpperCase() === 'FALSE') { entry[header] = false; }
      else if (!isNaN(Number(value)) && value !== '') { entry[header] = Number(value); }
      else { entry[header] = value; }
    });
    return entry;
  });
};

const HomeScreen = ({ navigation }) => {
  const [allMatchups, setAllMatchups] = useState([]);
  const [featuredMatchup, setFeaturedMatchup] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingScore, setIsProcessingScore] = useState(false);
  const [error, setError] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [allUserPicks, setAllUserPicks] = useState([]);
  const [totalUserScore, setTotalUserScore] = useState(0);
  const [currentWeek, setCurrentWeek] = useState(1);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('currentUser');
        if (userDataString) {
          setLoggedInUser(JSON.parse(userDataString));
        } else {
          setLoggedInUser(null);
        }
      } catch (e) {
        console.error("Failed to fetch user data from storage", e);
        setLoggedInUser(null);
      }
    };
    fetchUserData();
  }, []);

  const fetchMatchupsFromSheet = async () => {
    if (GOOGLE_SHEETS_API_KEY === 'YOUR_GOOGLE_SHEETS_API_KEY_HERE' || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
      setError('⚠️ Configuration Needed: Please update API_KEY and SPREADSHEET_ID in HomeScreen.js');
      setIsLoading(false);
      return;
    }
    const encodedSheetNameAndRange = encodeURIComponent(SHEET_NAME_AND_RANGE);
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedSheetNameAndRange}?key=${GOOGLE_SHEETS_API_KEY}`;
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to parse error response." }));
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      const parsedData = parseSheetData(jsonData);
      setAllMatchups(parsedData);
    } catch (e) {
      console.error("Failed to fetch or parse matchups:", e);
      setError(`Failed to load matchups. ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchupsFromSheet();
  }, []);

  // Update featured matchup when currentWeek or allMatchups change
  useEffect(() => {
    if (allMatchups.length > 0) {
      const currentWeekMatchups = allMatchups.filter(m => m.Week === currentWeek);
      if (currentWeekMatchups.length > 0) {
        // Select a random matchup from the current week's matchups
        const randomIndex = Math.floor(Math.random() * currentWeekMatchups.length);
        setFeaturedMatchup(currentWeekMatchups[randomIndex]);
      } else {
        setFeaturedMatchup(null); // No matchups for the current week
      }
    } else {
      setFeaturedMatchup(null); // No matchups loaded at all
    }
  }, [currentWeek, allMatchups]);


  useEffect(() => {
    const fetchUserPicks = async () => {
      if (loggedInUser && loggedInUser.username) {
        try {
          const picksDataString = await AsyncStorage.getItem(`userPicks_${loggedInUser.username}`);
          setAllUserPicks(picksDataString ? JSON.parse(picksDataString) : []);
        } catch (e) {
          console.error("Failed to fetch user picks:", e);
          setAllUserPicks([]);
        }
      } else {
        setAllUserPicks([]);
      }
    };
    if (loggedInUser) {
        fetchUserPicks();
    }
  }, [loggedInUser]);

  useEffect(() => {
    if (allMatchups.length === 0 || !loggedInUser) {
      setTotalUserScore(0);
      setIsProcessingScore(false);
      return;
    }
    setIsProcessingScore(true);
    let score = 0;
    allMatchups.forEach(matchup => {
      if (matchup.UniqueID && matchup.WinningTeam && String(matchup.WinningTeam).trim() !== '') {
        const userPickForGame = allUserPicks.find(pick => pick.gameUniqueID === matchup.UniqueID);
        const winningTeamFullNameRaw = matchup.WinningTeam;
        const winningTeamFullName = winningTeamFullNameRaw ? String(winningTeamFullNameRaw).trim() : null;
        let actualWinnerAbbrForComparison = null;
        if (winningTeamFullName) {
            if (String(matchup.HomeTeamName).trim() === winningTeamFullName) {
                actualWinnerAbbrForComparison = String(matchup.HomeTeamAB).trim().toUpperCase();
            } else if (String(matchup.AwayTeamName).trim() === winningTeamFullName) {
                actualWinnerAbbrForComparison = String(matchup.AwayTeamAB).trim().toUpperCase();
            } else {
                actualWinnerAbbrForComparison = winningTeamFullName.toUpperCase();
            }
        }
        const userPickedRaw = userPickForGame ? userPickForGame.pickedTeamAbbr : null;
        const userPickedAbbr = userPickedRaw ? String(userPickedRaw).trim().toUpperCase() : null;
        if (userPickForGame && actualWinnerAbbrForComparison && userPickedAbbr === actualWinnerAbbrForComparison) {
          score++;
        }
      }
    });
    setTotalUserScore(score);
    setIsProcessingScore(false);
  }, [allMatchups, allUserPicks, loggedInUser]);


  const handleNavigateToMakePicks = () => {
    if (navigation && navigation.navigate) {
        navigation.navigate('MakePicks', { week: currentWeek });
    } else {
        console.error("Navigation object or navigate function is not available in HomeScreen.");
        Alert.alert("Navigation Error", "Could not navigate. Please try again later.");
    }
  };

  if (isLoading) {
    return (
      <View style={[homeScreenStyles.container, homeScreenStyles.centered]}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={{marginTop: 10}}>Loading matchups...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[homeScreenStyles.container, homeScreenStyles.centered, {padding: 20}]}>
        <Text style={{color: 'red', textAlign: 'center', marginBottom: 10}}>{error}</Text>
        <Button title="Retry Fetch" onPress={fetchMatchupsFromSheet} color={PRIMARY_COLOR}/>
      </View>
    );
  }

  return (
    <View style={homeScreenStyles.container}>
      <View style={homeScreenStyles.header}>
        <Text style={homeScreenStyles.headerTitle}>The League: Weekly Pick'em</Text>
        <View style={homeScreenStyles.headerIconsContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={homeScreenStyles.headerButton}>
            <Ionicons name="settings-outline" size={26} color={HEADER_ICON_COLOR} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={homeScreenStyles.headerButton}>
            <Ionicons name="person-circle-outline" size={30} color={HEADER_ICON_COLOR} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={homeScreenStyles.scrollView} contentContainerStyle={homeScreenStyles.scrollViewContent}>
        <Text style={homeScreenStyles.welcomeText}>Welcome back, {loggedInUser?.name || loggedInUser?.username || "User"}!</Text>
        <Text style={homeScreenStyles.subHeaderText}>It's Week {currentWeek}. Time to make your picks!</Text>
        <View style={{flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10}}>
            <Button title="Prev Week" onPress={() => setCurrentWeek(Math.max(1, currentWeek - 1))} />
            <Button title="Next Week" onPress={() => setCurrentWeek(currentWeek + 1)} />
        </View>

        <TouchableOpacity style={homeScreenStyles.actionCard} onPress={handleNavigateToMakePicks}>
          <View>
            <Text style={homeScreenStyles.actionCardTitle}>Make Your Picks for Week {currentWeek}</Text>
            <Text style={homeScreenStyles.actionCardSubtitle}>Picks lock every Thursday at 7:15 PM CT</Text>
          </View>
          <ArrowRightIcon />
        </TouchableOpacity>

        <View style={homeScreenStyles.summaryCard}>
          <Text style={homeScreenStyles.summaryCardTitle}>Your Current Score</Text>
          {isProcessingScore ? (
            <ActivityIndicator size="small" color={PRIMARY_COLOR} />
          ) : (
            <Text style={homeScreenStyles.summaryCardScore}>{totalUserScore} pts</Text>
          )}
          <TouchableOpacity style={homeScreenStyles.linkButton} onPress={() => navigation.navigate('Leaderboard')}>
            <Text style={homeScreenStyles.linkButtonText}>View Full Leaderboard</Text>
          </TouchableOpacity>
        </View>

        {featuredMatchup ? (
          <View style={homeScreenStyles.featuredMatchupContainer}>
            <Text style={homeScreenStyles.sectionTitle}>⭐ Featured Matchup This Week</Text>
            <View style={homeScreenStyles.matchupCard}>
              <View style={homeScreenStyles.teamDisplay}>
                <View style={[homeScreenStyles.teamLogoCircle, { backgroundColor: '#007ACC' }]}>
                  <Text style={homeScreenStyles.teamLogoText}>{featuredMatchup.AwayTeamAB || 'N/A'}</Text>
                </View>
                <Text style={homeScreenStyles.teamName}>{featuredMatchup.AwayTeamName || 'Away Team'}</Text>
                <Text style={homeScreenStyles.teamProjected}>
                  {(featuredMatchup.AwayTeamProjectedPoints !== undefined ? Number(featuredMatchup.AwayTeamProjectedPoints).toFixed(1) : '0.0')} Proj.
                </Text>
              </View>
              <Text style={homeScreenStyles.vsText}>VS</Text>
              <View style={homeScreenStyles.teamDisplay}>
                <View style={[homeScreenStyles.teamLogoCircle, { backgroundColor: '#D32F2F' }]}>
                  <Text style={homeScreenStyles.teamLogoText}>{featuredMatchup.HomeTeamAB || 'N/A'}</Text>
                </View>
                <Text style={homeScreenStyles.teamName}>{featuredMatchup.HomeTeamName || 'Home Team'}</Text>
                <Text style={homeScreenStyles.teamProjected}>
                  {(featuredMatchup.HomeTeamProjectedPoints !== undefined ? Number(featuredMatchup.HomeTeamProjectedPoints).toFixed(1) : '0.0')} Proj.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          allMatchups.length > 0 && // Only show "no matchups for week" if allMatchups were loaded
            <View style={homeScreenStyles.featuredMatchupContainer}>
                <Text style={homeScreenStyles.sectionTitle}>No matchups found for Week {currentWeek}.</Text>
            </View>
        )}
      </ScrollView>
    </View>
  );
};

// Styles (homeScreenStyles) remain the same
const homeScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 15,
    paddingVertical: 15,
    paddingTop: Platform.select({ android: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 20, ios: 40, default: 20 }),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: HEADER_ICON_COLOR,
  },
  headerIconsContainer: {
    flexDirection: 'row',
  },
  headerButton: {
    paddingHorizontal: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  subHeaderText: {
    fontSize: 16,
    color: '#555555',
    marginBottom: 25,
  },
  actionCard: {
    backgroundColor: SECONDARY_COLOR,
    borderRadius: 10,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  actionCardSubtitle: {
    fontSize: 13,
    color: '#E0E0E0',
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryCardTitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 5,
  },
  summaryCardScore: {
    fontSize: 36,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginBottom: 10,
  },
  linkButton: {
    paddingVertical: 5,
  },
  linkButtonText: {
    fontSize: 14,
    color: ACCENT_COLOR,
    fontWeight: '600',
  },
  featuredMatchupContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
  },
  matchupCard: {},
  teamDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#F9F9F9',
    padding:10,
    borderRadius: 8,
  },
  teamLogoCircle: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teamLogoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#444444',
    flex: 1,
  },
  teamProjected: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  vsText: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#777777',
    marginVertical: 8,
    fontSize: 14,
  },
});

export default HomeScreen;