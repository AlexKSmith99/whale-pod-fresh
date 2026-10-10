import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ApplyScaffold from '../components/ApplyScaffold';
import TealButton from '../components/TealButton';
import { AppAlert } from '../../../components/ui/AppAlert';
import { APPLY } from '../applyTheme';
import { StepProps } from '../types';

const MAX_PHOTOS = 6;

export default function UploadPhotosStep({ data, update, onNext, onBack, stepIndex, stepCount }: StepProps) {
  const pickImage = async () => {
    if (data.photos.length >= MAX_PHOTOS) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        AppAlert.alert('Permission needed', 'We need access to your photos so you can add them to your application.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const next = [...data.photos, result.assets[0].uri].slice(0, MAX_PHOTOS);
        update({ photos: next });
      }
    } catch (err) {
      console.error('Error picking image:', err);
      AppAlert.alert('Error', 'Something went wrong picking that photo. Please try again.');
    }
  };

  const removePhoto = (index: number) => {
    const next = data.photos.filter((_, i) => i !== index);
    update({ photos: next });
  };

  // Build the six grid slots: filled photos, then a single "add" tile, then empty placeholders.
  const slots = Array.from({ length: MAX_PHOTOS }).map((_, i) => {
    if (i < data.photos.length) return { kind: 'photo' as const, uri: data.photos[i], index: i };
    if (i === data.photos.length) return { kind: 'add' as const };
    return { kind: 'empty' as const };
  });

  return (
    <ApplyScaffold title="Upload Photos" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount}>
      <Text style={styles.subtitle}>
        Upload up to 6 photos that include you.{'\n\n'}They'll be shown in the Waiting List to existing members. The preferences they receive may influence review timing.
      </Text>

      <View style={styles.grid}>
        {slots.map((slot, i) => {
          if (slot.kind === 'photo') {
            return (
              <View key={i} style={styles.slot}>
                <Image source={{ uri: slot.uri }} style={styles.photo} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removePhoto(slot.index)}
                  activeOpacity={0.8}
                  accessibilityLabel="Remove photo"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            );
          }
          if (slot.kind === 'add') {
            return (
              <TouchableOpacity
                key={i}
                style={[styles.slot, styles.addSlot]}
                onPress={pickImage}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Add picture"
              >
                <Ionicons name="add" size={30} color={APPLY.textSecondary} />
                <Text style={styles.addLabel}>Add picture</Text>
              </TouchableOpacity>
            );
          }
          return <View key={i} style={[styles.slot, styles.emptySlot]} />;
        })}
      </View>

      <View style={{ marginTop: 28 }}>
        <TealButton label="Next" onPress={onNext} disabled={data.photos.length < 1} />
      </View>
    </ApplyScaffold>
  );
}

const GAP = 12;
// Scaffold content has 20px horizontal padding; three columns with two 12px gaps.
const SCREEN_WIDTH = Dimensions.get('window').width;
const SLOT_WIDTH = (SCREEN_WIDTH - 40 - GAP * 2) / 3;

const styles = StyleSheet.create({
  subtitle: {
    color: APPLY.textSecondary,
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  slot: {
    width: SLOT_WIDTH,
    aspectRatio: 0.8,
    borderRadius: 14,
    backgroundColor: APPLY.surface,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: APPLY.border,
    borderStyle: 'dashed',
  },
  addLabel: {
    color: APPLY.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  emptySlot: {
    backgroundColor: APPLY.surface,
  },
});
