import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { notificationService } from '../services/notificationService';
import * as WebBrowser from 'expo-web-browser';

interface AuthContextType {
  user: any;
  loading: boolean;
  pendingVerificationEmail: string | null;
  pendingPhoneVerification: string | null;
  signUp: (email: string, password: string, phone?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendVerificationCode: (email: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  clearPendingVerification: () => void;
  resetPassword: (email: string) => Promise<void>;
  sendPhoneVerificationCode: (phone: string) => Promise<void>;
  verifyPhoneCode: (phone: string, code: string) => Promise<boolean>;
  clearPhoneVerification: () => void;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [pendingPhoneVerification, setPendingPhoneVerification] = useState<string | null>(null);

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

  const signUp = async (email: string, password: string, phone?: string) => {
    // Create the user account with phone if provided
    const { error: signUpError, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Don't automatically sign in - require email verification first
        emailRedirectTo: undefined,
        data: phone ? { phone } : undefined,
      }
    });
    if (signUpError) throw signUpError;

    // If phone provided, update the user's phone in profiles
    if (phone && data.user) {
      await supabase
        .from('profiles')
        .update({ phone })
        .eq('id', data.user.id);
    }

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

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: undefined, // For mobile, we handle this differently
    });
    if (error) throw error;
  };

  const sendPhoneVerificationCode = async (phone: string) => {
    // Format phone number to E.164 format if needed
    const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;

    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });
    if (error) throw error;

    setPendingPhoneVerification(formattedPhone);
  };

  const verifyPhoneCode = async (phone: string, code: string): Promise<boolean> => {
    const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;

    const { error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: code,
      type: 'sms',
    });

    if (error) {
      console.error('Phone verification error:', error);
      return false;
    }

    setPendingPhoneVerification(null);
    return true;
  };

  const clearPhoneVerification = () => {
    setPendingPhoneVerification(null);
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

  const signInWithApple = async () => {
    // Dynamically import to avoid crashes on Android
    const AppleAuthentication = await import('expo-apple-authentication');

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('No identity token received from Apple');
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) throw error;

    // Apple only sends name on first sign-in — store it if available
    if (credential.fullName?.givenName) {
      const fullName = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ');
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase
          .from('profiles')
          .update({ name: fullName })
          .eq('id', currentUser.id)
          .is('name', null);
      }
    }
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'whalepod://auth/callback',
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      'whalepod://auth/callback'
    );

    if (result.type === 'success') {
      const url = new URL(result.url);
      // Supabase puts tokens in the URL hash fragment
      const hashParams = new URLSearchParams(url.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      pendingVerificationEmail,
      pendingPhoneVerification,
      signUp,
      signIn,
      signOut,
      sendVerificationCode,
      verifyEmail,
      clearPendingVerification,
      resetPassword,
      sendPhoneVerificationCode,
      verifyPhoneCode,
      clearPhoneVerification,
      signInWithApple,
      signInWithGoogle,
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
