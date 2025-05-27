// screens/SettingsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
  Linking,
  Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';

// Colors
const PRIMARY_COLOR = '#1f366a';
const TEXT_COLOR_LIGHT = '#FFFFFF';
const TEXT_COLOR_DARK = '#333333';
const CARD_BACKGROUND = '#FFFFFF';
const BORDER_COLOR = '#E0E0E0';
const LIST_ITEM_TEXT_COLOR = '#212121';
const LIST_ITEM_ICON_COLOR = '#757575';
const DANGER_COLOR = '#D32F2F';
const SWITCH_THUMB_COLOR_IOS = '#FFFFFF';
const SWITCH_TRACK_COLOR_FALSE = '#767577';
const SWITCH_TRACK_COLOR_TRUE = PRIMARY_COLOR;

const PICK_REMINDER_NOTIFICATION_ID_PREFIX = 'weeklyPickReminder_week_';

// --- Weekly Pick Lock Schedule ---
// Times are assumed to be CT. Notification will be 1 hour before.
const WEEKLY_PICK_SCHEDULE = [
  { week: 1, date: '9/4/2025', lockTime: '6:00PM' }, // Reminder at 5:00 PM CT
  { week: 2, date: '9/11/2025', lockTime: '6:00PM' },
  { week: 3, date: '9/18/2025', lockTime: '6:00PM' },
  { week: 4, date: '9/25/2025', lockTime: '6:00PM' },
  { week: 5, date: '10/2/2025', lockTime: '6:00PM' },
  { week: 6, date: '10/9/2025', lockTime: '6:00PM' },
  { week: 7, date: '10/16/2025', lockTime: '6:00PM' },
  { week: 8, date: '10/23/2025', lockTime: '6:00PM' },
  { week: 9, date: '10/30/2025', lockTime: '6:00PM' },
  { week: 10, date: '11/6/2025', lockTime: '6:00PM' },
  { week: 11, date: '11/13/2025', lockTime: '6:00PM' },
  { week: 12, date: '11/20/2025', lockTime: '6:00PM' },
  { week: 13, date: '11/27/2025', lockTime: '6:00PM' }, // Thanksgiving, often has different game times
  { week: 14, date: '12/4/2025', lockTime: '6:00PM' },
  { week: 15, date: '12/11/2025', lockTime: '6:00PM' },
  { week: 16, date: '12/18/2025', lockTime: '6:00PM' },
  { week: 17, date: '12/25/2025', lockTime: '6:00PM' }, // Christmas, often has different game times
  // Add more weeks as needed
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const SettingsScreen = ({ navigation, onLogout }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [arePickRemindersEnabled, setArePickRemindersEnabled] = useState(false);

  const registerForPushNotificationsAsync = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Permission Required', 'Failed to get permission for notifications! Please enable notifications in your device settings.');
      return false;
    }
    return true;
  };

  useEffect(() => {
    const fetchCurrentUserAndNotificationPref = async () => {
      try {
        const userString = await AsyncStorage.getItem('currentUser');
        if (userString) {
          setCurrentUser(JSON.parse(userString));
        }
        const reminderPref = await AsyncStorage.getItem('pickReminderEnabled');
        setArePickRemindersEnabled(reminderPref === 'true');
      } catch (e) {
        console.error("Failed to load user or notification preference:", e);
      }
    };
    fetchCurrentUserAndNotificationPref();
  }, []);

  const scheduleWeeklyPickReminders = async () => {
    const now = new Date();
    let scheduledCount = 0;

    // First, cancel all previously scheduled pick reminders for this app to avoid duplicates
    // This is a simpler approach than tracking individual IDs if the schedule changes.
    // Alternatively, loop and cancel by specific ID prefix if you have other types of notifications.
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of allScheduled) {
        if (notification.identifier && notification.identifier.startsWith(PICK_REMINDER_NOTIFICATION_ID_PREFIX)) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
    }
    console.log("Cancelled previously scheduled pick reminders.");

    for (const weekSchedule of WEEKLY_PICK_SCHEDULE) {
      const [month, day, year] = weekSchedule.date.split('/');
      let hours = parseInt(weekSchedule.lockTime.match(/\d+/)[0]);
      const isPM = weekSchedule.lockTime.toUpperCase().includes('PM');

      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0; // 12 AM is 0 hours

      // Create date for lock time (assumes local timezone interpretation of the date parts)
      // The notification will be 1 hour before this lockTime.
      const lockDateTime = new Date(year, month - 1, day, hours, 0, 0); // Month is 0-indexed
      const reminderDateTime = new Date(lockDateTime.getTime() - (60 * 60 * 1000)); // 1 hour before

      if (reminderDateTime > now) { // Only schedule if the reminder time is in the future
        const notificationId = `${PICK_REMINDER_NOTIFICATION_ID_PREFIX}${weekSchedule.week}`;
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `🏈 Week ${weekSchedule.week} Pick'em Reminder!`,
              body: `Picks lock in 1 hour (${weekSchedule.lockTime} CT). Make your selections!`,
              data: { screen: 'MakePicks', week: weekSchedule.week }, // Navigate to MakePicks for that week
            },
            trigger: reminderDateTime,
            identifier: notificationId,
          });
          console.log(`Notification scheduled for Week ${weekSchedule.week} at: ${reminderDateTime.toLocaleString()}`);
          scheduledCount++;
        } catch (e) {
          console.error(`Failed to schedule notification for Week ${weekSchedule.week}:`, e);
        }
      } else {
        // console.log(`Reminder time for Week ${weekSchedule.week} (${reminderDateTime.toLocaleString()}) has passed.`);
      }
    }
    if (scheduledCount > 0) {
        Alert.alert("Reminders Enabled", `${scheduledCount} weekly pick reminders have been scheduled.`);
    } else {
        Alert.alert("Reminders Enabled", "No upcoming pick reminders to schedule at this time (all past or schedule empty).");
    }
  };

  const cancelAllWeeklyPickReminders = async () => {
    let cancelledCount = 0;
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of allScheduled) {
        if (notification.identifier && notification.identifier.startsWith(PICK_REMINDER_NOTIFICATION_ID_PREFIX)) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
            cancelledCount++;
        }
    }
    console.log(`Cancelled ${cancelledCount} weekly pick reminders.`);
    Alert.alert("Reminders Disabled", "All weekly pick reminders have been turned off.");
  };


  const handleReminderToggle = async (value) => {
    setArePickRemindersEnabled(value);
    await AsyncStorage.setItem('pickReminderEnabled', value.toString());

    if (value) {
      const hasPermission = await registerForPushNotificationsAsync();
      if (hasPermission) {
        await scheduleWeeklyPickReminders();
      } else {
        // Permission denied, revert toggle
        setArePickRemindersEnabled(false);
        await AsyncStorage.setItem('pickReminderEnabled', 'false');
      }
    } else {
      await cancelAllWeeklyPickReminders();
    }
  };

  const handleLogout = () => { /* ... same as before ... */ };

  const SettingItem = ({ iconName, title, onPress, isDestructive = false, hasSwitch = false, switchValue, onSwitchValueChange }) => (
    <TouchableOpacity style={styles.settingItem} onPress={!hasSwitch ? onPress : null} activeOpacity={hasSwitch ? 1 : 0.2}>
      <Ionicons name={iconName} size={24} color={isDestructive ? DANGER_COLOR : LIST_ITEM_ICON_COLOR} style={styles.settingIcon} />
      <Text style={[styles.settingText, isDestructive && styles.destructiveText]}>{title}</Text>
      {hasSwitch ? (
        <Switch
          trackColor={{ false: SWITCH_TRACK_COLOR_FALSE, true: SWITCH_TRACK_COLOR_TRUE }}
          thumbColor={Platform.OS === 'ios' ? SWITCH_THUMB_COLOR_IOS : (switchValue ? PRIMARY_COLOR : '#f4f3f4')}
          ios_backgroundColor={SWITCH_TRACK_COLOR_FALSE}
          onValueChange={onSwitchValueChange}
          value={switchValue}
        />
      ) : (
        !isDestructive && <Ionicons name="chevron-forward-outline" size={22} color="#C7C7CC" />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <ScrollView style={styles.scrollView}>
        {currentUser && (
          <View style={styles.profileHeader}>
            <View style={styles.avatarPlaceholder}>
                <Ionicons name="person-circle-outline" size={60} color={PRIMARY_COLOR} />
            </View>
            <Text style={styles.profileName}>{currentUser.name || currentUser.username || 'User'}</Text>
            <Text style={styles.profileEmail}>{currentUser.email}</Text>
          </View>
        )}

        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.section}>
          <SettingItem 
            iconName="person-outline" 
            title="Edit Profile" 
            onPress={() => navigation.navigate('Profile')}
          />
          <SettingItem 
            iconName="lock-closed-outline" 
            title="Change Password" 
            onPress={() => navigation.navigate('ChangePassword')}
          />
        </View>

        <Text style={styles.sectionHeader}>Notifications</Text>
        <View style={styles.section}>
          <SettingItem
            iconName="alarm-outline"
            title="Pick Deadline Reminders"
            hasSwitch
            switchValue={arePickRemindersEnabled}
            onSwitchValueChange={handleReminderToggle}
          />
        </View>

        <Text style={styles.sectionHeader}>About</Text>
        <View style={styles.section}>
          <SettingItem iconName="information-circle-outline" title="App Version" onPress={() => Alert.alert("App Version", "1.0.0")} />
          <SettingItem iconName="document-text-outline" title="Terms of Service" onPress={() => Linking.openURL('https://yourwebsite.com/terms').catch(err => console.error("Couldn't load page", err))} />
          <SettingItem iconName="shield-checkmark-outline" title="Privacy Policy" onPress={() => Linking.openURL('https://yourwebsite.com/privacy').catch(err => console.error("Couldn't load page", err))} />
        </View>

        <View style={[styles.section, {marginTop: 20}]}>
          <SettingItem iconName="log-out-outline" title="Logout" onPress={handleLogout} isDestructive />
        </View>
      </ScrollView>
    </View>
  );
};

// Styles remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
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
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: CARD_BACKGROUND,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR_DARK,
  },
  profileEmail: {
    fontSize: 14,
    color: '#757575',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  section: {
    backgroundColor: CARD_BACKGROUND,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER_COLOR,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 15,
    backgroundColor: CARD_BACKGROUND,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_COLOR,
  },
  settingIcon: {
    marginRight: 15,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: LIST_ITEM_TEXT_COLOR,
  },
  destructiveText: {
    color: DANGER_COLOR,
  }
});

export default SettingsScreen;