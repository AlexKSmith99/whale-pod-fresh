import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ApplyScaffold from '../components/ApplyScaffold';
import TealButton from '../components/TealButton';
import { AppAlert } from '../../../components/ui/AppAlert';
import { APPLY } from '../applyTheme';
import { StepProps } from '../types';

export default function SelfieStep({ data, update, onNext, onBack, stepIndex, stepCount }: StepProps) {
  const [perm, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const takeSelfie = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (photo?.uri) {
        update({ selfieUri: photo.uri });
      }
    } catch (err) {
      console.error('Error taking selfie:', err);
      AppAlert.alert('Camera error', "We couldn't take that photo. Please try again.");
    }
  };

  const retake = () => update({ selfieUri: null });

  const subtitle = (
    <Text style={styles.subtitle}>
      Take a quick selfie so we can confirm you're a real person. This is not shown on your profile.
    </Text>
  );

  // Permission still loading.
  if (!perm) {
    return (
      <ApplyScaffold title="Verify it's you" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount} scroll={false}>
        {subtitle}
      </ApplyScaffold>
    );
  }

  // Permission not yet granted — ask for it.
  if (!perm.granted) {
    return (
      <ApplyScaffold title="Verify it's you" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount} scroll={false}>
        {subtitle}
        <View style={styles.centerFill}>
          <Text style={styles.permText}>We need camera access to verify it's really you.</Text>
          <View style={styles.permBtn}>
            <TealButton label="Allow camera" onPress={requestPermission} />
          </View>
        </View>
      </ApplyScaffold>
    );
  }

  const captured = !!data.selfieUri;

  return (
    <ApplyScaffold title="Verify it's you" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount} scroll={false}>
      {subtitle}

      <View style={styles.body}>
        <View style={styles.frame}>
          {captured ? (
            <Image source={{ uri: data.selfieUri! }} style={styles.fill} resizeMode="cover" />
          ) : (
            <CameraView ref={cameraRef} style={styles.fill} facing="front" />
          )}
        </View>

        {captured ? (
          <TouchableOpacity onPress={retake} activeOpacity={0.7} style={styles.retakeBtn} accessibilityRole="button">
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={takeSelfie}
            activeOpacity={0.8}
            style={styles.captureOuter}
            accessibilityRole="button"
            accessibilityLabel="Take selfie"
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ marginTop: 20 }}>
        <TealButton label="Next" onPress={onNext} disabled={!data.selfieUri} />
      </View>
    </ApplyScaffold>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: APPLY.textSecondary,
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 24,
  },
  body: {
    alignItems: 'center',
  },
  frame: {
    width: '100%',
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: APPLY.surface,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  captureOuter: {
    marginTop: 28,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  retakeBtn: {
    marginTop: 28,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retakeText: {
    color: APPLY.teal,
    fontSize: 17,
    fontWeight: '700',
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permText: {
    color: APPLY.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  permBtn: {
    alignSelf: 'stretch',
    paddingHorizontal: 20,
  },
});
