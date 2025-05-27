import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define colors from the logo
const COLORS = {
  primaryBlue: '#1A237E', // Dark blue from the logo background (approximate)
  lighterBlue: '#1f366a', // As per your previous version
  textWhite: '#FFFFFF',
  fieldGreen: '#4CAF50', // Green from the field in the logo (approximate)
  accentYellow: '#FFEB3B', // Yellow accent (approximate)
  inputBackground: '#E8EAF6', // Lighter shade for input fields
  placeholderText: '#757575',
  errorRed: '#D32F2F',
  buttonText: '#FFFFFF',
  disabledButton: '#9E9E9E'
};

const { width, height } = Dimensions.get('window');

// Destructure onLoginSuccess from props
const LoginScreen = ({ navigation, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const existingUsersData = await AsyncStorage.getItem('users');
      if (!existingUsersData) {
        Alert.alert('Login Failed', 'No user accounts found. Please sign up.');
        setIsLoading(false);
        return;
      }

      const existingUsers = JSON.parse(existingUsersData);
      const user = existingUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );

      // IMPORTANT: In a real app, compare hashed passwords!
      // This is insecure for production.
      if (user && user.password === password) {
        // Store user data to indicate session
        await AsyncStorage.setItem('currentUser', JSON.stringify(user));

        // Show success alert
        Alert.alert('Success', 'Logged in successfully!', [
          {
            text: 'OK',
            onPress: () => {
              // Call the onLoginSuccess callback AFTER the alert is dismissed
              if (onLoginSuccess) {
                onLoginSuccess();
              }
              // No explicit navigation needed here if App.js handles the re-render
            },
          },
        ]);
      } else {
        Alert.alert('Login Failed', 'Invalid email or password.');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'An error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardAvoidingContainer}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.lighterBlue} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/Pickem_Logo.png')} // Ensure this path is correct
            style={styles.logo}
            resizeMode="contain" // Corrected resizeMode
          />
        </View>

        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>Login to continue</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email or Username"
            placeholderTextColor={COLORS.placeholderText}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />
          <TextInput
            ref={(ref) => (passwordInputRef = ref)}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.placeholderText}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>{isLoading ? 'Logging in...' : 'Login'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.linkText}>Forgot Password?</Text>
        </TouchableOpacity>

        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={[styles.linkText, styles.signUpLink]}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Ref for password input focus
let passwordInputRef = React.createRef();

const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
    flex: 1,
    backgroundColor: COLORS.lighterBlue,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  logoContainer: {
    marginBottom: height * 0.05,
    alignItems: 'center',
  },
  logo: {
    width: width * 0.8,
    height: height * 0.25,
    maxWidth: 300,     // As per your previous version
    maxHeight: 250,    // As per your previous version
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textWhite,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textWhite,
    marginBottom: height * 0.05,
    textAlign: 'center',
    opacity: 0.9,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 25, // Pill shape
    paddingHorizontal: 20,
    fontSize: 16,
    color: COLORS.primaryBlue, // Text color inside input
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.primaryBlue, // Subtle border
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: COLORS.fieldGreen, // Green button
    borderRadius: 25, // Pill shape
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: COLORS.disabledButton,
  },
  buttonText: {
    color: COLORS.buttonText,
    fontSize: 18,
    fontWeight: 'bold',
  },
  linkButton: {
    marginBottom: 20,
  },
  linkText: {
    color: COLORS.textWhite, // White links
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: height * 0.03, // Responsive margin
  },
  signUpText: {
    color: COLORS.textWhite,
    fontSize: 14,
    opacity: 0.9,
  },
  signUpLink: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    color: COLORS.accentYellow, // Accent color for sign up link
  },
});

export default LoginScreen;