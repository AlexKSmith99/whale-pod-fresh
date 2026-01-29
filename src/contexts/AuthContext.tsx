import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { notificationService } from '../services/notificationService';

interface AuthContextType {
  user: any;
  loading: boolean;
  pendingVerificationEmail: string | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendVerificationCode: (email: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  clearPendingVerification: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Register push token if user is logged in
      if (session?.user) {
        notificationService.registerPushToken(session.user.id).catch(err => {
          console.log('Push token registration skipped:', err?.message || 'Not available');
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      
      // Register push token when user signs in
      if (_event === 'SIGNED_IN' && session?.user) {
        notificationService.registerPushToken(session.user.id).catch(err => {
          console.log('Push token registration skipped:', err?.message || 'Not available');
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    // Create the user account
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Don't automatically sign in - require email verification first
        emailRedirectTo: undefined,
      }
    });
    if (signUpError) throw signUpError;

    // Send OTP verification code
    await sendVerificationCode(email);

    // Store email for verification screen
    setPendingVerificationEmail(email);
  };

  const sendVerificationCode = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // User already exists from signUp
      },
    });
    if (error) throw error;
  };

  const verifyEmail = async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    if (error) throw error;

    // Clear pending verification on success
    setPendingVerificationEmail(null);
  };

  const clearPendingVerification = () => {
    setPendingVerificationEmail(null);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear saved credentials when logging out
    await AsyncStorage.removeItem('saved_email');
    await AsyncStorage.removeItem('saved_password');
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      pendingVerificationEmail,
      signUp,
      signIn,
      signOut,
      sendVerificationCode,
      verifyEmail,
      clearPendingVerification,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
