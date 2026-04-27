import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import NotificationToast from '../NotificationToast';

describe('<NotificationToast />', () => {
  const baseNotification = {
    title: 'howard Knickfan applied to join',
    body: 'Review his application in the Pods tab',
    type: 'application_received',
  };

  it('renders nothing when given a null notification', () => {
    render(<NotificationToast notification={null} />);
    expect(screen.queryByText(baseNotification.title)).toBeNull();
  });

  it('renders the title and body of the notification', () => {
    render(<NotificationToast notification={baseNotification} />);
    expect(screen.getByText(baseNotification.title)).toBeTruthy();
    expect(screen.getByText(baseNotification.body)).toBeTruthy();
  });

  it('calls onPress when the toast is tapped and then dismisses', async () => {
    const onPress = jest.fn();
    const onDismiss = jest.fn();
    render(
      <NotificationToast
        notification={baseNotification}
        onPress={onPress}
        onDismiss={onDismiss}
      />
    );

    // The whole toast is a TouchableOpacity. Hit the title text's parent press area.
    fireEvent.press(screen.getByText(baseNotification.title));

    expect(onPress).toHaveBeenCalledTimes(1);
    // onDismiss fires after the slide-out animation completes
    await waitFor(() => expect(onDismiss).toHaveBeenCalled(), { timeout: 1000 });
  });
});
