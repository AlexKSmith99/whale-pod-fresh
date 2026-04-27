/**
 * CreateScreen smoke test scaffold.
 * CreateScreen is a multi-page stepper with heavy state, modals, and service
 * calls — keep this shallow and add focused flows one at a time.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import CreateScreen from '../CreateScreen';
import { AuthProvider } from '../../contexts/AuthContext';
import { ThemeProvider } from '../../theme/ThemeContext';

jest.mock('../../services/pursuitService', () => ({
  pursuitService: {
    createPursuit: jest.fn(() => Promise.resolve({ id: 'pod-new' })),
  },
}));

// Skipped until context providers + async loaders in CreateScreen are stubbed.
// Remove `.skip` to re-enable the smoke test.
describe.skip('<CreateScreen />', () => {
  it('mounts without crashing', () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <CreateScreen onClose={() => {}} />
        </AuthProvider>
      </ThemeProvider>
    );
    // Cheap assertion — just ensures the tree rendered something.
    expect(screen.toJSON()).toBeTruthy();
  });

  // TODO: step-through tests
  //  - fill Title + Description → canProceedPage(0) should gate forward button
  //  - select 3 Pod Types → bubble chips render with tints
  //  - toggle Open Pod on page 3 → Application Questions section hides
  //  - submit with valid data → pursuitService.createPursuit is called with expected payload
});
