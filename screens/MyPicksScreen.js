// screens/MyPicksScreen.js
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
import Ionicons from 'react-native-vector-icons/Ionicons';

// --- Configuration (Should match other screens or be centralized) ---
const GOOGLE_SHEETS_API_KEY = 'AIzaSyAKWejwstrPy1vGOwoMeuO73FoOEbpJqKw';
const SPREADSHEET_ID = '1rVuE_BNO9C9M69uZnAHfD5pTI9sno9UXQI4NTDPCQLY';
const SHEET_NAME_AND_RANGE = '2025Matchups!A:M';

// Colors
const PRIMARY_COLOR = '#1f366a';
const TEXT_COLOR_DARK = '#333333';
const TEXT_COLOR_LIGHT = '#FFFFFF';
const CORRECT_PICK_COLOR = '#4CAF50';
const INCORRECT_PICK_COLOR = '#F44336';
const PENDING_PICK_COLOR = '#FF9800';
const CARD_BACKGROUND = '#FFFFFF';
const BORDER_COLOR = '#E0E0E0';

// Helper function to parse Google Sheets API JSON response (same as other screens)
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

const MyPicksScreen = ({ navigation, route }) => {
  const initialWeek = route?.params?.week || 1;
  const [currentWeek, setCurrentWeek] = useState(initialWeek);

  const [allMatchups, setAllMatchups] = useState([]);
  const [allUserPicks, setAllUserPicks] = useState([]);
  const [displayablePicks, setDisplayablePicks] = useState([]);
  const [weeklyScore, setWeeklyScore] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('currentUser');
        if (userDataString) {
          setLoggedInUser(JSON.parse(userDataString));
        } else {
          setError("User not logged in.");
        }
      } catch (e) {
        console.error("Failed to fetch user data from storage", e);
        setError("Could not load user data.");
      }
    };
    fetchUserData();
  }, []);

  const fetchAllMatchupsFromSheet = useCallback(async () => {
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
      setError(`Failed to load game matchups. ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllMatchupsFromSheet();
  }, [fetchAllMatchupsFromSheet]);

  useEffect(() => {
    const fetchUserPicks = async () => {
      if (loggedInUser && loggedInUser.username) {
        try {
          const picksDataString = await AsyncStorage.getItem(`userPicks_${loggedInUser.username}`);
          setAllUserPicks(picksDataString ? JSON.parse(picksDataString) : []);
        } catch (e) {
          console.error("Failed to fetch user picks:", e);
          setAllUserPicks([]);
          if (!error) setError("Could not load your picks.");
        }
      } else if (loggedInUser === null && !isLoading) {
        setAllUserPicks([]);
      }
    };
    if (loggedInUser !== null) {
        fetchUserPicks();
    }
  }, [loggedInUser, isLoading, error]);


  // Process Data: Combine Matchups and Picks for the Current Week, Calculate Score
  useEffect(() => {
    if (!loggedInUser || allMatchups.length === 0) {
      setDisplayablePicks([]);
      setWeeklyScore(0);
      if (!isLoading) setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    
    const weekMatchups = allMatchups.filter(m => m.Week === currentWeek);
    let calculatedScore = 0;

    console.log(`\n--- Processing Picks for Week ${currentWeek} ---`);

    const processedPicks = weekMatchups.map(matchup => {
      const userPick = allUserPicks.find(
        p => p.gameUniqueID === matchup.UniqueID && p.week === currentWeek
      );

      let pickStatus = 'PENDING';
      let pointsAwarded = 0;
      
      const winningTeamFullNameRaw = matchup.WinningTeam;
      const winningTeamFullName = winningTeamFullNameRaw ? String(winningTeamFullNameRaw).trim() : null;
      
      let actualWinnerAbbrForComparison = null;
      if (winningTeamFullName) {
          if (String(matchup.HomeTeamName).trim() === winningTeamFullName) {
              actualWinnerAbbrForComparison = String(matchup.HomeTeamAB).trim().toUpperCase();
          } else if (String(matchup.AwayTeamName).trim() === winningTeamFullName) {
              actualWinnerAbbrForComparison = String(matchup.AwayTeamAB).trim().toUpperCase();
          } else {
              // This case means WinningTeam column might contain an abbreviation or unexpected name
              // For robustness, we can assume it might be an abbreviation if not a full name match
              actualWinnerAbbrForComparison = winningTeamFullName.toUpperCase();
              console.warn(`WinningTeam "${winningTeamFullName}" for game ${matchup.UniqueID} did not match Home/Away full names. Assuming it's an abbreviation.`);
          }
      }
      
      const userPickedRaw = userPick ? userPick.pickedTeamAbbr : null;
      const userPickedAbbr = userPickedRaw ? String(userPickedRaw).trim().toUpperCase() : null;

      console.log(
        `Game ID: ${matchup.UniqueID} | ` +
        `User Pick (Abbr): '${userPickedAbbr}' | ` +
        `WinningTeam from Sheet (Full Name/Raw): '${winningTeamFullNameRaw}' | `+
        `Derived Winner Abbr for Comparison: '${actualWinnerAbbrForComparison}'`
      );

      if (!userPick) {
        pickStatus = 'NO_PICK';
        console.log(` -> Status: NO_PICK`);
      } else if (actualWinnerAbbrForComparison && actualWinnerAbbrForComparison !== '') {
        if (userPickedAbbr === actualWinnerAbbrForComparison) {
          pickStatus = 'CORRECT';
          pointsAwarded = 1;
          calculatedScore += pointsAwarded;
          console.log(` -> Status: CORRECT! (+${pointsAwarded} pt)`);
        } else {
          pickStatus = 'INCORRECT';
          console.log(` -> Status: INCORRECT (User: ${userPickedAbbr}, Winner: ${actualWinnerAbbrForComparison})`);
        }
      } else {
        console.log(` -> Status: PENDING (No actual winner determined yet or user did not pick)`);
      }
      
      return {
        ...matchup,
        userPickedTeamAbbr: userPick ? userPick.pickedTeamAbbr : null,
        pickStatus,
        pointsAwarded,
      };
    });
    console.log(`--- Finished Processing Week ${currentWeek}, Score: ${calculatedScore} ---`);

    setDisplayablePicks(processedPicks);
    setWeeklyScore(calculatedScore);
    setIsProcessing(false);

  }, [currentWeek, allMatchups, allUserPicks, loggedInUser]);


  if (isLoading) { 
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={{marginTop: 10}}>Loading Game Data...</Text>
      </View>
    );
  }
  
  if (error && displayablePicks.length === 0) {
    return (
      <View style={[styles.container, styles.centered, {padding: 20}]}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Retry" onPress={fetchAllMatchupsFromSheet} color={PRIMARY_COLOR}/>
      </View>
    );
  }
  
  if (isProcessing && displayablePicks.length === 0 && currentWeekMatchups.length > 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={{marginTop: 10}}>Calculating picks...</Text>
      </View>
    );
  }

  const renderPickStatusIcon = (status) => {
    switch (status) {
      case 'CORRECT':
        return <Ionicons name="checkmark-circle" size={24} color={CORRECT_PICK_COLOR} />;
      case 'INCORRECT':
        return <Ionicons name="close-circle" size={24} color={INCORRECT_PICK_COLOR} />;
      case 'PENDING':
        return <Ionicons name="hourglass-outline" size={22} color={PENDING_PICK_COLOR} />;
      case 'NO_PICK':
        return <Text style={styles.noPickText}>-</Text>; 
      default:
        return null;
    }
  };
  
  const getTeamFullName = (teamAbbrOrName, matchup) => {
      if (!teamAbbrOrName || !matchup) return teamAbbrOrName || 'N/A';
      const term = String(teamAbbrOrName).trim();
      // Check if it's an abbreviation first
      if (String(matchup.HomeTeamAB).trim().toUpperCase() === term.toUpperCase()) return matchup.HomeTeamName || term;
      if (String(matchup.AwayTeamAB).trim().toUpperCase() === term.toUpperCase()) return matchup.AwayTeamName || term;
      // Check if it's already a full name
      if (String(matchup.HomeTeamName).trim() === term) return term;
      if (String(matchup.AwayTeamName).trim() === term) return term;
      return term; // Fallback
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Picks - Week {currentWeek}</Text>
      </View>

      <View style={styles.weekNavigation}>
        <Button title="⬅️ Prev Week" onPress={() => setCurrentWeek(Math.max(1, currentWeek - 1))} disabled={currentWeek === 1 || isLoading || isProcessing} />
        <Text style={styles.weekIndicatorText}>Week {currentWeek}</Text>
        <Button title="Next Week ➡️" onPress={() => setCurrentWeek(currentWeek + 1)} disabled={isLoading || isProcessing} />
      </View>

      <View style={styles.scoreSummary}>
        <Text style={styles.scoreText}>Week {currentWeek} Score: {weeklyScore} pts</Text>
      </View>

      {displayablePicks.length === 0 && !isProcessing && !error ? ( 
        <View style={styles.centered}>
            <Text style={styles.noMatchupsText}>No picks or matchups found for Week {currentWeek}.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          {displayablePicks.map((item) => {
            const pickedTeamFullName = getTeamFullName(item.userPickedTeamAbbr, item);
            const winningTeamFullName = getTeamFullName(item.WinningTeam, item); // WinningTeam from sheet might be full name or abbr

            return (
              <View key={item.UniqueID} style={styles.pickCard}>
                <View style={styles.matchupInfo}>
                  <View style={styles.teamRow}>
                    {item.AwayTeamLogo && <Image source={{uri: item.AwayTeamLogo}} style={styles.teamLogo}/>}
                    <Text style={styles.teamNameText}>{item.AwayTeamName || 'Away Team'} ({item.AwayTeamAB})</Text>
                  </View>
                  <Text style={styles.vsTextSmall}>vs</Text>
                  <View style={styles.teamRow}>
                    {item.HomeTeamLogo && <Image source={{uri: item.HomeTeamLogo}} style={styles.teamLogo}/>}
                    <Text style={styles.teamNameText}>{item.HomeTeamName || 'Home Team'} ({item.HomeTeamAB})</Text>
                  </View>
                </View>

                <View style={styles.pickDetails}>
                  <Text style={styles.detailTitle}>Your Pick:</Text>
                  <Text style={[
                      styles.detailValue,
                      item.pickStatus === 'CORRECT' && styles.correctText,
                      item.pickStatus === 'INCORRECT' && styles.incorrectText,
                  ]}>
                      {item.userPickedTeamAbbr ? pickedTeamFullName : 'No Pick'}
                  </Text>
                </View>

                <View style={styles.pickDetails}>
                  <Text style={styles.detailTitle}>Result:</Text>
                  <Text style={styles.detailValue}>
                      {item.WinningTeam ? winningTeamFullName : 'Pending'}
                  </Text>
                </View>

                <View style={styles.pickStatusRow}>
                  {renderPickStatusIcon(item.pickStatus)}
                  <Text style={[
                      styles.statusText,
                      item.pickStatus === 'CORRECT' && styles.correctText,
                      item.pickStatus === 'INCORRECT' && styles.incorrectText,
                      item.pickStatus === 'PENDING' && styles.pendingText,
                  ]}>
                      {item.pickStatus.replace('_', ' ')}
                      {item.pickStatus === 'CORRECT' && ` (+${item.pointsAwarded} pt)`}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

// Styles remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    color: TEXT_COLOR_LIGHT,
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#e0e0e0',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  weekIndicatorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  scoreSummary: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#CFD8DC', 
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  scrollView: {
    flex: 1,
  },
  pickCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 20,
    padding: 15,
    marginVertical: 8,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  matchupInfo: {
    marginBottom: 10,
    alignItems: 'center',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  teamLogo: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 8,
    resizeMode: 'contain',
  },
  teamNameText: {
    fontSize: 16,
    fontWeight: '500',
    color: TEXT_COLOR_DARK,
  },
  vsTextSmall: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#777',
    marginVertical: 2,
  },
  pickDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    marginTop: 5,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR_DARK,
  },
  detailValue: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '500',
    flexShrink: 1, 
    textAlign: 'right', 
    marginLeft: 5, 
  },
  pickStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  noPickText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#777',
  },
  correctText: {
    color: CORRECT_PICK_COLOR,
  },
  incorrectText: {
    color: INCORRECT_PICK_COLOR,
  },
  pendingText: {
    color: PENDING_PICK_COLOR,
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

export default MyPicksScreen;