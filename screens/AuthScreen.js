import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    Alert,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const AuthScreen = () => {
    const navigation = useNavigation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');

    const handleSignUp = async () => {
        if (!email || !password || !name || !username) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        // Add more specific validation if needed (e.g., email format, password strength)

        try {
            const existingUsersData = await AsyncStorage.getItem('users');
            const existingUsers = existingUsersData ? JSON.parse(existingUsersData) : [];

            // Check for existing email or username (case-insensitive)
            const userExists = existingUsers.some(
                user => user.email.toLowerCase() === email.toLowerCase() ||
                        user.username.toLowerCase() === username.toLowerCase()
            );

            if (userExists) {
                Alert.alert('Error', 'An account with this email or username already exists.');
                return;
            }

            // !!! CRITICAL: Implement password hashing here before storing for any real app !!!
            console.warn("SECURITY WARNING: Storing plain text password. This is insecure for production apps.");
            const newUser = { email, password, name, username }; // Removed location from newUser

            existingUsers.push(newUser);

            await AsyncStorage.setItem('users', JSON.stringify(existingUsers));

            Alert.alert('Success', 'Account created successfully! Please log in.');
            navigation.navigate('Login'); // Navigate to the Login screen
        } catch (error) {
            Alert.alert('Error', 'Unable to create account. Please try again.');
            console.error('Sign up error:', error);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Create an Account</Text>
            <TextInput
                style={styles.input}
                placeholder="Name (First & Last)"
                onChangeText={setName}
                value={name}
                autoCapitalize="words"
            />
            <TextInput
                style={styles.input}
                placeholder="Team Name"
                onChangeText={setUsername}
                value={username}
                autoCapitalize="none"
            />
            <TextInput
                style={styles.input}
                placeholder="Email"
                onChangeText={setEmail}
                value={email}
                keyboardType="email-address"
                autoCapitalize="none"
            />
            <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                onChangeText={setPassword}
                value={password}
            />

            <View style={styles.buttonContainer}>
                <Button title="Sign Up" onPress={handleSignUp} color="#1A237E" />
            </View>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
                <Text style={styles.loginLinkText}>Already have an account? Login</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#1f366a',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 30,
        textAlign: 'center',
    },
    input: {
        width: '100%',
        height: 50,
        backgroundColor: '#FFFFFF',
        borderColor: '#1f366a',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 15,
        fontSize: 16,
        color: '#263238',
    },
    buttonContainer: {
        width: '100%',
        marginTop: 10,
        borderRadius: 8,
        overflow: 'hidden',
    },
    loginLink: {
        marginTop: 25,
    },
    loginLinkText: {
        color: 'white',
        fontSize: 16,
        textDecorationLine: 'underline',
    }
});

export default AuthScreen;