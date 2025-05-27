// screens/StatsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  Platform,
  StatusBar,
  ActivityIndicator,
  Dimensions, // For chart width
  RefreshControl,
  Button
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BarChart, PieChart } from 'react-native-chart-kit';
import Ionicons from 'react-native-vector-icons/Ionicons'; // For icons

// --- Configuration (Should match other screens or be centralized) ---
const GOOGLE_SHEETS_API_KEY = 'AIzaSyAKWejwstrPy1vGOwoMeuO73FoOEbpJqKw'; // User's actual key
const SPREADSHEET_ID = '1rVuE_BNO9C9M69uZnAHfD5pTI9sno9UXQI4NTDPCQLY'; // User's actual ID
const SHEET_NAME_AND_RANGE = '2025Matchups!A:M'; // Matches your latest sheet structure

// Colors
const PRIMARY_COLOR = '#1f366a';
const TEXT_COLOR_LIGHT = '#FFFFFF';
const TEXT_COLOR_DARK = '#333333';
const CARD_BACKGROUND = '#FFFFFF';
const BORDER_COLOR = '#E0E0E0';
const FOOTBALL_GREEN = '#38761D'; // Not used in this screen's main bg, but kept for consistency
const CHART_COLOR_CORRECT = '#4CAF50'; // Green for correct
const CHART_COLOR_INCORRECT = '#F44336'; // Red for incorrect
const CHART_BAR_COLOR = '#1f366a'; // Secondary color for bars

const screenWidth = Dimensions.get("window").width;

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

const StatsScreen = ({ navigation }) => {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [loggedInUserStats, setLoggedInUserStats] = useState({ correct: 0, incorrect: 0, accuracy: 0, totalPickedGames: 0 });
  const [topUsersChartData, setTopUsersChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const processStatsData = useCallback(async () => {
    setError(null);
    let currentLoggedInUser = loggedInUser; // Use state if already set
    if (!currentLoggedInUser) { // Attempt to fetch if not already in state
        try {
            const userDataString = await AsyncStorage.getItem('currentUser');
            if (userDataString) {
                currentLoggedInUser = JSON.parse(userDataString);
                setLoggedInUser(currentLoggedInUser); // Update state
            }
        } catch (e) { console.error("Error fetching current user for stats", e); }
    }

    if (!currentLoggedInUser) {
        setError("Please log in to view stats.");
        return;
    }

    let allRegisteredUsers = [];
    try {
      const usersString = await AsyncStorage.getItem('users');
      allRegisteredUsers = usersString ? JSON.parse(usersString) : [];
    } catch (e) {
      console.error("Failed to load users for stats:", e);
      setError("Could not load user data.");
      return;
    }

    let allMatchups = [];
    if (GOOGLE_SHEETS_API_KEY === 'YOUR_GOOGLE_SHEETS_API_KEY_HERE' || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
      setError('⚠️ Config Needed: Update API_KEY & SPREADSHEET_ID in StatsScreen.js');
      return;
    }
    const encodedSheetNameAndRange = encodeURIComponent(SHEET_NAME_AND_RANGE);
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedSheetNameAndRange}?key=${GOOGLE_SHEETS_API_KEY}`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to parse error response." }));
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      allMatchups = parseSheetData(jsonData);
    } catch (e) {
      console.error("Failed to fetch matchups for stats:", e);
      setError(`Failed to load game data. ${e.message}`);
      return;
    }

    if (allMatchups.length === 0) {
        console.log("No matchups data found from Google Sheet for stats.");
    }

    console.log("\n--- Calculating Stats ---");
    const allUserStatsPromises = allRegisteredUsers.map(async (user) => {
      let userPicks = [];
      if (user.username) {
        try {
          const picksString = await AsyncStorage.getItem(`userPicks_${user.username}`);
          userPicks = picksString ? JSON.parse(picksString) : [];
        } catch (e) { console.error(`Failed to load picks for user ${user.username}:`, e); }
      }

      let correct = 0;
      let incorrect = 0;
      let totalPickedGames = 0;

      allMatchups.forEach(matchup => {
        if (matchup.UniqueID && matchup.WinningTeam && String(matchup.WinningTeam).trim() !== '') {
          const userPickForGame = userPicks.find(p => p.gameUniqueID === matchup.UniqueID);
          
          if (userPickForGame) { // Only count if user made a pick for this completed game
            totalPickedGames++;

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
                    // console.warn(`Stats: WinningTeam "${winningTeamFullName}" for game ${matchup.UniqueID} did not match Home/Away names. Assuming abbreviation.`);
                }
            }

            const userPickedRaw = userPickForGame.pickedTeamAbbr;
            const userPickedAbbr = userPickedRaw ? String(userPickedRaw).trim().toUpperCase() : null;

            if (actualWinnerAbbrForComparison && userPickedAbbr === actualWinnerAbbrForComparison) {
              correct++;
            } else {
              incorrect++; // Count as incorrect if pick was made and winner is known but didn't match
            }
          }
        }
      });
      const accuracy = (correct + incorrect) > 0 ? (correct / (correct + incorrect)) * 100 : 0;
      return {
        id: user.email,
        name: user.name || user.username || 'User',
        correct,
        incorrect,
        accuracy,
        totalPickedGames
      };
    });

    const resolvedUserStats = await Promise.all(allUserStatsPromises);
    console.log("--- Finished Calculating Stats ---");

    const currentUserProcessedStats = resolvedUserStats.find(u => u.id === currentLoggedInUser.email);
    if (currentUserProcessedStats) {
      setLoggedInUserStats(currentUserProcessedStats);
    }

    const sortedByCorrect = [...resolvedUserStats].sort((a, b) => b.correct - a.correct);
    const topUsers = sortedByCorrect.slice(0, 5);

    if (topUsers.length > 0) {
      setTopUsersChartData({
        labels: topUsers.map(u => u.name.substring(0,10)),
        datasets: [{ data: topUsers.map(u => u.correct) }],
      });
    } else {
        setTopUsersChartData(null);
    }

  }, [loggedInUser, error]); // Removed error from here, handle it within the function

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      await processStatsData();
    } catch (e) {
      console.error("Error loading stats:", e);
       if(!error) setError("An unexpected error occurred while loading stats.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [processStatsData, error]); // error dependency is okay here for re-triggering if error state changes

  useEffect(() => {
    // Initial load or when loggedInUser changes (e.g., after login)
    if (loggedInUser === null) { // Try to fetch current user if not already set
        const fetchInitialUser = async () => {
            try {
                const userDataString = await AsyncStorage.getItem('currentUser');
                if (userDataString) {
                    setLoggedInUser(JSON.parse(userDataString)); // This will trigger processStatsData via its dependency
                } else {
                    setIsLoading(false); // No user, stop loading
                    setError("Please log in to view stats.");
                }
            } catch (e) {
                setIsLoading(false);
                setError("Could not load user data.");
            }
        };
        fetchInitialUser();
    } else {
        loadStats(); // If user is already known, load stats
    }
  }, [loggedInUser, loadStats]); // Added loadStats

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats();
  }, [loadStats]);

  const pieChartData = loggedInUserStats.correct + loggedInUserStats.incorrect > 0 ? [
    { name: 'Correct', population: loggedInUserStats.correct, color: CHART_COLOR_CORRECT, legendFontColor: TEXT_COLOR_DARK, legendFontSize: 14 },
    { name: 'Incorrect', population: loggedInUserStats.incorrect, color: CHART_COLOR_INCORRECT, legendFontColor: TEXT_COLOR_DARK, legendFontSize: 14 },
  ] : [];

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={{marginTop: 10, color: TEXT_COLOR_DARK}}>Loading Stats...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, {padding: 20}]}>
        <Ionicons name="alert-circle-outline" size={50} color={PRIMARY_COLOR} />
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Retry" onPress={loadStats} color={PRIMARY_COLOR}/>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>League Statistics</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{paddingBottom: 20}} // Added padding to bottom
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY_COLOR]} tintColor={PRIMARY_COLOR}/>}
      >
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>My Pick Performance</Text>
          {loggedInUser ? (
            <>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Correct Picks:</Text>
                <Text style={styles.statValue}>{loggedInUserStats.correct}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Incorrect Picks:</Text>
                <Text style={styles.statValue}>{loggedInUserStats.incorrect}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Games Picked (Completed):</Text>
                <Text style={styles.statValue}>{loggedInUserStats.totalPickedGames}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Accuracy:</Text>
                <Text style={styles.statValue}>{loggedInUserStats.accuracy.toFixed(1)}%</Text>
              </View>
              {pieChartData.length > 0 ? (
                <View style={styles.chartContainer}>
                  <PieChart
                    data={pieChartData}
                    width={screenWidth - 60}
                    height={220}
                    chartConfig={{
                      backgroundColor: '#1cc910',
                      backgroundGradientFrom: '#eff3ff',
                      backgroundGradientTo: '#efefef',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      style: { borderRadius: 16 },
                    }}
                    accessor={"population"}
                    backgroundColor={"transparent"}
                    paddingLeft={"15"}
                    absolute
                  />
                </View>
              ) : (
                <Text style={styles.noChartDataText}>Make some picks for completed games to see your chart!</Text>
              )}
            </>
          ) : (
            <Text style={styles.noChartDataText}>Login to see your stats.</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top Pickers (Correct Picks)</Text>
          {topUsersChartData && topUsersChartData.labels && topUsersChartData.labels.length > 0 ? (
            <View style={styles.chartContainer}>
              <BarChart
                data={topUsersChartData}
                width={screenWidth - 50}
                height={250}
                yAxisLabel=""
                yAxisSuffix=" picks"
                chartConfig={{
                  backgroundColor: CARD_BACKGROUND,
                  backgroundGradientFrom: CARD_BACKGROUND,
                  backgroundGradientTo: CARD_BACKGROUND,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(74, 55, 128, ${opacity})`, // PRIMARY_COLOR
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "6", strokeWidth: "2", stroke: CHART_BAR_COLOR },
                  barPercentage: 0.7,
                }}
                verticalLabelRotation={Platform.OS === 'ios' ? 0 : 30}
                fromZero={true}
                style={styles.chartStyle}
              />
            </View>
          ) : (
            <Text style={styles.noChartDataText}>Not enough data for the top pickers chart yet.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e9eef2',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  header: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 15,
    paddingVertical: 15,
    paddingTop: Platform.select({ android: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 20, ios: 40, default: 20 }),
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: TEXT_COLOR_LIGHT,
  },
  scrollView: {
    flex: 1,
  },
  sectionCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 20,
    padding: 15,
    marginVertical: 10,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginBottom: 15,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  statLabel: {
    fontSize: 16,
    color: TEXT_COLOR_DARK,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  chartStyle: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noChartDataText: {
    textAlign: 'center',
    color: '#777',
    marginTop: 10,
    fontStyle: 'italic',
  },
  errorText: {
    color: PRIMARY_COLOR,
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default StatsScreen;