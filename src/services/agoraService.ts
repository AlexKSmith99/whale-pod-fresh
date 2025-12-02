import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
} from 'react-native-agora';
import { supabase } from '../config/supabase';

// Your Agora App ID
export const AGORA_APP_ID = '08f93099f0e34a699ca7b7deda9349a8';

class AgoraService {
  private engine: IRtcEngine | null = null;
  private appId: string = AGORA_APP_ID;

  async initialize(appId: string) {
    this.appId = appId;

    try {
      // Create the Agora engine instance
      this.engine = createAgoraRtcEngine();

      // Initialize the engine
      await this.engine.initialize({
        appId: this.appId,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      // Enable video module
      await this.engine.enableVideo();

      console.log('Agora engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Agora engine:', error);
      throw error;
    }
  }

  async joinChannel(token: string | null, channelName: string, uid: number = 0) {
    if (!this.engine) {
      throw new Error('Agora engine not initialized');
    }

    try {
      // Set client role to broadcaster (can send and receive)
      await this.engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      // Join the channel
      await this.engine.joinChannel(token || '', channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      });

      console.log(`Joined channel: ${channelName}`);
    } catch (error) {
      console.error('Failed to join channel:', error);
      throw error;
    }
  }

  async leaveChannel() {
    if (!this.engine) {
      throw new Error('Agora engine not initialized');
    }

    try {
      await this.engine.leaveChannel();
      console.log('Left channel');
    } catch (error) {
      console.error('Failed to leave channel:', error);
      throw error;
    }
  }

  async toggleCamera(enabled: boolean) {
    if (!this.engine) {
      throw new Error('Agora engine not initialized');
    }

    try {
      await this.engine.enableLocalVideo(enabled);
    } catch (error) {
      console.error('Failed to toggle camera:', error);
      throw error;
    }
  }

  async toggleMicrophone(enabled: boolean) {
    if (!this.engine) {
      throw new Error('Agora engine not initialized');
    }

    try {
      await this.engine.enableLocalAudio(enabled);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
      throw error;
    }
  }

  async switchCamera() {
    if (!this.engine) {
      throw new Error('Agora engine not initialized');
    }

    try {
      await this.engine.switchCamera();
    } catch (error) {
      console.error('Failed to switch camera:', error);
      throw error;
    }
  }

  getEngine(): IRtcEngine | null {
    return this.engine;
  }

  async destroy() {
    if (this.engine) {
      await this.engine.release();
      this.engine = null;
      console.log('Agora engine destroyed');
    }
  }

  // Generate channel name from meeting ID
  generateChannelName(meetingId: string): string {
    return `meeting_${meetingId}`;
  }

  // Update meeting with Agora channel info
  async updateMeetingAgoraInfo(meetingId: string, channelName: string) {
    const { error } = await supabase
      .from('meetings')
      .update({ agora_channel_name: channelName })
      .eq('id', meetingId);

    if (error) throw error;
  }

  // Track when user joins meeting
  async trackUserJoined(meetingId: string, userId: string) {
    const { error } = await supabase
      .from('meeting_participants')
      .update({ joined_at: new Date().toISOString() })
      .eq('meeting_id', meetingId)
      .eq('user_id', userId);

    if (error) console.error('Failed to track user joined:', error);
  }

  // Track when user leaves meeting
  async trackUserLeft(meetingId: string, userId: string) {
    const { error } = await supabase
      .from('meeting_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('meeting_id', meetingId)
      .eq('user_id', userId);

    if (error) console.error('Failed to track user left:', error);
  }

  // Start recording (placeholder for cloud recording)
  async startRecording(meetingId: string) {
    // TODO: Implement Agora Cloud Recording
    // For now, just mark as enabled in database
    const { error } = await supabase
      .from('meetings')
      .update({ recording_enabled: true })
      .eq('id', meetingId);

    if (error) console.error('Failed to start recording:', error);
  }

  // Stop recording
  async stopRecording(meetingId: string, recordingUrl?: string) {
    const { error } = await supabase
      .from('meetings')
      .update({
        recording_enabled: false,
        recording_url: recordingUrl || null,
      })
      .eq('id', meetingId);

    if (error) console.error('Failed to stop recording:', error);
  }
}

export const agoraService = new AgoraService();
