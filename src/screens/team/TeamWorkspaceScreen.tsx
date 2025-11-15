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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  onBack: () => void;
  initialPursuitId?: string;
}

type SubTab = 'agenda' | 'roles' | 'media';

export default function TeamWorkspaceScreen({ onBack, initialPursuitId }: Props) {
  const { user } = useAuth();
  const [pods, setPods] = useState<any[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('agenda');
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [showContributeModal, setShowContributeModal] = useState(false);

  // Contribute modal state
  const [contributionType, setContributionType] = useState<'pre-meeting agenda' | 'question' | 'comment' | 'meeting notes' | 'task'>('pre-meeting agenda');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [contributionTime, setContributionTime] = useState('');
  const [contributionContent, setContributionContent] = useState('');
  const [submittingContribution, setSubmittingContribution] = useState(false);

  useEffect(() => {
    loadUserPods();
  }, []);

  useEffect(() => {
    if (selectedPodId) {
      loadPodData();
    }
  }, [selectedPodId, activeSubTab]);

  const loadUserPods = async () => {
    if (!user) return;

    try {
      // Get pods where user is creator
      const { data: createdPods } = await supabase
        .from('pursuits')
        .select('id, title')
        .eq('creator_id', user.id)
        .order('title');

      // Get pods where user is member
      const { data: memberships } = await supabase
        .from('team_members')
        .select('pursuit_id, pursuits(id, title)')
        .eq('user_id', user.id);

      const memberPods = memberships?.map((m: any) => m.pursuits).filter(Boolean) || [];

      const allPods = [
        ...(createdPods || []),
        ...memberPods
      ];

      // Remove duplicates
      const uniquePods = allPods.filter((pod, index, self) =>
        index === self.findIndex((p) => p.id === pod.id)
      );

      setPods(uniquePods);

      if (uniquePods.length > 0 && !selectedPodId) {
        // Use initial pursuit ID if provided, otherwise select first pod
        const podToSelect = initialPursuitId && uniquePods.find(p => p.id === initialPursuitId)
          ? initialPursuitId
          : uniquePods[0].id;
        setSelectedPodId(podToSelect);
      }
    } catch (error) {
      console.error('Error loading pods:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPodData = async () => {
    if (!selectedPodId) return;

    try {
      // Load team members
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, profiles!user_id(id, name, email)')
        .eq('pursuit_id', selectedPodId);

      const { data: pursuit } = await supabase
        .from('pursuits')
        .select('creator_id, profiles!creator_id(id, name, email)')
        .eq('id', selectedPodId)
        .single();

      const allMembers = [...(members?.map((m: any) => m.profiles) || [])];
      if (pursuit?.profiles) {
        allMembers.unshift(pursuit.profiles);
      }

      // Remove duplicates
      const uniqueMembers = allMembers.filter((member, index, self) =>
        index === self.findIndex((m) => m.id === member.id)
      );

      setTeamMembers(uniqueMembers);

      // Load data based on active tab
      if (activeSubTab === 'agenda') {
        await loadContributions();
      } else if (activeSubTab === 'roles') {
        await loadRoles();
      }
    } catch (error) {
      console.error('Error loading pod data:', error);
    }
  };

  const loadContributions = async () => {
    if (!selectedPodId) return;

    try {
      const { data, error } = await supabase
        .from('meeting_contributions')
        .select('*, profiles!user_id(name, email)')
        .eq('pursuit_id', selectedPodId)
        .order('meeting_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContributions(data || []);
    } catch (error) {
      console.error('Error loading contributions:', error);
    }
  };

  const loadRoles = async () => {
    if (!selectedPodId) return;

    try {
      const { data, error } = await supabase
        .from('member_roles')
        .select('*, profiles!user_id(name, email)')
        .eq('pursuit_id', selectedPodId);

      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const getUserInitials = (profile: any) => {
    if (profile?.name) {
      const names = profile.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}.${names[1][0]}.`;
      }
      return `${names[0][0]}.`;
    }
    return profile?.email?.[0].toUpperCase() || '?';
  };

  const handleCreateContribution = async () => {
    if (!selectedPodId || !user) return;

    if (!contributionContent.trim()) {
      Alert.alert('Error', 'Please enter contribution content');
      return;
    }

    if (!meetingDate) {
      Alert.alert('Error', 'Please select a meeting date');
      return;
    }

    setSubmittingContribution(true);

    try {
      const { data, error } = await supabase
        .from('meeting_contributions')
        .insert([{
          pursuit_id: selectedPodId,
          user_id: user.id,
          meeting_date: meetingDate,
          meeting_title: meetingTitle.trim() || null,
          contribution_type: contributionType,
          content: contributionContent.trim(),
          time_of_contribution: contributionTime || null,
        }])
        .select('*, profiles!user_id(name, email)')
        .single();

      if (error) throw error;

      // Add new contribution to state
      setContributions([data, ...contributions]);

      // Reset form
      setContributionContent('');
      setMeetingTitle('');
      setContributionTime('');
      setContributionType('pre-meeting agenda');
      setMeetingDate(new Date().toISOString().split('T')[0]);
      setShowContributeModal(false);

      Alert.alert('Success', 'Contribution added!');
    } catch (error: any) {
      console.error('Error creating contribution:', error);
      Alert.alert('Error', 'Failed to add contribution');
    } finally {
      setSubmittingContribution(false);
    }
  };

  const renderAgendaTab = () => {
    // Group contributions by meeting date
    const contributionsByDate: { [key: string]: any[] } = {};
    contributions.forEach((contrib) => {
      const date = contrib.meeting_date;
      if (!contributionsByDate[date]) {
        contributionsByDate[date] = [];
      }
      contributionsByDate[date].push(contrib);
    });

    return (
      <ScrollView style={styles.tabContent}>
        <TouchableOpacity
          style={styles.contributeButton}
          onPress={() => setShowContributeModal(true)}
        >
          <Ionicons name="add-circle" size={20} color="#ff6b35" />
          <Text style={styles.contributeButtonText}>+ Contribute</Text>
        </TouchableOpacity>

        {Object.keys(contributionsByDate).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No contributions yet</Text>
            <Text style={styles.emptyHint}>Click "+ Contribute" to add agenda items, notes, or questions</Text>
          </View>
        ) : (
          Object.keys(contributionsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map((date) => (
            <View key={date} style={styles.meetingSection}>
              <View style={styles.meetingSectionHeader}>
                <Text style={styles.meetingDate}>
                  {new Date(date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
                {contributionsByDate[date][0].meeting_title && (
                  <Text style={styles.meetingTitle}>{contributionsByDate[date][0].meeting_title}</Text>
                )}
              </View>

              {contributionsByDate[date].map((contrib) => (
                <View key={contrib.id} style={styles.contributionCard}>
                  <View style={styles.contributionHeader}>
                    <View style={styles.contributionTypeContainer}>
                      <Text style={styles.contributionType}>{contrib.contribution_type}</Text>
                      {contrib.time_of_contribution && (
                        <Text style={styles.contributionTime}>
                          {contrib.time_of_contribution}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.contributionInitials}>
                      {getUserInitials(contrib.profiles)}
                      {contrib.is_edited && <Text style={styles.editedLabel}> (edited)</Text>}
                    </Text>
                  </View>
                  <Text style={styles.contributionContent}>{contrib.content}</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderRolesTab = () => {
    return (
      <ScrollView style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Team Member Roles</Text>

        {teamMembers.map((member) => {
          const memberRole = roles.find((r) => r.user_id === member.id);

          return (
            <View key={member.id} style={styles.roleCard}>
              <View style={styles.roleHeader}>
                <Text style={styles.memberName}>{member.name || member.email}</Text>
              </View>
              {memberRole ? (
                <View style={styles.roleContent}>
                  <Text style={styles.roleTitle}>{memberRole.role_title}</Text>
                  {memberRole.role_description && (
                    <Text style={styles.roleDescription}>{memberRole.role_description}</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.noRole}>No role assigned</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderMediaTab = () => {
    return (
      <ScrollView style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Shared Media</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Coming soon</Text>
          <Text style={styles.emptyHint}>Upload and organize pictures and videos</Text>
        </View>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6b35" />
      </View>
    );
  }

  const selectedPod = pods.find((p) => p.id === selectedPodId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Workspace</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Left Sidebar - Pod Tabs */}
        <View style={styles.sidebar}>
          <Text style={styles.sidebarTitle}>My Pods</Text>
          <ScrollView style={styles.podList}>
            {pods.map((pod) => (
              <TouchableOpacity
                key={pod.id}
                style={[
                  styles.podTab,
                  selectedPodId === pod.id && styles.podTabActive
                ]}
                onPress={() => setSelectedPodId(pod.id)}
              >
                <Text style={[
                  styles.podTabText,
                  selectedPodId === pod.id && styles.podTabTextActive
                ]}>
                  {pod.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Main Content Area */}
        <View style={styles.mainContent}>
          {selectedPod && (
            <>
              {/* Sub-tabs */}
              <View style={styles.subTabs}>
                <TouchableOpacity
                  style={[
                    styles.subTab,
                    activeSubTab === 'agenda' && styles.subTabActive
                  ]}
                  onPress={() => setActiveSubTab('agenda')}
                >
                  <Text style={[
                    styles.subTabText,
                    activeSubTab === 'agenda' && styles.subTabTextActive
                  ]}>
                    Agenda
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.subTab,
                    activeSubTab === 'roles' && styles.subTabActive
                  ]}
                  onPress={() => setActiveSubTab('roles')}
                >
                  <Text style={[
                    styles.subTabText,
                    activeSubTab === 'roles' && styles.subTabTextActive
                  ]}>
                    Member Roles
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.subTab,
                    activeSubTab === 'media' && styles.subTabActive
                  ]}
                  onPress={() => setActiveSubTab('media')}
                >
                  <Text style={[
                    styles.subTabText,
                    activeSubTab === 'media' && styles.subTabTextActive
                  ]}>
                    Shared Media
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab Content */}
              {activeSubTab === 'agenda' && renderAgendaTab()}
              {activeSubTab === 'roles' && renderRolesTab()}
              {activeSubTab === 'media' && renderMediaTab()}
            </>
          )}
        </View>
      </View>

      {/* Contribute Modal */}
      <Modal visible={showContributeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make a Contribution</Text>
              <TouchableOpacity onPress={() => setShowContributeModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Contribution Type */}
              <Text style={styles.fieldLabel}>Contribution Type *</Text>
              <View style={styles.typeButtons}>
                {(['pre-meeting agenda', 'question', 'comment', 'meeting notes', 'task'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      contributionType === type && styles.typeButtonActive
                    ]}
                    onPress={() => setContributionType(type)}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      contributionType === type && styles.typeButtonTextActive
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Meeting Date */}
              <Text style={styles.fieldLabel}>Meeting Date *</Text>
              <TextInput
                style={styles.input}
                value={meetingDate}
                onChangeText={setMeetingDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#666"
              />

              {/* Meeting Title */}
              <Text style={styles.fieldLabel}>Meeting Title (optional)</Text>
              <TextInput
                style={styles.input}
                value={meetingTitle}
                onChangeText={setMeetingTitle}
                placeholder="e.g., Weekly Standup"
                placeholderTextColor="#666"
              />

              {/* Time */}
              <Text style={styles.fieldLabel}>Time (optional)</Text>
              <TextInput
                style={styles.input}
                value={contributionTime}
                onChangeText={setContributionTime}
                placeholder="e.g., 2:30 PM or 14:30"
                placeholderTextColor="#666"
              />

              {/* Content */}
              <Text style={styles.fieldLabel}>Content *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={contributionContent}
                onChangeText={setContributionContent}
                placeholder="Enter your contribution here..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={6}
              />

              {/* Media Upload - Coming Soon */}
              <Text style={styles.fieldLabel}>Media (coming soon)</Text>
              <View style={styles.comingSoon}>
                <Ionicons name="image-outline" size={24} color="#666" />
                <Text style={styles.comingSoonText}>Photo/Video upload coming soon</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowContributeModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateContribution}
                disabled={submittingContribution}
              >
                {submittingContribution ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
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
    backgroundColor: '#1a1a1a', // Charcoal black
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 2,
    borderBottomColor: '#ff6b35', // Orange accent
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', // Notebook feel
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  // Sidebar
  sidebar: {
    width: 200,
    backgroundColor: '#2a2a2a',
    borderRightWidth: 2,
    borderRightColor: '#ff6b35',
    padding: 16,
  },
  sidebarTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff6b35',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  podList: {
    flex: 1,
  },
  podTab: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#444',
  },
  podTabActive: {
    backgroundColor: '#ff6b35',
    borderColor: '#ff6b35',
  },
  podTabText: {
    fontSize: 14,
    color: '#ccc',
    fontWeight: '500',
  },
  podTabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Main Content
  mainContent: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  subTabs: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 2,
    borderBottomColor: '#ff6b35',
    paddingHorizontal: 16,
  },
  subTab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  subTabActive: {
    borderBottomColor: '#ff6b35',
  },
  subTabText: {
    fontSize: 15,
    color: '#999',
    fontWeight: '500',
  },
  subTabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  // Agenda Tab
  contributeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ff6b35',
    marginBottom: 20,
  },
  contributeButtonText: {
    color: '#ff6b35',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  meetingSection: {
    marginBottom: 30,
  },
  meetingSectionHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#ff6b35',
  },
  meetingDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  meetingTitle: {
    fontSize: 14,
    color: '#ff6b35',
    fontStyle: 'italic',
  },
  contributionCard: {
    backgroundColor: '#2a2a2a',
    padding: 14,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b35',
    marginBottom: 12,
  },
  contributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contributionTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contributionType: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ff6b35',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contributionTime: {
    fontSize: 11,
    color: '#999',
  },
  contributionInitials: {
    fontSize: 12,
    color: '#ccc',
    fontWeight: '600',
  },
  editedLabel: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
  },
  contributionContent: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  // Roles Tab
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff6b35',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  roleCard: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  roleHeader: {
    marginBottom: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  roleContent: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b35',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 18,
  },
  noRole: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ff6b35',
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#ff6b35',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalBody: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff6b35',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#1a1a1a',
  },
  typeButtonActive: {
    backgroundColor: '#ff6b35',
    borderColor: '#ff6b35',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#fff',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  comingSoon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    borderStyle: 'dashed',
  },
  comingSoonText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 2,
    borderTopColor: '#ff6b35',
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#999',
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#ff6b35',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
