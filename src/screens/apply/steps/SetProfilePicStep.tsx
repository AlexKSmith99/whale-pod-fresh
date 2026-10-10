import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApplyScaffold from '../components/ApplyScaffold';
import TealButton from '../components/TealButton';
import { APPLY } from '../applyTheme';
import { StepProps } from '../types';

export default function SetProfilePicStep({ data, update, onNext, onBack, stepIndex, stepCount, submitting }: StepProps) {
  const selected = data.profilePicIndex ?? 0;

  return (
    <ApplyScaffold title="Set profile picture" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount}>
      <Text style={styles.subtitle}>Choose which photo people see first.</Text>

      <View style={styles.grid}>
        {data.photos.map((uri, i) => {
          const isSelected = i === selected;
          return (
            <TouchableOpacity
              key={`${uri}-${i}`}
              style={[styles.slot, isSelected && styles.slotSelected]}
              onPress={() => update({ profilePicIndex: i })}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Photo ${i + 1}`}
            >
              <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
              {isSelected ? (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={15} color="#fff" />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ marginTop: 28 }}>
        <TealButton label="Next" onPress={onNext} loading={submitting} disabled={data.photos.length === 0} />
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  slotSelected: {
    borderColor: APPLY.teal,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: APPLY.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
