import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import {
  RtcSurfaceView,
  VideoViewSetupMode,
  RtcConnection,
  RenderModeType,
} from 'react-native-agora';
import { Ionicons } from '@expo/vector-icons';
import { agoraService } from '../services/agoraService';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window');

interface VideoCallScreenProps {
  channelName: string;
  podTitle: string;
  onEndCall: () => void;
  agoraAppId: string;
  agoraToken?: string | null;
}

export default function VideoCallScreen({
  channelName,
  podTitle,
  onEndCall,
  agoraAppId,
  agoraToken = null,
}: VideoCallScreenProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);

  useEffect(() => {
    initializeAndJoin();

    return () => {
      cleanup();
    };
  }, []);

  const requestPermissions = async () => {
    try {
      // Request camera permission
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      if (cameraStatus.status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required for video calls');
        return false;
      }

      // Request microphone permission
      const audioStatus = await Audio.requestPermissionsAsync();
      if (audioStatus.status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone permission is required for video calls');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const initializeAndJoin = async () => {
    try {
      // Request permissions first
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        onEndCall();
        return;
      }

      // Initialize Agora engine
      await agoraService.initialize(agoraAppId);

      const engine = agoraService.getEngine();
      if (!engine) {
        throw new Error('Failed to get Agora engine');
      }

      // Register event handlers
      engine.registerEventHandler({
        onJoinChannelSuccess: (connection: RtcConnection, elapsed: number) => {
          console.log('Successfully joined channel:', connection.channelId);
          setIsJoined(true);
        },
        onUserJoined: (connection: RtcConnection, remoteUid: number, elapsed: number) => {
          console.log('Remote user joined:', remoteUid);
          setRemoteUids((prev) => [...prev, remoteUid]);
        },
        onUserOffline: (connection: RtcConnection, remoteUid: number, reason: number) => {
          console.log('Remote user left:', remoteUid);
          setRemoteUids((prev) => prev.filter((uid) => uid !== remoteUid));
        },
        onError: (err: number, msg: string) => {
          console.error('Agora error:', err, msg);
        },
      });

      // Join the channel
      await agoraService.joinChannel(agoraToken, channelName);
    } catch (error) {
      console.error('Failed to initialize video call:', error);
      Alert.alert('Error', 'Failed to start video call');
      onEndCall();
    }
  };

  const cleanup = async () => {
    try {
      await agoraService.leaveChannel();
      await agoraService.destroy();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  const handleEndCall = async () => {
    await cleanup();
    onEndCall();
  };

  const toggleMute = async () => {
    try {
      await agoraService.toggleMicrophone(!isMuted);
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
  };

  const toggleVideo = async () => {
    try {
      await agoraService.toggleCamera(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  };

  const switchCamera = async () => {
    try {
      await agoraService.switchCamera();
    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.podTitle}>{podTitle}</Text>
        <Text style={styles.channelName}>Channel: {channelName}</Text>
      </View>

      {/* Video Grid */}
      <View style={styles.videoContainer}>
        {/* Remote users */}
        {remoteUids.length > 0 ? (
          <View style={styles.remoteVideosContainer}>
            {remoteUids.map((uid, index) => (
              <View
                key={uid}
                style={[
                  styles.remoteVideoWrapper,
                  remoteUids.length === 1 && styles.remoteVideoFullScreen,
                  remoteUids.length === 2 && styles.remoteVideoHalf,
                  remoteUids.length > 2 && styles.remoteVideoQuarter,
                ]}
              >
                <RtcSurfaceView
                  canvas={{
                    uid,
                    setupMode: VideoViewSetupMode.VideoViewSetupReplace,
                    renderMode: RenderModeType.RenderModeFit,
                  }}
                  style={styles.remoteVideo}
                />
                <View style={styles.userLabel}>
                  <Text style={styles.userLabelText}>User {uid}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#999" />
            <Text style={styles.emptyStateText}>Waiting for others to join...</Text>
          </View>
        )}

        {/* Local video (small preview) */}
        {isVideoEnabled && (
          <View style={styles.localVideoContainer}>
            <RtcSurfaceView
              canvas={{
                uid: 0,
                setupMode: VideoViewSetupMode.VideoViewSetupReplace,
                renderMode: RenderModeType.RenderModeFit,
              }}
              style={styles.localVideo}
            />
            <View style={styles.localLabel}>
              <Text style={styles.localLabelText}>You</Text>
            </View>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={28}
            color={isMuted ? '#ef4444' : '#fff'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
          onPress={toggleVideo}
        >
          <Ionicons
            name={isVideoEnabled ? 'videocam' : 'videocam-off'}
            size={28}
            color={!isVideoEnabled ? '#ef4444' : '#fff'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
          <Ionicons name="camera-reverse" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
          <Ionicons name="call" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  podTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  channelName: {
    fontSize: 14,
    color: '#ccc',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideosContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  remoteVideoWrapper: {
    position: 'relative',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  remoteVideoFullScreen: {
    width: width,
    height: '100%',
  },
  remoteVideoHalf: {
    width: width,
    height: '50%',
  },
  remoteVideoQuarter: {
    width: width / 2,
    height: height / 3,
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
  },
  userLabel: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  userLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#999',
    fontSize: 16,
    marginTop: 20,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#8b5cf6',
    backgroundColor: '#2a2a2a',
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  localLabel: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  localLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    gap: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  endCallButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
  },
});
