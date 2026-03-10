import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { getMeetingNotes, createMeetingNote, updateMeetingNote, deleteMeetingNote, MeetingNote } from '../../services/meetingNotesService';
import { useTheme } from '../../theme/ThemeContext';
import { getThemedStyles } from '../../theme/themedStyles';
import GrainTexture from '../../components/ui/GrainTexture';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';

interface MeetingNotesScreenProps {
  pursuitId: string;
  onBack: () => void;
}

export default function MeetingNotesScreen({ pursuitId, onBack }: MeetingNotesScreenProps) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<MeetingNote | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [agenda, setAgenda] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [attendees, setAttendees] = useState('');

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    setLoading(true);
    const fetchedNotes = await getMeetingNotes(pursuitId);
    setNotes(fetchedNotes);
    setLoading(false);
  };

  const handleAddNote = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a meeting title');
      return;
    }

    if (!meetingDate.trim()) {
      Alert.alert('Error', 'Please enter a meeting date');
      return;
    }

    const attendeesList = attendees.trim() ? attendees.split(',').map(a => a.trim()) : [];

    const newNote = await createMeetingNote(
      pursuitId,
      title,
      meetingDate,
      agenda,
      noteContent,
      attendeesList
    );

    if (newNote) {
      setNotes([newNote, ...notes]);
      resetForm();
      setShowAddModal(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    Alert.alert(
      'Delete Meeting Note',
      'Are you sure you want to delete this meeting note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteMeetingNote(noteId);
            if (success) {
              await loadNotes();
              setShowDetailModal(false);
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setTitle('');
    setMeetingDate('');
    setAgenda('');
    setNoteContent('');
    setAttendees('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const primaryColor = isNewTheme ? colors.accentGreen : legacyColors.primary;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: primaryColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Meeting Notes</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.addButton, { backgroundColor: primaryColor }]}>
          <Text style={styles.addButtonText}>+ New Note</Text>
        </TouchableOpacity>
      </View>

      {/* Notes List */}
      <ScrollView style={styles.scrollView}>
        {notes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No meeting notes yet</Text>
            <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>Tap "+ New Note" to create your first meeting note</Text>
          </View>
        ) : (
          notes.map((note) => (
            <TouchableOpacity
              key={note.id}
              style={[styles.noteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                setSelectedNote(note);
                setShowDetailModal(true);
              }}
            >
              <View style={styles.noteHeader}>
                <Text style={[styles.noteTitle, { color: colors.textPrimary }]}>{note.title}</Text>
                <Text style={[styles.noteDate, { color: colors.textSecondary }]}>{formatDate(note.meeting_date)}</Text>
              </View>

              {note.agenda && (
                <Text style={[styles.notePreview, { color: colors.textSecondary }]} numberOfLines={2}>
                  📋 {note.agenda}
                </Text>
              )}

              {note.attendees && note.attendees.length > 0 && (
                <View style={styles.attendeesRow}>
                  <Text style={[styles.attendeesLabel, { color: primaryColor }]}>👥 {note.attendees.length} attendees</Text>
                </View>
              )}

              <Text style={[styles.tapHint, { color: primaryColor }]}>Tap to view details →</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add Note Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>New Meeting Note</Text>

            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
              placeholder="Meeting Title *"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
              placeholder="Date (e.g., 2024-01-15) *"
              placeholderTextColor={colors.textTertiary}
              value={meetingDate}
              onChangeText={setMeetingDate}
            />

            <TextInput
              style={[styles.input, styles.textArea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
              placeholder="Agenda (optional)"
              placeholderTextColor={colors.textTertiary}
              value={agenda}
              onChangeText={setAgenda}
              multiline
              numberOfLines={3}
            />

            <TextInput
              style={[styles.input, styles.textArea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
              placeholder="Meeting Notes (optional)"
              placeholderTextColor={colors.textTertiary}
              value={noteContent}
              onChangeText={setNoteContent}
              multiline
              numberOfLines={4}
            />

            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
              placeholder="Attendees (comma-separated, optional)"
              placeholderTextColor={colors.textTertiary}
              value={attendees}
              onChangeText={setAttendees}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.createButton, { backgroundColor: primaryColor }]} onPress={handleAddNote}>
                <Text style={styles.createButtonText}>Create Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {selectedNote && (
              <>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{selectedNote.title}</Text>
                <Text style={[styles.detailDate, { color: colors.textSecondary }]}>{formatDate(selectedNote.meeting_date)}</Text>

                {selectedNote.agenda && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>📋 Agenda</Text>
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>{selectedNote.agenda}</Text>
                  </View>
                )}

                {selectedNote.notes && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>📝 Notes</Text>
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>{selectedNote.notes}</Text>
                  </View>
                )}

                {selectedNote.attendees && selectedNote.attendees.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>👥 Attendees</Text>
                    {selectedNote.attendees.map((attendee, index) => (
                      <Text key={index} style={[styles.attendeeItem, { color: colors.textSecondary }]}>• {attendee}</Text>
                    ))}
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.deleteButtonModal}
                    onPress={() => handleDeleteNote(selectedNote.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.closeButton, { backgroundColor: primaryColor }]}
                    onPress={() => setShowDetailModal(false)}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#D0D8D4',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2D5A45',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  addButton: {
    backgroundColor: '#2D5A45',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B6B6B',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D0D8D4',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  noteDate: {
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '600',
  },
  notePreview: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 8,
  },
  attendeesRow: {
    marginBottom: 8,
  },
  attendeesLabel: {
    fontSize: 13,
    color: '#2D5A45',
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 12,
    color: '#2D5A45',
    fontWeight: '600',
    textAlign: 'right',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  detailDate: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D8D4',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3D3D3D',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 15,
    color: '#6B6B6B',
    lineHeight: 22,
  },
  attendeeItem: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D8D4',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  createButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2D5A45',
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButtonModal: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2D5A45',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
