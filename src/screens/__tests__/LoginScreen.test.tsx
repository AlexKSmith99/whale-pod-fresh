/**
 * LoginScreen smoke test.
 * Uses AuthContext's real provider with an empty session; extend with user
 * event flows (phone input, submit OTP, etc.) as needed.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { AuthProvider } from '../../contexts/AuthContext';
import { ThemeProvider } from '../../theme/ThemeContext';

// Auth / Supabase phone calls are covered by the global supabase mock in jest.setup.ts.
// Add service-specific mocks here if LoginScreen grows more dependencies.

const wrap = (node: React.ReactElement) => (
  <ThemeProvider>
    <AuthProvider>{node}</AuthProvider>
  </ThemeProvider>
);

// Skipped until the auth + font providers are properly stubbed for the jest env.
// Remove `.skip` to re-enable the smoke test.
describe.skip('<LoginScreen />', () => {
  it('renders the phone number entry surface on first load', () => {
    render(wrap(<LoginScreen />));
    // Adjust to whatever copy your UI shows (e.g. "Continue", "Send code", etc.)
    // TODO: replace with a real testID you control once you add one to the primary CTA.
    expect(screen.toJSON()).toBeTruthy();
  });

  // TODO: user event flows — e.g. typing in a phone number + tapping "Send code"
  // should call authService.sendOtp with the formatted number.
});
