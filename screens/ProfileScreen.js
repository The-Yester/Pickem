// screens/ProfileScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  Platform,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  ActivityIndicator,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';

// Colors
const PRIMARY_COLOR = '#1f366a';
const TEXT_COLOR_LIGHT = '#FFFFFF';
const TEXT_COLOR_DARK = '#333333';
const CARD_BACKGROUND_LIGHT = '#F0F4F7';
const CARD_BACKGROUND_DARK = '#E8EAF6';
const BORDER_COLOR = '#B0BEC5';
const MYSPACE_BLUE_ACCENT = '#3B5998';
const MYSPACE_PINK_ACCENT = '#FF69B4';
const INPUT_BACKGROUND = '#FFFFFF';

// --- Configuration for Google Sheets API (needed for stats calculation) ---
const GOOGLE_SHEETS_API_KEY = 'AIzaSyAKWejwstrPy1vGOwoMeuO73FoOEbpJqKw';
const SPREADSHEET_ID = '1rVuE_BNO9C9M69uZnAHfD5pTI9sno9UXQI4NTDPCQLY';
const SHEET_NAME_AND_RANGE = '2025Matchups!A:M';

const { width } = Dimensions.get('window');
const MAX_BIO_LENGTH = 120;

// --- Mood Options ---
const MOOD_OPTIONS = [
  { id: 'ready', emoji: '🏈', text: 'Ready for Kickoff!' },
  { id: 'excited', emoji: '🎉', text: 'Excited for the games!' },
  { id: 'nervous', emoji: '😬', text: 'Nervous about my picks...' },
  { id: 'confident', emoji: '😎', text: 'Feeling confident!' },
  { id: 'studying', emoji: '🤔', text: 'Analyzing matchups...' },
  { id: 'celebrating', emoji: '🥳', text: 'Celebrating a W!' },
  { id: 'chill', emoji: '😌', text: 'Just chillin\'' },
  { id: 'focused', emoji: '🎯', text: 'Focused on the win.' },
  { id: 'superstitious', emoji: '🧦', text: 'Wearing my lucky socks!' },
  { id: 'anxious', emoji: '😰', text: 'This could go either way...' },
  { id: 'pumped', emoji: '💪', text: 'Pumped for the action!' },
  { id: 'chill', emoji: '😌', text: 'Just here for the vibes.' }, // Note: Duplicate 'chill' id, ideally ids are unique
  { id: 'competitive', emoji: '🥇', text: 'I’m in it to win it.' },
  { id: 'skeptical', emoji: '🤨', text: 'Not sure about these matchups...' }
];
const DEFAULT_MOOD = MOOD_OPTIONS[0];


// Helper function to parse Google Sheets API JSON response
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


const ProfileScreen = ({ navigation }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true); // For initial profile details

  const [aboutMeText, setAboutMeText] = useState('');
  const [isEditingAboutMe, setIsEditingAboutMe] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState(null);
  const [currentMood, setCurrentMood] = useState(DEFAULT_MOOD);
  const [isEditingMood, setIsEditingMood] = useState(false);

  const [leagueMates, setLeagueMates] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  // For Pick Stats
  const [allMatchups, setAllMatchups] = useState([]);
  const [allUserPicks, setAllUserPicks] = useState(null); 
  const [userStats, setUserStats] = useState({ totalPicksMade: 0, correctPicks: 0, incorrectPicks: 0, accuracy: 0, gamesGraded: 0 });
  const [isLoadingStatsData, setIsLoadingStatsData] = useState(true); 

  const loadProfileData = useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      const userString = await AsyncStorage.getItem('currentUser');
      if (!userString) {
        Alert.alert("Error", "User not found. Please log in again.");
        setIsLoadingProfile(false); return;
      }
      const user = JSON.parse(userString);
      setCurrentUser(user);

      if (user && user.username) {
        const savedAboutMe = await AsyncStorage.getItem(`profile_${user.username}_aboutMe`);
        setAboutMeText(savedAboutMe || "Tell everyone a little about yourself!");
        const savedImageUri = await AsyncStorage.getItem(`profile_${user.username}_imageUri`);
        if (savedImageUri) setProfileImageUri(savedImageUri);
        const savedMoodId = await AsyncStorage.getItem(`profile_${user.username}_moodId`);
        const foundMood = MOOD_OPTIONS.find(mood => mood.id === savedMoodId);
        setCurrentMood(foundMood || DEFAULT_MOOD);
        const savedCommentsString = await AsyncStorage.getItem(`profile_${user.username}_comments`);
        setComments(savedCommentsString ? JSON.parse(savedCommentsString) : []);
      }
      const allUsersString = await AsyncStorage.getItem('users');
      if (allUsersString && user && user.username) {
        const allUsers = JSON.parse(allUsersString);
        setLeagueMates(allUsers.filter(u => u.username !== user.username));
      }
    } catch (e) { console.error("Failed to load initial profile data:", e); Alert.alert("Error", "Could not load profile data.");
    } finally { setIsLoadingProfile(false); }
  }, []);

  useEffect(() => { loadProfileData(); }, [loadProfileData]);

  const fetchAllMatchupsFromSheet = useCallback(async () => {
    if (GOOGLE_SHEETS_API_KEY === 'YOUR_GOOGLE_SHEETS_API_KEY_HERE' || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
      console.warn('ProfileScreen: Update API_KEY and SPREADSHEET_ID for matchups.');
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
      return parseSheetData(jsonData);
    } catch (e) {
      console.error("ProfileScreen: Failed to fetch matchups for stats:", e);
      return []; 
    }
  }, []);

  const fetchUserPicksForStats = useCallback(async (user) => {
    if (user && user.username) {
      try {
        const picksDataString = await AsyncStorage.getItem(`userPicks_${user.username}`);
        return picksDataString ? JSON.parse(picksDataString) : [];
      } catch (e) {
        console.error("ProfileScreen: Failed to fetch user picks for stats:", e);
        return [];
      }
    }
    return [];
  }, []);

  useEffect(() => {
    const loadStatsRelatedData = async () => {
        if (!currentUser) return; 
        setIsLoadingStatsData(true);
        const matchupsData = await fetchAllMatchupsFromSheet();
        const userPicksData = await fetchUserPicksForStats(currentUser);
        setAllMatchups(matchupsData);
        setAllUserPicks(userPicksData);
        // setIsLoadingStatsData(false); // Calculation useEffect will handle this
    };
    if(currentUser) { // Only load if currentUser is available
        loadStatsRelatedData();
    }
  }, [currentUser, fetchAllMatchupsFromSheet, fetchUserPicksForStats]);


  useEffect(() => {
    if (!currentUser || allMatchups.length === 0 || allUserPicks === null ) {
      setUserStats({ totalPicksMade: 0, correctPicks: 0, incorrectPicks: 0, accuracy: 0, gamesGraded: 0 });
      if(!isLoadingProfile && !isLoadingStatsData && allUserPicks !== null) { // Only set if all initial loads are done
         setIsLoadingStatsData(false); // Ensure stats loading is false if we can't proceed
      }
      return;
    }
    
    const userPicksToProcess = Array.isArray(allUserPicks) ? allUserPicks : [];
    // console.log("ProfileScreen: Calculating stats. AllMatchups:", allMatchups.length, "AllUserPicks:", userPicksToProcess.length);
    
    let correct = 0;
    let incorrect = 0;
    let totalPickedAndCompleted = 0; 

    allMatchups.forEach(matchup => {
      if (matchup.UniqueID && matchup.WinningTeam && String(matchup.WinningTeam).trim() !== '') { 
        const userPickForGame = userPicksToProcess.find(pick => pick.gameUniqueID === matchup.UniqueID);
        if (userPickForGame) { 
          totalPickedAndCompleted++;
          const winningTeamFullNameRaw = matchup.WinningTeam;
          const winningTeamFullName = winningTeamFullNameRaw ? String(winningTeamFullNameRaw).trim() : null;
          let actualWinnerAbbrForComparison = null;
          if (winningTeamFullName) {
              if (String(matchup.HomeTeamName || '').trim() === winningTeamFullName) {
                  actualWinnerAbbrForComparison = String(matchup.HomeTeamAB || '').trim().toUpperCase();
              } else if (String(matchup.AwayTeamName || '').trim() === winningTeamFullName) {
                  actualWinnerAbbrForComparison = String(matchup.AwayTeamAB || '').trim().toUpperCase();
              } else {
                  actualWinnerAbbrForComparison = winningTeamFullName.toUpperCase();
              }
          }
          const userPickedRaw = userPickForGame.pickedTeamAbbr;
          const userPickedAbbr = userPickedRaw ? String(userPickedRaw).trim().toUpperCase() : null;
          // console.log( /* ... debugging log ... */ );
          if (actualWinnerAbbrForComparison && userPickedAbbr === actualWinnerAbbrForComparison) {
            correct++;
          } else {
            incorrect++;
          }
        }
      }
    });
    const accuracy = totalPickedAndCompleted > 0 ? (correct / totalPickedAndCompleted) * 100 : 0;
    setUserStats({
        totalPicksMade: userPicksToProcess.length, 
        correctPicks: correct,
        incorrectPicks: incorrect,
        accuracy: accuracy,
        gamesGraded: totalPickedAndCompleted
    });
    setIsLoadingStatsData(false); // Stats calculation finished
  }, [currentUser, allMatchups, allUserPicks, isLoadingProfile]); // Added isLoadingProfile to ensure it runs after initial data load is complete


  const handlePickImage = async () => {
    if (!currentUser || !currentUser.username) return;
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to your photos to set a profile picture.");
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5,
    });
    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      const imageUri = pickerResult.assets[0].uri;
      setProfileImageUri(imageUri);
      try { await AsyncStorage.setItem(`profile_${currentUser.username}_imageUri`, imageUri); }
      catch (e) { console.error("Failed to save profile image URI:", e); Alert.alert("Error", "Could not save profile picture."); }
    }
  };

  const handleSaveAboutMe = async () => {
    if (!currentUser || !currentUser.username) { Alert.alert("Error", "User data not available."); return; }
    try {
      await AsyncStorage.setItem(`profile_${currentUser.username}_aboutMe`, aboutMeText);
      setIsEditingAboutMe(false);
    } catch (e) { console.error("Failed to save About Me:", e); Alert.alert("Error", "Could not save About Me."); }
  };

  const handleSelectMood = async (selectedMood) => {
    if (!currentUser || !currentUser.username) { Alert.alert("Error", "User data not available."); return; }
    setCurrentMood(selectedMood);
    try { await AsyncStorage.setItem(`profile_${currentUser.username}_moodId`, selectedMood.id); }
    catch (e) { console.error("Failed to save mood:", e); Alert.alert("Error", "Could not save mood preference."); }
    setIsEditingMood(false);
  };

  const handleAddComment = async () => {
    if (!currentUser || !currentUser.username || !newComment.trim()) {
        if (!newComment.trim()) { Alert.alert("Empty Note", "Please write something to post."); }
        else { Alert.alert("Error", "User data not available."); }
        return;
    }
    const commentToAdd = {
      id: Date.now().toString(), text: newComment.trim(),
      author: currentUser.name || currentUser.username, timestamp: new Date().toISOString(),
    };
    try {
      const updatedComments = [commentToAdd, ...comments];
      await AsyncStorage.setItem(`profile_${currentUser.username}_comments`, JSON.stringify(updatedComments));
      setComments(updatedComments); setNewComment('');
    } catch (e) { console.error("Failed to add comment:", e); Alert.alert("Error", "Could not add comment."); }
  };


  const ProfileSection = ({ title, children, iconName, onEditPress, isEditing }) => (
    <View style={styles.profileSection}>
      <View style={styles.sectionTitleContainer}>
        <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
            {iconName && <Ionicons name={iconName} size={20} color={MYSPACE_BLUE_ACCENT} style={{marginRight: 8}}/>}
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {onEditPress && (
            <TouchableOpacity onPress={onEditPress} style={styles.editSectionButton}>
                <Ionicons name={isEditing ? "close-circle-outline" : "pencil-outline"} size={22} color={MYSPACE_BLUE_ACCENT} />
            </TouchableOpacity>
        )}
      </View>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  if (isLoadingProfile) { // Main profile data loading
    return ( <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={PRIMARY_COLOR} /><Text style={styles.loadingText}>Loading Profile...</Text></View> );
  }
  if (!currentUser) {
    return ( <View style={[styles.container, styles.centered]}><Text style={styles.errorText}>Could not load user profile. Please try logging in again.</Text></View> );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{currentUser.username || currentUser.name || 'My'}'s Space</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={{paddingBottom: 20}} keyboardShouldPersistTaps="handled">
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handlePickImage} style={styles.profilePicContainer}>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.profileImage} />
            ) : (
              <Ionicons name="person-circle-outline" size={width * 0.3} color={PRIMARY_COLOR} />
            )}
            <View style={styles.editIconOverlay}>
                <Ionicons name="camera-outline" size={20} color={TEXT_COLOR_LIGHT} />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{currentUser.name || currentUser.username}</Text>
          <Text style={styles.profileUsername}>"{currentUser.username || 'Pick Master'}"</Text>
          <View style={styles.moodContainer}>
            {isEditingMood ? (
                <TouchableOpacity style={[styles.actionButton, styles.cancelButton, styles.moodEditToggleButton]} onPress={() => setIsEditingMood(false)}>
                    <Text style={styles.actionButtonText}>Done Editing Mood</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={styles.moodDisplay} onPress={() => setIsEditingMood(true)}>
                    <Text style={styles.profileStatus}>Mood: {currentMood.emoji} {currentMood.text}</Text>
                    <Ionicons name="pencil-outline" size={16} color={MYSPACE_PINK_ACCENT} style={{marginLeft: 5}}/>
                </TouchableOpacity>
            )}
          </View>
        </View>

        {isEditingMood && (
            <View style={styles.moodSelectorContainer}>
                <Text style={styles.moodSelectorTitle}>Select Your Mood:</Text>
                {MOOD_OPTIONS.map(mood => (
                    <TouchableOpacity key={mood.id} style={styles.moodOption} onPress={() => handleSelectMood(mood)}>
                        <Text style={styles.moodOptionText}>{mood.emoji} {mood.text}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        )}

        <View style={styles.mainContent}>
          <View style={styles.leftColumn}>
            <ProfileSection 
                title="About Me" 
                iconName="information-circle-outline"
                onEditPress={() => setIsEditingAboutMe(!isEditingAboutMe)}
                isEditing={isEditingAboutMe}
            >
              {isEditingAboutMe ? (
                <>
                  <TextInput
                    style={styles.textInputBio}
                    multiline
                    maxLength={MAX_BIO_LENGTH}
                    onChangeText={setAboutMeText}
                    value={aboutMeText}
                    placeholder="Tell us about yourself..."
                    autoFocus={true}
                  />
                  <Text style={styles.charCount}>{MAX_BIO_LENGTH - aboutMeText.length} characters remaining</Text>
                  <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={handleSaveAboutMe}>
                    <Text style={styles.actionButtonText}>Save Bio</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.aboutMeText}>{aboutMeText || "No bio yet. Tap the pencil to add one!"}</Text>
              )}
            </ProfileSection>

            <ProfileSection title="My Pick Stats" iconName="stats-chart-outline">
              {isLoadingStatsData ? ( 
                <ActivityIndicator size="small" color={PRIMARY_COLOR} />
              ) : (
                <>
                  <Text style={styles.statsText}>Total Correct Picks: {userStats.correctPicks}</Text>
                  <Text style={styles.statsText}>Total Incorrect Picks: {userStats.incorrectPicks}</Text>
                  <Text style={styles.statsText}>Games Graded: {userStats.gamesGraded}</Text>
                  <Text style={styles.statsText}>
                      Pick Accuracy: {userStats.accuracy.toFixed(1)}%
                  </Text>
                </>
              )}
              <TouchableOpacity onPress={() => navigation.navigate('Stats')}>
                <Text style={styles.linkText}>View Full Stats Breakdown</Text>
              </TouchableOpacity>
            </ProfileSection>
          </View>

          <View style={styles.rightColumn}>
            <ProfileSection title="Managers" iconName="people-outline">
              {leagueMates.length > 0 ? leagueMates.slice(0, 4).map(mate => (
                <View key={mate.username || mate.email} style={styles.friendItemContainer}>
                    <Ionicons name="person-outline" size={16} color={MYSPACE_BLUE_ACCENT} style={{marginRight: 5}}/>
                    <Text style={styles.friendItem}>{mate.name || mate.username}</Text>
                </View>
              )) : <Text style={styles.smallTextMuted}>No other managers yet.</Text>}
              {leagueMates.length > 4 && <Text style={styles.linkText}>...and more!</Text>}
            </ProfileSection>

             <ProfileSection title="My Fantasy Record" iconName="football-outline">
                <Text style={styles.statsText}>Overall Record: (Coming Soon)</Text>
                <Text style={styles.smallTextMuted}>Yahoo Fantasy integration planned.</Text>
            </ProfileSection>
          </View>
        </View>

        <View style={styles.footerCommentSection}>
            <Text style={styles.sectionTitle}>Public Post / Smack Talk</Text>
            <TextInput
                style={[styles.textInput, styles.commentInput]}
                placeholder="Leave a note for yourself..."
                value={newComment}
                onChangeText={setNewComment}
                multiline
            />
            <TouchableOpacity style={[styles.actionButton, styles.postButton]} onPress={handleAddComment}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={TEXT_COLOR_LIGHT} style={{marginRight: 5}}/>
                <Text style={styles.actionButtonText}>Post Note</Text>
            </TouchableOpacity>
            <View style={styles.commentsList}>
                {comments.length > 0 ? comments.slice(0, 5).map(comment => ( 
                    <View key={comment.id} style={styles.commentItem}>
                        <Text style={styles.commentText}>{comment.text}</Text>
                        <Text style={styles.commentMeta}>
                            By {comment.author} on {new Date(comment.timestamp).toLocaleDateString()}
                        </Text>
                    </View>
                )) : <Text style={styles.smallTextMuted}>No notes yet.</Text>}
            </View>
        </View>
      </ScrollView>
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DCE1E8',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  loadingText: {
    marginTop: 10,
    color: TEXT_COLOR_DARK,
  },
  errorText: {
    color: TEXT_COLOR_DARK,
    textAlign: 'center',
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
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: CARD_BACKGROUND_DARK,
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: MYSPACE_BLUE_ACCENT,
  },
  profilePicContainer: {
    width: width * 0.35,
    height: width * 0.35,
    borderRadius: (width * 0.35) / 8,
    borderWidth: 3,
    borderColor: MYSPACE_BLUE_ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#FFF',
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: (width * 0.35) / 8 - 3,
  },
  editIconOverlay:{
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    borderRadius: 15,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginBottom: 2,
  },
  profileUsername: {
    fontSize: 16,
    fontStyle: 'italic',
    color: TEXT_COLOR_DARK,
    marginBottom: 5,
  },
  profileStatus: {
    fontSize: 14,
    color: MYSPACE_PINK_ACCENT,
    fontWeight: '600',
  },
  moodContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  moodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  moodSelectorContainer: {
    marginHorizontal: 10,
    marginVertical: 10,
    padding: 10,
    backgroundColor: CARD_BACKGROUND_DARK,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  moodSelectorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginBottom: 10,
    textAlign: 'center',
  },
  moodOption: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  moodOptionText: {
    fontSize: 16,
    color: TEXT_COLOR_DARK,
  },
  moodEditToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  mainContent: {
    flexDirection: 'row',
    padding: 10,
  },
  leftColumn: {
    flex: 2,
    marginRight: 5,
  },
  rightColumn: {
    flex: 1,
    marginLeft: 5,
  },
  profileSection: {
    backgroundColor: CARD_BACKGROUND_LIGHT,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 15,
    padding: 0,
    overflow: 'hidden',
  },
  sectionTitleContainer: {
    backgroundColor: CARD_BACKGROUND_DARK,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: BORDER_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editSectionButton: {
    padding: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  sectionContent: {
    padding: 12,
  },
  aboutMeText: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_COLOR_DARK,
    minHeight: 60,
  },
  textInputBio: {
    backgroundColor: INPUT_BACKGROUND,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 5,
    color: TEXT_COLOR_DARK,
  },
  textInput: {
    backgroundColor: INPUT_BACKGROUND,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    marginBottom: 10,
    color: TEXT_COLOR_DARK,
  },
  charCount: {
    fontSize: 12,
    color: '#777',
    textAlign: 'right',
    marginBottom: 10,
  },
  editButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 4,
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: MYSPACE_BLUE_ACCENT,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#757575',
  },
  postButton: {
    backgroundColor: MYSPACE_PINK_ACCENT,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  actionButtonText: {
    color: TEXT_COLOR_LIGHT,
    fontWeight: '600',
    fontSize: 14,
  },
  statsText: {
    fontSize: 14,
    color: TEXT_COLOR_DARK,
    marginBottom: 5,
  },
  friendItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  friendItem: {
    fontSize: 14,
    color: TEXT_COLOR_DARK,
  },
  linkText: {
    color: MYSPACE_BLUE_ACCENT,
    marginTop: 8,
    fontWeight: '600',
  },
  trophyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 5,
  },
  smallText: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
  },
  smallTextMuted: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  footerCommentSection: {
    margin: 10,
    padding: 10,
    backgroundColor: CARD_BACKGROUND_DARK,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  commentInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: INPUT_BACKGROUND,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    color: TEXT_COLOR_DARK,
  },
  commentsList: {
    marginTop: 15,
  },
  commentItem: {
    backgroundColor: CARD_BACKGROUND_LIGHT,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 10,
  },
  commentText: {
    fontSize: 14,
    color: TEXT_COLOR_DARK,
  },
  commentMeta: {
    fontSize: 10,
    color: '#777',
    marginTop: 5,
    textAlign: 'right',
  }
});

export default ProfileScreen;