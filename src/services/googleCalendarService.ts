import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Enable web browser completion for auth session
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET;

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const GOOGLE_ACCESS_TOKEN_KEY = 'google_access_token';
const GOOGLE_REFRESH_TOKEN_KEY = 'google_refresh_token';
const GOOGLE_TOKEN_EXPIRY_KEY = 'google_token_expiry';

export const googleCalendarService = {
  // Authenticate with Google
  async authenticate(): Promise<boolean> {
    try {
      // Use localhost redirect for web OAuth client
      const redirectUri = 'http://localhost:8081';
      console.log('Using redirect URI:', redirectUri);

      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_CLIENT_ID!,
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
        redirectUri,
      });

      const result = await request.promptAsync(discovery);

      if (result.type === 'success') {
        const { code } = result.params;

        // Exchange authorization code for tokens
        const tokenResponse = await this.exchangeCodeForToken(code);

        if (tokenResponse) {
          await this.storeTokens(
            tokenResponse.access_token,
            tokenResponse.refresh_token,
            tokenResponse.expires_in
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Google authentication error:', error);
      return false;
    }
  },

  // Exchange authorization code for access token
  async exchangeCodeForToken(code: string) {
    const redirectUri = 'http://localhost:8081';
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Token exchange error:', error);
      return null;
    }
  },

  // Store tokens securely
  async storeTokens(accessToken: string, refreshToken: string | undefined, expiresIn: number) {
    try {
      await AsyncStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) {
        await AsyncStorage.setItem(GOOGLE_REFRESH_TOKEN_KEY, refreshToken);
      }
      const expiryTime = Date.now() + expiresIn * 1000;
      await AsyncStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, expiryTime.toString());
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  },

  // Get valid access token (refresh if needed)
  async getAccessToken(): Promise<string | null> {
    try {
      const accessToken = await AsyncStorage.getItem(GOOGLE_ACCESS_TOKEN_KEY);
      const expiryTime = await AsyncStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY);

      if (!accessToken) {
        return null;
      }

      // Check if token is expired
      if (expiryTime && Date.now() > parseInt(expiryTime)) {
        // Token expired, refresh it
        const refreshToken = await AsyncStorage.getItem(GOOGLE_REFRESH_TOKEN_KEY);
        if (refreshToken) {
          return await this.refreshAccessToken(refreshToken);
        }
        return null;
      }

      return accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  },

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          grant_type: 'refresh_token',
        }).toString(),
      });

      const data = await response.json();

      if (data.access_token) {
        await this.storeTokens(data.access_token, refreshToken, data.expires_in);
        return data.access_token;
      }

      return null;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    return !!accessToken;
  },

  // Create a calendar event
  async createCalendarEvent(event: {
    summary: string;
    description?: string;
    location?: string;
    start: string; // ISO 8601 format
    end: string; // ISO 8601 format
    attendees?: string[]; // Array of email addresses
  }): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      const accessToken = await this.getAccessToken();

      if (!accessToken) {
        return { success: false, error: 'Not authenticated. Please sign in with Google.' };
      }

      const calendarEvent = {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.start,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: event.end,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees: event.attendees?.map(email => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 },
          ],
        },
      };

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(calendarEvent),
        }
      );

      const data = await response.json();

      if (response.ok) {
        return { success: true, eventId: data.id };
      } else {
        console.error('Calendar API error:', data);
        return { success: false, error: data.error?.message || 'Failed to create event' };
      }
    } catch (error: any) {
      console.error('Create calendar event error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  },

  // Clear stored tokens (logout)
  async clearTokens() {
    try {
      await AsyncStorage.multiRemove([
        GOOGLE_ACCESS_TOKEN_KEY,
        GOOGLE_REFRESH_TOKEN_KEY,
        GOOGLE_TOKEN_EXPIRY_KEY,
      ]);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  },
};
