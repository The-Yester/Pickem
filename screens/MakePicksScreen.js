import React, { useState, useEffect, useCallback } from 'react';
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
  Button,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GOOGLE_SHEETS_API_KEY = 'AIzaSyAKWejwstrPy1vGOwoMeuO73FoOEbpJqKw';
const SPREADSHEET_ID = '1rVuE_BNO9C9M69uZnAHfD5pTI9sno9UXQI4NTDPCQLY';
const SHEET_NAME_AND_RANGE = '2025Matchups!A:M';

const PRIMARY_COLOR = '#1f366a';
const SECONDARY_COLOR = '#6E58A8'; // Not used in current MakePicksScreen styles, but kept for consistency
const ACCENT_COLOR = '#FF9800'; // Not used in current MakePicksScreen styles
const SELECTED_PICK_COLOR = '#4CAF50';
const UNSELECTED_PICK_COLOR = '#FFFFFF';
const TEXT_ON_SELECTED_COLOR = '#FFFFFF';
const TEXT_ON_UNSELECTED_COLOR = '#333333';
const PROJECTION_TEXT_COLOR = '#555555';

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
      if (value.toUpperCase() === 'TRUE') {
        entry[header] = true;
      } else if (value.toUpperCase() === 'FALSE') {
        entry[header] = false;
      } else if (!isNaN(Number(value)) && value !== '') {
        entry[header] = Number(value);
      } else {
        entry[header] = value;
      }
    });
    return entry;
  });
};

const MakePicksScreen = ({ navigation, route }) => {
  const initialWeek = route?.params?.week || 1;
  const [currentWeek, setCurrentWeek] = useState(initialWeek);

  const [allMatchups, setAllMatchups] = useState([]);
  const [currentWeekMatchups, setCurrentWeekMatchups] = useState([]);
  const [currentPicks, setCurrentPicks] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('currentUser');
        if (userDataString) {
          setLoggedInUser(JSON.parse(userDataString));
        }
      } catch (e) {
        console.error("Failed to fetch user data from storage", e);
      }
    };
    fetchUserData();
  }, []);

  const loadPicksForWeek = useCallback(async (week, user) => {
    if (user && user.username) {
      try {
        const allUserPicksString = await AsyncStorage.getItem(`userPicks_${user.username}`);
        const allUserPicks = allUserPicksString ? JSON.parse(allUserPicksString) : [];
        const picksForThisWeek = {};
        allUserPicks
          .filter(pick => pick.week === week)
          .forEach(pick => {
            picksForThisWeek[pick.gameUniqueID] = pick.pickedTeamAbbr;
          });
        setCurrentPicks(picksForThisWeek);
      } catch (e) {
        console.error(`Failed to load picks for week ${week}:`, e);
        setCurrentPicks({});
      }
    } else {
      setCurrentPicks({});
    }
  }, []);

  const fetchAllMatchupsFromSheet = async () => {
    if (GOOGLE_SHEETS_API_KEY === 'YOUR_GOOGLE_SHEETS_API_KEY_HERE' || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
      setError('⚠️ Configuration Needed: Please update API_KEY and SPREADSHEET_ID.');
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
      console.error("Failed to fetch or parse all matchups:", e);
      setError(`Failed to load matchups. ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMatchupsFromSheet();
  }, []);

  useEffect(() => {
    if (allMatchups.length > 0) {
      const filtered = allMatchups.filter(m => m.Week === currentWeek);
      setCurrentWeekMatchups(filtered);
      if (loggedInUser) {
        loadPicksForWeek(currentWeek, loggedInUser);
      }
    } else {
      setCurrentWeekMatchups([]);
    }
  }, [allMatchups, currentWeek, loggedInUser, loadPicksForWeek]);

  const handlePickSelection = (gameUniqueID, pickedTeamAbbr) => {
    setCurrentPicks(prevPicks => ({
      ...prevPicks,
      [gameUniqueID]: pickedTeamAbbr,
    }));
  };

  const handleSavePicks = async () => {
    if (!loggedInUser || !loggedInUser.username) {
      Alert.alert("Error", "You must be logged in to save picks.");
      return;
    }
    if (Object.keys(currentPicks).length === 0 && currentWeekMatchups.length > 0) {
        Alert.alert("No Picks Made", "You haven't made any picks for this week.");
        return;
    }
    try {
      const allUserPicksString = await AsyncStorage.getItem(`userPicks_${loggedInUser.username}`);
      let allUserPicks = allUserPicksString ? JSON.parse(allUserPicksString) : [];
      allUserPicks = allUserPicks.filter(pick => pick.week !== currentWeek);
      currentWeekMatchups.forEach(matchup => {
        // Only save picks for games that were part of currentWeekMatchups and had a pick made
        if (currentPicks[matchup.UniqueID]) {
          allUserPicks.push({
            gameUniqueID: matchup.UniqueID,
            pickedTeamAbbr: currentPicks[matchup.UniqueID],
            week: currentWeek,
          });
        }
      });
      await AsyncStorage.setItem(`userPicks_${loggedInUser.username}`, JSON.stringify(allUserPicks));
      Alert.alert("Picks Saved!", `Your picks for Week ${currentWeek} have been saved.`);
    } catch (e) {
      console.error("Failed to save picks:", e);
      Alert.alert("Error", "Could not save your picks. Please try again.");
    }
  };

  if (isLoading && allMatchups.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={{marginTop: 10}}>Loading matchups...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, {padding: 20}]}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Retry Fetch" onPress={fetchAllMatchupsFromSheet} color={PRIMARY_COLOR}/>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Make Your Picks - Week {currentWeek}</Text>
      </View>

      <View style={styles.weekNavigation}>
        <Button title="⬅️ Prev Week" onPress={() => setCurrentWeek(Math.max(1, currentWeek - 1))} disabled={currentWeek === 1} />
        <Text style={styles.weekIndicatorText}>Week {currentWeek}</Text>
        <Button title="Next Week ➡️" onPress={() => setCurrentWeek(currentWeek + 1)} /> {/* Consider max week */}
      </View>

      {currentWeekMatchups.length === 0 && !isLoading ? (
        <View style={styles.centered}>
            <Text style={styles.noMatchupsText}>No matchups found for Week {currentWeek}.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          {currentWeekMatchups.map((matchup) => (
            <View key={matchup.UniqueID} style={styles.matchupCard}>
              <Text style={styles.gameDateTime}>
                {matchup.GameDate} at {matchup.GameTimeET || ` Week ${currentWeek}`}
              </Text>
              <View style={styles.teamsContainer}>
                {/* Away Team */}
                <TouchableOpacity
                  style={[
                    styles.teamButton,
                    currentPicks[matchup.UniqueID] === matchup.AwayTeamAB && styles.selectedTeamButton
                  ]}
                  onPress={() => handlePickSelection(matchup.UniqueID, matchup.AwayTeamAB)}
                >
                  <Text style={[
                      styles.teamName, // Centered team name
                      currentPicks[matchup.UniqueID] === matchup.AwayTeamAB && styles.selectedTeamText
                    ]}>
                    {matchup.AwayTeamName || 'Away Team'}
                  </Text>
                  <View style={styles.detailsRow}>
                    <Text style={[
                        styles.teamProjection,
                        currentPicks[matchup.UniqueID] === matchup.AwayTeamAB && styles.selectedTeamTextDetail
                        ]}>
                        Proj: {(matchup.AwayTeamProjectedPoints !== undefined ? Number(matchup.AwayTeamProjectedPoints).toFixed(1) : '0.0')}
                    </Text>
                    {matchup.AwayTeamLogo && (
                      <Image source={{ uri: matchup.AwayTeamLogo }} style={styles.teamLogo} onError={(e) => console.log("Failed to load AwayTeamLogo:", e.nativeEvent.error, matchup.AwayTeamLogo)} />
                    )}
                  </View>
                </TouchableOpacity>

                <Text style={styles.vsText}>VS</Text>

                {/* Home Team */}
                <TouchableOpacity
                  style={[
                    styles.teamButton,
                    currentPicks[matchup.UniqueID] === matchup.HomeTeamAB && styles.selectedTeamButton
                  ]}
                  onPress={() => handlePickSelection(matchup.UniqueID, matchup.HomeTeamAB)}
                >
                  <Text style={[
                      styles.teamName, // Centered team name
                      currentPicks[matchup.UniqueID] === matchup.HomeTeamAB && styles.selectedTeamText
                    ]}>
                    {matchup.HomeTeamName || 'Home Team'}
                  </Text>
                  <View style={styles.detailsRow}>
                    <Text style={[
                        styles.teamProjection,
                        currentPicks[matchup.UniqueID] === matchup.HomeTeamAB && styles.selectedTeamTextDetail
                        ]}>
                        Proj: {(matchup.HomeTeamProjectedPoints !== undefined ? Number(matchup.HomeTeamProjectedPoints).toFixed(1) : '0.0')}
                    </Text>
                     {matchup.HomeTeamLogo && (
                      <Image source={{ uri: matchup.HomeTeamLogo }} style={styles.teamLogo} onError={(e) => console.log("Failed to load HomeTeamLogo:", e.nativeEvent.error, matchup.HomeTeamLogo)} />
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {currentWeekMatchups.length > 0 && (
            <View style={styles.saveButtonContainer}>
                <Button title="Save Picks for Week" onPress={handleSavePicks} color={PRIMARY_COLOR} />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 15,
    paddingVertical: 15,
    paddingTop: Platform.select({ android: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 20, ios: 40, default: 20 }),
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#e0e0e0',
    borderBottomWidth: 1,
    borderBottomColor: '#c0c0c0',
  },
  weekIndicatorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  scrollView: {
    flex: 1,
  },
  matchupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10, 
    paddingHorizontal: 15, 
    marginVertical: 8,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  gameDateTime: {
    fontSize: 12,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 10,
  },
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start', 
  },
  teamButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 5, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    backgroundColor: UNSELECTED_PICK_COLOR,
    marginHorizontal: 5,
    alignItems: 'center', 
  },
  selectedTeamButton: {
    backgroundColor: SELECTED_PICK_COLOR,
    borderColor: SELECTED_PICK_COLOR,
  },
  teamName: { 
    fontSize: 18,
    fontWeight: 'bold', 
    color: TEXT_ON_UNSELECTED_COLOR,
    textAlign: 'center', 
    marginBottom: 8, 
    width: '100%', 
  },
  selectedTeamText: { 
    color: TEXT_ON_SELECTED_COLOR,
  },
  selectedTeamTextDetail: { 
    color: TEXT_ON_SELECTED_COLOR, 
  },
  detailsRow: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%', 
    paddingHorizontal: 5, 
  },
  teamProjection: {
    fontSize: 14,
    color: PROJECTION_TEXT_COLOR,
  },
  teamLogo: {
    width: 60, 
    height: 60, 
    borderRadius: 30, // Half of width/height to make it circular
    resizeMode: 'contain',
    // overflow: 'hidden', // Optional: ensures content clips to the border radius
  },
  vsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#777777',
    marginHorizontal: 5,
    alignSelf: 'center', 
    paddingTop: 20, 
  },
  saveButtonContainer: {
    margin: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 16,
  },
  noMatchupsText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 20,
  }
});

export default MakePicksScreen;