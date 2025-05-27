// screens/LeaderboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  Platform,
  StatusBar,
  ActivityIndicator,
  Image, // Keep Image if you might use user-uploaded avatars later
  RefreshControl,
  Button
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
const GOLD_COLOR = '#FFD700';
const SILVER_COLOR = '#C0C0C0';
const BRONZE_COLOR = '#CD7F32';
const FOOTBALL_GREEN = 'white';

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

const LeaderboardScreen = ({ navigation }) => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const calculateScoresAndBuildLeaderboard = useCallback(async () => {
    setError(null);
    let allUsers = [];
    try {
      const usersString = await AsyncStorage.getItem('users');
      allUsers = usersString ? JSON.parse(usersString) : [];
    } catch (e) {
      console.error("Failed to load users for leaderboard:", e);
      setError("Could not load user data.");
      return [];
    }

    if (allUsers.length === 0) {
      console.log("No registered users found for leaderboard.");
      return [];
    }

    let allMatchups = [];
    if (GOOGLE_SHEETS_API_KEY === 'YOUR_GOOGLE_SHEETS_API_KEY_HERE' || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
      setError('⚠️ Config Needed: Update API_KEY & SPREADSHEET_ID in LeaderboardScreen.js');
      return [];
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
      console.error("Failed to fetch matchups for leaderboard:", e);
      setError(`Failed to load game data. ${e.message}`);
      return [];
    }

    if (allMatchups.length === 0) {
        console.log("No matchups data found from Google Sheet for leaderboard.");
    }

    console.log("\n--- Calculating Scores for Leaderboard ---");
    const userScoresPromises = allUsers.map(async (user) => {
      let userPicks = [];
      if (user.username) {
        try {
          const picksString = await AsyncStorage.getItem(`userPicks_${user.username}`);
          userPicks = picksString ? JSON.parse(picksString) : [];
        } catch (e) {
          console.error(`Failed to load picks for user ${user.username}:`, e);
        }
      }

      let score = 0;
      allMatchups.forEach(matchup => {
        // Only score games that have a result and a UniqueID
        if (matchup.UniqueID && matchup.WinningTeam && String(matchup.WinningTeam).trim() !== '') {
          const userPickForGame = userPicks.find(pick => pick.gameUniqueID === matchup.UniqueID);

          const winningTeamFullNameRaw = matchup.WinningTeam;
          const winningTeamFullName = winningTeamFullNameRaw ? String(winningTeamFullNameRaw).trim() : null;
          
          let actualWinnerAbbrForComparison = null;
          if (winningTeamFullName) {
              if (String(matchup.HomeTeamName).trim() === winningTeamFullName) {
                  actualWinnerAbbrForComparison = String(matchup.HomeTeamAB).trim().toUpperCase();
              } else if (String(matchup.AwayTeamName).trim() === winningTeamFullName) {
                  actualWinnerAbbrForComparison = String(matchup.AwayTeamAB).trim().toUpperCase();
              } else {
                  // Fallback: Assume WinningTeam column might contain an abbreviation
                  actualWinnerAbbrForComparison = winningTeamFullName.toUpperCase();
                  // Optional: Add a warning if this fallback is used often, as it might indicate inconsistent data entry
                  // console.warn(`Leaderboard: WinningTeam "${winningTeamFullName}" for game ${matchup.UniqueID} did not match Home/Away full names. Assuming it's an abbreviation.`);
              }
          }

          const userPickedRaw = userPickForGame ? userPickForGame.pickedTeamAbbr : null;
          const userPickedAbbr = userPickedRaw ? String(userPickedRaw).trim().toUpperCase() : null;

          // Debug log for each game being scored for each user
          // console.log(
          //   `User: ${user.username}, Game: ${matchup.UniqueID}, Pick: '${userPickedAbbr}', WinnerSheet: '${winningTeamFullNameRaw}', WinnerAB_Compare: '${actualWinnerAbbrForComparison}'`
          // );

          if (userPickForGame && actualWinnerAbbrForComparison && userPickedAbbr === actualWinnerAbbrForComparison) {
            score++;
          }
        }
      });
      return {
        id: user.email,
        name: user.name || user.username || 'Unnamed User',
        score: score,
      };
    });

    const resolvedUserScores = await Promise.all(userScoresPromises);
    console.log("--- Finished Calculating Scores ---");

    const sortedLeaderboard = resolvedUserScores.sort((a, b) => {
      if (b.score === a.score) {
        return a.name.localeCompare(b.name);
      }
      return b.score - a.score;
    });

    return sortedLeaderboard.map((user, index) => ({
      ...user,
      rank: index + 1,
    }));
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await calculateScoresAndBuildLeaderboard();
      setLeaderboardData(data);
    } catch (e) {
      console.error("Error loading leaderboard:", e);
      if(!error) setError("An unexpected error occurred while building the leaderboard.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [calculateScoresAndBuildLeaderboard, error]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLeaderboard();
  }, [loadLeaderboard]);

  const getRankStyle = (rank) => {
    if (rank === 1) return styles.rankGold;
    if (rank === 2) return styles.rankSilver;
    if (rank === 3) return styles.rankBronze;
    return null;
  };

  const renderRankIcon = (rank) => {
    if (rank === 1) return <Ionicons name="trophy" size={24} color={GOLD_COLOR} style={styles.rankIcon} />;
    if (rank === 2) return <Ionicons name="trophy" size={22} color={SILVER_COLOR} style={styles.rankIcon} />;
    if (rank === 3) return <Ionicons name="trophy" size={20} color={BRONZE_COLOR} style={styles.rankIcon} />;
    return <Text style={styles.rankNumber}>{rank}</Text>;
  };


  if (isLoading && leaderboardData.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={TEXT_COLOR_LIGHT} />
        <Text style={{marginTop: 10, color: TEXT_COLOR_LIGHT}}>Building Leaderboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, {padding: 20}]}>
        <Ionicons name="alert-circle-outline" size={50} color={TEXT_COLOR_LIGHT} />
        <Text style={styles.errorTextOnGreen}>{error}</Text>
        <Button title="Retry" onPress={loadLeaderboard} color={PRIMARY_COLOR}/>
      </View>
    );
  }

  if (leaderboardData.length === 0 && !isLoading) {
    return (
         <View style={[styles.container, styles.centered]}>
            <Ionicons name="people-outline" size={50} color={TEXT_COLOR_LIGHT} />
            <Text style={styles.noDataTextOnGreen}>No leaderboard data available yet.</Text>
            <Text style={styles.noDataSubTextOnGreen}>Make some picks and check back after games are played!</Text>
            <Button title="Refresh" onPress={onRefresh} color={PRIMARY_COLOR}/>
        </View>
    );
  }


  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>League Leaderboard</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY_COLOR]} tintColor={PRIMARY_COLOR} />}
      >
        {leaderboardData.map((userEntry) => (
          <View key={userEntry.id} style={[styles.entryCard, getRankStyle(userEntry.rank)]}>
            <View style={styles.rankContainer}>
              {renderRankIcon(userEntry.rank)}
            </View>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="american-football-outline" size={30} color={PRIMARY_COLOR} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userEntry.name}</Text>
              <Text style={styles.userScore}>{userEntry.score} Correct Picks</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FOOTBALL_GREEN,
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
    borderBottomWidth: 2,
    borderBottomColor: '#00000020'
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: TEXT_COLOR_LIGHT,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-CondensedBold' : 'sans-serif-condensed',
  },
  scrollView: {
    flex: 1,
  },
  entryCard: {
    backgroundColor: CARD_BACKGROUND,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginVertical: 5,
    marginHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
    marginRight: 10,
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  rankIcon: {
  },
  rankGold: { borderColor: GOLD_COLOR, borderWidth: 2, backgroundColor: '#FFFDE7' },
  rankSilver: { borderColor: SILVER_COLOR, borderWidth: 2, backgroundColor: '#F5F5F5'},
  rankBronze: { borderColor: BRONZE_COLOR, borderWidth: 2, backgroundColor: '#FFF3E0'},
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: TEXT_COLOR_DARK,
    marginBottom: 3,
  },
  userScore: {
    fontSize: 15,
    color: '#555',
  },
  errorTextOnGreen: {
    color: TEXT_COLOR_LIGHT,
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 16,
    fontWeight: '500',
  },
  noDataTextOnGreen: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR_LIGHT,
    textAlign: 'center',
    marginBottom: 10,
  },
  noDataSubTextOnGreen: {
    fontSize: 14,
    color: '#DDDDDD',
    textAlign: 'center',
  }
});

export default LeaderboardScreen;