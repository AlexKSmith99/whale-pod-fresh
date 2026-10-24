import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image, TouchableOpacity, Linking, LayoutChangeEvent, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { APPLY } from './applyTheme';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';

const LOGO = require('../../../assets/whale-mark.png');

/** A phrase with a soft light sweep passing across it (shiny/shimmer effect). */
function ShimmerText({ children, style }: { children: string; style?: any }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!w) return;
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [w, x]);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });
  const bandWidth = Math.max(80, w * 0.4);

  return (
    <View style={styles.shimmerWrap} onLayout={onLayout}>
      <Text style={[styles.subtitle, style]}>{children}</Text>
      {w > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ width: bandWidth, height: '100%' }}
          />
        </Animated.View>
      )}
    </View>
  );
}

export default function WaitingListScreen({ onApproved }: { onApproved?: () => void }) {
  const auth = useAuth();

  // Leave the waiting list the moment the applicant is approved — via realtime,
  // on app-foreground, and once on mount — without needing a manual relaunch.
  useEffect(() => {
    const userId = auth.user?.id;
    if (!userId || !onApproved) return;

    let done = false;
    const check = async () => {
      if (done) return;
      const { data } = await supabase
        .from('profiles')
        .select('application_status')
        .eq('id', userId)
        .maybeSingle();
      if (data && data.application_status && data.application_status !== 'pending') {
        done = true;
        onApproved();
      }
    };

    check();

    const channel = supabase
      .channel(`application-status-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, () => check())
      .subscribe();

    const sub = AppState.addEventListener('change', s => { if (s === 'active') check(); });

    return () => {
      supabase.removeChannel(channel);
      sub.remove();
    };
  }, [auth.user?.id, onApproved]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.help} accessibilityLabel="Help" activeOpacity={0.7}>
        <Ionicons name="help" size={22} color={APPLY.text} />
      </TouchableOpacity>

      <View style={styles.center}>
        <View style={styles.logoTile}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.title}>Waiting List</Text>
        <ShimmerText>Your application is under review.</ShimmerText>
        <Text style={styles.note}>You'll receive a push notification if your status changes.</Text>
      </View>

      <TouchableOpacity
        style={styles.handle}
        activeOpacity={0.8}
        onPress={() => Linking.openURL('https://instagram.com/getliber')}
      >
        <Text style={styles.handleText}>@getliber</Text>
        <View style={styles.handleIcon}>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: APPLY.bg },
  help: {
    position: 'absolute', top: 60, right: 20, width: 44, height: 44, borderRadius: 22,
    backgroundColor: APPLY.surface, alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  // White card on cream with a hairline border, per the editorial card recipe —
  // was a near-black tile, which no longer belongs on a light page.
  logoTile: {
    width: 96, height: 96, borderRadius: 24, backgroundColor: APPLY.surface,
    borderWidth: 1, borderColor: APPLY.border, alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  logo: { width: 52, height: 52, tintColor: APPLY.text },
  title: { fontSize: 38, fontFamily: 'PlayfairDisplay_700Bold', color: APPLY.text, letterSpacing: -0.6, marginBottom: 16 },
  shimmerWrap: { alignSelf: 'center', overflow: 'hidden' },
  subtitle: { fontSize: 17, color: APPLY.textMuted, textAlign: 'center', fontFamily: 'InterTight_600SemiBold' },
  note: { fontSize: 16, color: APPLY.textMuted, textAlign: 'center', fontFamily: 'InterTight_600SemiBold', marginTop: 22, lineHeight: 24 },
  handle: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: APPLY.surface, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 24, marginBottom: 12,
  },
  handleText: { color: APPLY.teal, fontSize: 17, fontWeight: '600' },
  handleIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: APPLY.teal, alignItems: 'center', justifyContent: 'center' },
});
