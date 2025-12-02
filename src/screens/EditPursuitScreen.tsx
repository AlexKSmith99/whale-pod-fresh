import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { pursuitService } from '../services/pursuitService';

interface Props {
  pursuit: any;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export default function EditPursuitScreen({ pursuit, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState(pursuit.title || '');
  const [description, setDescription] = useState(pursuit.description || '');
  const [teamSizeMin, setTeamSizeMin] = useState(String(pursuit.team_size_min || 2));
  const [teamSizeMax, setTeamSizeMax] = useState(String(pursuit.team_size_max || 8));
  const [meetingCadence, setMeetingCadence] = useState(pursuit.meeting_cadence || '');
  const [location, setLocation] = useState(pursuit.location || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    // Validation
    if (!title || !description || !meetingCadence) {
      Alert.alert('Missing Fields', 'Please fill in all required fields');
      return;
    }

    if (description.length < 50) {
      Alert.alert('Description Too Short', 'Description must be at least 50 characters');
      return;
    }

    const minSize = parseInt(teamSizeMin);
    const maxSize = parseInt(teamSizeMax);

    if (minSize > maxSize) {
      Alert.alert('Invalid Team Size', 'Minimum team size cannot be greater than maximum');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('pursuits')
        .update({
          title,
          description,
          team_size_min: minSize,
          team_size_max: maxSize,
          meeting_cadence: meetingCadence,
          location,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pursuit.id);

      if (error) throw error;

      Alert.alert('Success', 'Pursuit updated successfully!', [
        {
          text: 'OK',
          onPress: () => {
            onSaved();
            onClose();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error updating pursuit:', error);
      Alert.alert('Error', error.message || 'Failed to update pursuit');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Pursuit',
      'Are you sure you want to delete this pursuit? This action cannot be undone. All team members will be removed and all data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await pursuitService.deletePursuit(pursuit.id);
              Alert.alert('Deleted', 'Pursuit deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => {
                    onDeleted();
                    onClose();
                  },
                },
              ]);
            } catch (error: any) {
              console.error('Error deleting pursuit:', error);
              Alert.alert('Error', error.message || 'Failed to delete pursuit');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (deleting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Deleting pursuit...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Pursuit</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Weekly Book Club"
            maxLength={100}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.hint}>Minimum 50 characters</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your pursuit in detail..."
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length} / 50 min</Text>
        </View>

        {/* Team Size */}
        <View style={styles.section}>
          <Text style={styles.label}>Team Size</Text>
          <Text style={styles.hint}>
            Current members: {pursuit.current_members_count} (cannot be edited)
          </Text>
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.subLabel}>Min</Text>
              <TextInput
                style={styles.input}
                value={teamSizeMin}
                onChangeText={setTeamSizeMin}
                keyboardType="numeric"
                placeholder="2"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.subLabel}>Max</Text>
              <TextInput
                style={styles.input}
                value={teamSizeMax}
                onChangeText={setTeamSizeMax}
                keyboardType="numeric"
                placeholder="8"
              />
            </View>
          </View>
        </View>

        {/* Meeting Cadence */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Meeting Cadence <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={meetingCadence}
            onChangeText={setMeetingCadence}
            placeholder="e.g., Weekly on Mondays at 7pm"
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g., San Francisco, CA or Remote"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteButtonText}>Delete Pursuit</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  hint: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 6,
  },
  saveButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
