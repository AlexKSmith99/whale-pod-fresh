import React, { useState } from 'react';
import LoginScreen from '../LoginScreen';
import LegalScreen, { LegalDoc } from '../LegalScreen';
import OpeningScreen from './OpeningScreen';
import ApplyFlow from './ApplyFlow';

type Mode = 'home' | 'login' | 'apply';

/**
 * Logged-out entry point. Replaces the old direct-to-LoginScreen behavior:
 * new users tap "Apply for Membership" → the application flow; returning users
 * tap "Log in" → the existing LoginScreen.
 */
export default function EntryGate() {
  const [mode, setMode] = useState<Mode>('home');
  const [legal, setLegal] = useState<LegalDoc | null>(null);

  if (legal) return <LegalScreen doc={legal} onBack={() => setLegal(null)} />;
  if (mode === 'login') return <LoginScreen onBack={() => setMode('home')} />;
  if (mode === 'apply') return <ApplyFlow onExit={() => setMode('home')} />;

  return (
    <OpeningScreen
      onApply={() => setMode('apply')}
      onLogin={() => setMode('login')}
      onOpenLegal={setLegal}
    />
  );
}
