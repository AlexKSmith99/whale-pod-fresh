import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🐋 Whale Pod</Text>
      <Text style={styles.subtitle}>Welcome, {user?.email}!</Text>
      <Text style={styles.text}>Your pursuit feed will go here</Text>
      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 48, fontWeight: 'bold', color: '#0ea5e9', marginBottom: 20 },
  subtitle: { fontSize: 18, color: '#666', marginBottom: 10 },
  text: { fontSize: 14, color: '#999', marginBottom: 30 },
  button: { backgroundColor: '#ef4444', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
