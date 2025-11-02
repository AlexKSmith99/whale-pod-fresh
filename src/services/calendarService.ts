import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

// Google Calendar OAuth Configuration
// YOU NEED TO REPLACE THESE WITH YOUR OWN CREDENTIALS FROM GOOGLE CLOUD CONSOLE
// Instructions:
// 1. Go to https://console.cloud.google.com/
// 2. Create a new project or select existing
// 3. Enable Google Calendar API
// 4. Create OAuth 2.0 credentials (Web application)
// 5. Add redirect URI: https://auth.expo.io/@your-username/your-app-slug
// 6. Copy Client ID and Client Secret below

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE';
const GOOGLE_CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET_HERE';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const STORAGE_KEY = '@whale_pod_google_token';

export const calendarService = {
  // Initialize OAuth request
  createAuthRequest() {
    const redirectUri = AuthSession.makeRedirectUri({
      useProxy: true, // Use Expo's proxy for development
    });

    return new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      redirectUri,
      usePKCE: false,
      responseType: AuthSession.ResponseType.Code,
      extraParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    });
  },

  // Perform OAuth login
  async login(): Promise<string | null> {
    try {
      const authRequest = this.createAuthRequest();
      await authRequest.promptAsync(discovery);

      if (authRequest.codeVerifier) {
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            code: authRequest.code!,
            redirectUri: authRequest.redirectUri,
            extraParams: {
              code_verifier: authRequest.codeVerifier,
            },
          },
          discovery
        );

        // Store tokens
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
            expiresIn: tokenResult.expiresIn,
            issuedAt: tokenResult.issuedAt,
          })
        );

        return tokenResult.accessToken;
      }

      return null;
    } catch (error) {
      console.error('Google Calendar OAuth error:', error);
      throw error;
    }
  },

  // Get stored access token
  async getAccessToken(): Promise<string | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const { accessToken, refreshToken, expiresIn, issuedAt } = JSON.parse(stored);

      // Check if token is expired
      const now = Date.now();
      const expiresAt = issuedAt + expiresIn * 1000;

      if (now >= expiresAt) {
        // Token expired, refresh it
        if (refreshToken) {
          const newToken = await this.refreshAccessToken(refreshToken);
          return newToken;
        }
        return null;
      }

      return accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  },

  // Refresh expired access token
  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch(discovery.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      const data = await response.json();

      if (data.access_token) {
        // Update stored token
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            accessToken: data.access_token,
            refreshToken,
            expiresIn: data.expires_in,
            issuedAt: Date.now(),
          })
        );

        return data.access_token;
      }

      return null;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  },

  // Logout (clear stored tokens)
  async logout() {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },

  // Create a calendar event
  async createEvent({
    summary,
    description,
    startDateTime,
    endDateTime,
    attendees,
    location,
  }: {
    summary: string;
    description?: string;
    startDateTime: string; // ISO 8601 format
    endDateTime: string; // ISO 8601 format
    attendees: string[]; // Array of email addresses
    location?: string;
  }): Promise<string | null> {
    try {
      let accessToken = await this.getAccessToken();

      // If no token, prompt for login
      if (!accessToken) {
        accessToken = await this.login();
        if (!accessToken) {
          throw new Error('Failed to authenticate with Google Calendar');
        }
      }

      // Create event
      const event = {
        summary,
        description,
        start: {
          dateTime: startDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees: attendees.map((email) => ({ email })),
        location,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
        conferenceData: location === 'video'
          ? {
              createRequest: {
                requestId: `whale-pod-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            }
          : undefined,
      };

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Google Calendar API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.id; // Return event ID
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  },

  // Get event details
  async getEvent(eventId: string) {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch event');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting event:', error);
      throw error;
    }
  },

  // Update an event
  async updateEvent(
    eventId: string,
    updates: {
      summary?: string;
      description?: string;
      startDateTime?: string;
      endDateTime?: string;
      attendees?: string[];
      location?: string;
    }
  ) {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // Get existing event first
      const existingEvent = await this.getEvent(eventId);

      // Merge updates
      const updatedEvent = {
        ...existingEvent,
        ...(updates.summary && { summary: updates.summary }),
        ...(updates.description && { description: updates.description }),
        ...(updates.startDateTime && {
          start: {
            dateTime: updates.startDateTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
        ...(updates.endDateTime && {
          end: {
            dateTime: updates.endDateTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
        ...(updates.attendees && {
          attendees: updates.attendees.map((email) => ({ email })),
        }),
        ...(updates.location && { location: updates.location }),
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedEvent),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update event');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  },

  // Delete an event
  async deleteEvent(eventId: string) {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok && response.status !== 204) {
        throw new Error('Failed to delete event');
      }

      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return token !== null;
  },
};
