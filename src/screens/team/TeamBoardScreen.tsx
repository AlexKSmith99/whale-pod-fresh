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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { teamBoardService } from '../../services/teamBoardService';

interface Props {
  pursuitId: string;
  onBack: () => void;
  onViewProfile?: (userId: string) => void;
}

export default function TeamBoardScreen({ pursuitId, onBack, onViewProfile }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);

  // Meeting agenda state
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [editingAgenda, setEditingAgenda] = useState(false);
  const [kickoffMeetingId, setKickoffMeetingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTasks(),
        loadTeamMembers(),
        loadMeetingAgenda(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('board_tasks')
        .select('*, assigned_to_profile:profiles!assigned_to(name, profile_picture)')
        .eq('pursuit_id', pursuitId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('user_id, profiles!user_id(id, name, profile_picture, email)')
        .eq('pursuit_id', pursuitId);

      if (error) throw error;

      // Get creator too
      const { data: pursuit } = await supabase
        .from('pursuits')
        .select('creator_id, profiles!creator_id(id, name, profile_picture, email)')
        .eq('id', pursuitId)
        .single();

      const members = data?.map((m: any) => m.profiles) || [];
      if (pursuit?.profiles) {
        members.unshift(pursuit.profiles);
      }

      // Remove duplicates
      const uniqueMembers = members.filter((member: any, index: number, self: any[]) =>
        index === self.findIndex((m: any) => m.id === member.id)
      );

      setTeamMembers(uniqueMembers);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const loadMeetingAgenda = async () => {
    try {
      const { data, error } = await supabase
        .from('kickoff_meetings')
        .select('id, meeting_agenda')
        .eq('pursuit_id', pursuitId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

      if (data) {
        setKickoffMeetingId(data.id);
        setMeetingAgenda(data.meeting_agenda || '');
      }
    } catch (error) {
      console.error('Error loading meeting agenda:', error);
    }
  };

  const saveMeetingAgenda = async () => {
    if (!kickoffMeetingId) {
      Alert.alert('Error', 'No kick-off meeting found for this pursuit');
      return;
    }

    try {
      const { error } = await supabase
        .from('kickoff_meetings')
        .update({ meeting_agenda: meetingAgenda })
        .eq('id', kickoffMeetingId);

      if (error) throw error;

      Alert.alert('Success', 'Meeting agenda saved!');
      setEditingAgenda(false);
    } catch (error: any) {
      console.error('Error saving meeting agenda:', error);
      Alert.alert('Error', error.message || 'Failed to save meeting agenda');
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('board_tasks')
        .insert([{
          pursuit_id: pursuitId,
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || null,
          status: 'todo',
          priority: newTaskPriority,
          assigned_to: selectedParticipant,
        }])
        .select('*, assigned_to_profile:profiles!assigned_to(name, profile_picture)')
        .single();

      if (error) throw error;

      setTasks([data, ...tasks]);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('medium');
      setSelectedParticipant(null);
      setShowCreateModal(false);
      Alert.alert('Success', 'Task created!');
    } catch (error: any) {
      console.error('Error creating task:', error);
      Alert.alert('Error', 'Failed to create task');
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => {
    try {
      const { error } = await supabase
        .from('board_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('board_tasks')
                .delete()
                .eq('id', taskId);

              if (error) throw error;
              setTasks(tasks.filter(task => task.id !== taskId));
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task');
            }
          },
        },
      ]
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const renderTask = (task: any) => {
    const canMoveLeft = task.status === 'in_progress' || task.status === 'done';
    const canMoveRight = task.status === 'todo' || task.status === 'in_progress';

    return (
      <View key={task.id} style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
            <Text style={styles.priorityText}>{task.priority.toUpperCase()}</Text>
          </View>
        </View>

        {task.description && (
          <Text style={styles.taskDescription}>{task.description}</Text>
        )}

        {task.assigned_to && task.assigned_to_profile && (
          <TouchableOpacity
            style={styles.assignedToContainer}
            onPress={() => onViewProfile?.(task.assigned_to)}
          >
            {task.assigned_to_profile.profile_picture ? (
              <Image
                source={{ uri: task.assigned_to_profile.profile_picture }}
                style={styles.assignedAvatar}
              />
            ) : (
              <View style={styles.assignedAvatar}>
                <Text style={styles.assignedAvatarText}>
                  {task.assigned_to_profile.name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <Text style={styles.assignedName}>
              {task.assigned_to_profile.name || 'Unknown'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.taskActions}>
          {canMoveLeft && (
            <TouchableOpacity
              style={styles.moveButton}
              onPress={() => {
                const newStatus = task.status === 'done' ? 'in_progress' : 'todo';
                handleUpdateStatus(task.id, newStatus);
              }}
            >
              <Text style={styles.moveButtonText}>← Move Left</Text>
            </TouchableOpacity>
          )}

          {canMoveRight && (
            <TouchableOpacity
              style={styles.moveButton}
              onPress={() => {
                const newStatus = task.status === 'todo' ? 'in_progress' : 'done';
                handleUpdateStatus(task.id, newStatus);
              }}
            >
              <Text style={styles.moveButtonText}>Move Right →</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteTask(task.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const doneTasks = tasks.filter(t => t.status === 'done');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Board</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Meeting Agenda Section */}
      {kickoffMeetingId && (
        <View style={styles.agendaSection}>
          <View style={styles.agendaSectionHeader}>
            <View style={styles.agendaTitleRow}>
              <Ionicons name="document-text" size={20} color="#3b82f6" />
              <Text style={styles.agendaSectionTitle}>Pre-Meeting Agenda</Text>
            </View>
            {!editingAgenda ? (
              <TouchableOpacity onPress={() => setEditingAgenda(true)} style={styles.editButton}>
                <Ionicons name="create" size={18} color="#3b82f6" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={saveMeetingAgenda} style={styles.saveButton}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            )}
          </View>
          {editingAgenda ? (
            <TextInput
              style={styles.agendaInput}
              placeholder="Add topics, goals, and discussion points for the kick-off meeting..."
              value={meetingAgenda}
              onChangeText={setMeetingAgenda}
              multiline
              numberOfLines={6}
            />
          ) : (
            <Text style={styles.agendaText}>
              {meetingAgenda || 'No agenda set yet. Click Edit to add topics for the upcoming kick-off meeting.'}
            </Text>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.boardContainer}>
        {/* To Do Column */}
        <View style={styles.column}>
          <View style={styles.columnHeader}>
            <Text style={styles.columnTitle}>📋 To Do</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{todoTasks.length}</Text>
            </View>
          </View>
          <ScrollView style={styles.columnScroll}>
            {todoTasks.map(renderTask)}
          </ScrollView>
        </View>

        {/* In Progress Column */}
        <View style={styles.column}>
          <View style={[styles.columnHeader, { backgroundColor: '#dbeafe' }]}>
            <Text style={styles.columnTitle}>🔄 In Progress</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{inProgressTasks.length}</Text>
            </View>
          </View>
          <ScrollView style={styles.columnScroll}>
            {inProgressTasks.map(renderTask)}
          </ScrollView>
        </View>

        {/* Done Column */}
        <View style={styles.column}>
          <View style={[styles.columnHeader, { backgroundColor: '#d1fae5' }]}>
            <Text style={styles.columnTitle}>✅ Done</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{doneTasks.length}</Text>
            </View>
          </View>
          <ScrollView style={styles.columnScroll}>
            {doneTasks.map(renderTask)}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Create Task Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Task</Text>

            <TextInput
              style={styles.input}
              placeholder="Task Title *"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              value={newTaskDescription}
              onChangeText={setNewTaskDescription}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityButtons}>
              {(['low', 'medium', 'high'] as const).map((priority) => (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.priorityButton,
                    newTaskPriority === priority && styles.priorityButtonActive,
                    { borderColor: getPriorityColor(priority) }
                  ]}
                  onPress={() => setNewTaskPriority(priority)}
                >
                  <Text style={[
                    styles.priorityButtonText,
                    newTaskPriority === priority && { color: getPriorityColor(priority) }
                  ]}>
                    {priority.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Assign To (optional)</Text>
            <ScrollView style={styles.participantsList} horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.participantButton,
                  selectedParticipant === null && styles.participantButtonActive
                ]}
                onPress={() => setSelectedParticipant(null)}
              >
                <Text style={[
                  styles.participantButtonText,
                  selectedParticipant === null && styles.participantButtonTextActive
                ]}>
                  Unassigned
                </Text>
              </TouchableOpacity>
              {teamMembers.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.participantButton,
                    selectedParticipant === member.id && styles.participantButtonActive
                  ]}
                  onPress={() => setSelectedParticipant(member.id)}
                >
                  {member.profile_picture ? (
                    <Image
                      source={{ uri: member.profile_picture }}
                      style={styles.participantAvatar}
                    />
                  ) : (
                    <View style={styles.participantAvatar}>
                      <Text style={styles.participantAvatarText}>
                        {member.name?.charAt(0).toUpperCase() ||
                         member.email?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <Text style={[
                    styles.participantButtonText,
                    selectedParticipant === member.id && styles.participantButtonTextActive
                  ]}>
                    {member.name || member.email?.split('@')[0] || 'Unknown'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewTaskTitle('');
                  setNewTaskDescription('');
                  setNewTaskPriority('medium');
                  setSelectedParticipant(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.createButton} onPress={handleCreateTask}>
                <Text style={styles.createButtonText}>Create Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  addButton: {
    backgroundColor: '#3b82f6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agendaSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  agendaSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  agendaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agendaSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  editButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  agendaInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  agendaText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  boardContainer: {
    flex: 1,
  },
  column: {
    width: 300,
    marginHorizontal: 8,
    marginVertical: 16,
  },
  columnHeader: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  countBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  columnScroll: {
    flex: 1,
  },
  taskCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  taskDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  assignedToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  assignedAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  assignedAvatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  assignedName: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  moveButton: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  moveButtonText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: '#f9fafb',
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  participantsList: {
    maxHeight: 100,
    marginBottom: 24,
  },
  participantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  participantButtonActive: {
    borderColor: '#0ea5e9',
    backgroundColor: '#eff6ff',
  },
  participantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  participantAvatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  participantButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  participantButtonTextActive: {
    color: '#0ea5e9',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  createButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
