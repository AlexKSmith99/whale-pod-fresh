import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
} from 'react-native-agora';

class AgoraService {
  private engine: IRtcEngine | null = null;
  private appId: string = '';

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
}

export const agoraService = new AgoraService();
