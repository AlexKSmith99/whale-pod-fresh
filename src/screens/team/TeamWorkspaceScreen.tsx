import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Dimensions,
  Image,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Paths, File as ExpoFile } from 'expo-file-system';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { galleryService, GalleryPhoto } from '../../services/galleryService';

const SIDEBAR_WIDTH = 220;

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
  const [mediaItems, setMediaItems] = useState<GalleryPhoto[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);

  // Contribute modal state
  const [contributionType, setContributionType] = useState<'pre-meeting agenda' | 'question' | 'comment' | 'meeting notes' | 'task'>('pre-meeting agenda');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [contributionTime, setContributionTime] = useState('');
  const [contributionContent, setContributionContent] = useState('');
  const [submittingContribution, setSubmittingContribution] = useState(false);
  const [editingContribution, setEditingContribution] = useState<any | null>(null);

  // Role assignment modal state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [roleTitle, setRoleTitle] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [submittingRole, setSubmittingRole] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(0)).current;

  // Image viewer state
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [savingImage, setSavingImage] = useState(false);
  const imageViewerRef = useRef<FlatList>(null);

  const toggleSidebar = () => {
    const toValue = sidebarOpen ? 0 : 1;
    Animated.timing(sidebarAnim, {
      toValue,
      duration: 250,
      useNativeDriver: false,
    }).start();
    setSidebarOpen(!sidebarOpen);
  };

  const selectPod = (podId: string) => {
    setSelectedPodId(podId);
    // Close sidebar after selection
    Animated.timing(sidebarAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
    setSidebarOpen(false);
  };

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
    if (!selectedPodId || !user) return;

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

      // Check if current user is creator
      if (pursuit?.creator_id) {
        setIsCreator(pursuit.creator_id === user.id);
      }

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
      } else if (activeSubTab === 'media') {
        await loadMedia();
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

  const loadMedia = async () => {
    if (!selectedPodId) return;

    try {
      const photos = await galleryService.getPhotos(selectedPodId);
      setMediaItems(photos);
    } catch (error) {
      console.error('Error loading media:', error);
    }
  };

  const pickMedia = async (useCamera: boolean) => {
    try {
      // Request permissions
      const { status } = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need permission to access your photos/camera');
        return;
      }

      // Launch picker
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: false,
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: false,
            quality: 0.7,
          });

      if (!result.canceled && result.assets[0]) {
        await uploadMedia(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  const uploadMedia = async (uri: string) => {
    if (!selectedPodId || !user) return;

    setUploadingMedia(true);
    try {
      await galleryService.uploadPhoto(selectedPodId, user.id, uri);
      await loadMedia();
      Alert.alert('Success', 'Photo uploaded!');
    } catch (error: any) {
      console.error('Error uploading media:', error);
      Alert.alert('Error', error.message || 'Failed to upload photo');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleDeleteMedia = async (photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await galleryService.deletePhoto(photoId);
              setMediaItems(mediaItems.filter(m => m.id !== photoId));
              Alert.alert('Success', 'Photo deleted');
            } catch (error) {
              console.error('Error deleting photo:', error);
              Alert.alert('Error', 'Failed to delete photo');
            }
          },
        },
      ]
    );
  };

  const openImageViewer = (index: number) => {
    setSelectedImageIndex(index);
    setShowImageViewer(true);
  };

  const saveImageToPhone = async (imageUrl: string) => {
    setSavingImage(true);
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need permission to save photos to your library');
        return;
      }

      // Create a file in the cache directory and download to it
      const filename = `photo_${Date.now()}.jpg`;
      const localFile = new ExpoFile(Paths.cache, filename);

      // Use the static downloadFileAsync method on File class
      await (ExpoFile as any).downloadFileAsync(imageUrl, localFile);

      // Save to media library
      await MediaLibrary.saveToLibraryAsync(localFile.uri);

      Alert.alert('Saved!', 'Photo saved to your photo library');
    } catch (error: any) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save photo to library');
    } finally {
      setSavingImage(false);
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

  const handleEditContribution = (contribution: any) => {
    setEditingContribution(contribution);
    setContributionType(contribution.contribution_type);
    setMeetingDate(contribution.meeting_date);
    setMeetingTitle(contribution.meeting_title || '');
    setContributionTime(contribution.time_of_contribution || '');
    setContributionContent(contribution.content);
    setShowContributeModal(true);
  };

  const handleUpdateContribution = async () => {
    if (!editingContribution || !user) return;

    if (!contributionContent.trim()) {
      Alert.alert('Error', 'Please enter contribution content');
      return;
    }

    setSubmittingContribution(true);

    try {
      const { data, error } = await supabase
        .from('meeting_contributions')
        .update({
          contribution_type: contributionType,
          meeting_date: meetingDate,
          meeting_title: meetingTitle.trim() || null,
          content: contributionContent.trim(),
          time_of_contribution: contributionTime || null,
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingContribution.id)
        .select('*, profiles!user_id(name, email)')
        .single();

      if (error) throw error;

      // Update contribution in state
      setContributions(contributions.map(c => c.id === data.id ? data : c));

      // Reset form
      setContributionContent('');
      setMeetingTitle('');
      setContributionTime('');
      setContributionType('pre-meeting agenda');
      setMeetingDate(new Date().toISOString().split('T')[0]);
      setEditingContribution(null);
      setShowContributeModal(false);

      Alert.alert('Success', 'Contribution updated!');
    } catch (error: any) {
      console.error('Error updating contribution:', error);
      Alert.alert('Error', 'Failed to update contribution');
    } finally {
      setSubmittingContribution(false);
    }
  };

  const handleDeleteContribution = async (contributionId: string) => {
    Alert.alert(
      'Delete Contribution',
      'Are you sure you want to delete this contribution?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('meeting_contributions')
                .delete()
                .eq('id', contributionId);

              if (error) throw error;

              setContributions(contributions.filter(c => c.id !== contributionId));
              Alert.alert('Success', 'Contribution deleted');
            } catch (error) {
              console.error('Error deleting contribution:', error);
              Alert.alert('Error', 'Failed to delete contribution');
            }
          },
        },
      ]
    );
  };

  const handleOpenRoleModal = (member: any, existingRole?: any) => {
    setEditingRole(existingRole ? { ...existingRole, memberId: member.id, memberName: member.name || member.email } : { memberId: member.id, memberName: member.name || member.email });
    setRoleTitle(existingRole?.role_title || '');
    setRoleDescription(existingRole?.role_description || '');
    setShowRoleModal(true);
  };

  const handleSaveRole = async () => {
    if (!selectedPodId || !editingRole) return;

    if (!roleTitle.trim()) {
      Alert.alert('Error', 'Please enter a role title');
      return;
    }

    setSubmittingRole(true);

    try {
      if (editingRole.id) {
        // Update existing role
        const { data, error } = await supabase
          .from('member_roles')
          .update({
            role_title: roleTitle.trim(),
            role_description: roleDescription.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRole.id)
          .select('*, profiles!user_id(name, email)')
          .single();

        if (error) throw error;

        setRoles(roles.map(r => r.id === data.id ? data : r));
      } else {
        // Create new role
        const { data, error } = await supabase
          .from('member_roles')
          .insert([{
            pursuit_id: selectedPodId,
            user_id: editingRole.memberId,
            role_title: roleTitle.trim(),
            role_description: roleDescription.trim() || null,
          }])
          .select('*, profiles!user_id(name, email)')
          .single();

        if (error) throw error;

        setRoles([...roles, data]);
      }

      // Reset form
      setRoleTitle('');
      setRoleDescription('');
      setEditingRole(null);
      setShowRoleModal(false);

      Alert.alert('Success', 'Role saved!');
    } catch (error: any) {
      console.error('Error saving role:', error);
      Alert.alert('Error', 'Failed to save role');
    } finally {
      setSubmittingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    Alert.alert(
      'Delete Role',
      'Are you sure you want to delete this role?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('member_roles')
                .delete()
                .eq('id', roleId);

              if (error) throw error;

              setRoles(roles.filter(r => r.id !== roleId));
              Alert.alert('Success', 'Role deleted');
            } catch (error) {
              console.error('Error deleting role:', error);
              Alert.alert('Error', 'Failed to delete role');
            }
          },
        },
      ]
    );
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

              {contributionsByDate[date].map((contrib) => {
                const isOwnContribution = contrib.user_id === user?.id;

                return (
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
                      <View style={styles.contributionMeta}>
                        <Text style={styles.contributionInitials}>
                          {getUserInitials(contrib.profiles)}
                          {contrib.is_edited && <Text style={styles.editedLabel}> (edited)</Text>}
                        </Text>
                        {isOwnContribution && (
                          <View style={styles.contributionActions}>
                            <TouchableOpacity
                              onPress={() => handleEditContribution(contrib)}
                              style={styles.actionButton}
                            >
                              <Ionicons name="pencil" size={16} color="#ff6b35" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteContribution(contrib.id)}
                              style={styles.actionButton}
                            >
                              <Ionicons name="trash-outline" size={16} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.contributionContent}>{contrib.content}</Text>
                  </View>
                );
              })}
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
          const canEditRole = isCreator || member.id === user?.id;

          return (
            <View key={member.id} style={styles.roleCard}>
              <View style={styles.roleHeaderRow}>
                <View style={styles.roleHeader}>
                  <Text style={styles.memberName}>{member.name || member.email}</Text>
                </View>
                {canEditRole && (
                  <View style={styles.roleActions}>
                    <TouchableOpacity
                      onPress={() => handleOpenRoleModal(member, memberRole)}
                      style={styles.roleActionButton}
                    >
                      <Ionicons
                        name={memberRole ? "pencil" : "add-circle"}
                        size={18}
                        color="#ff6b35"
                      />
                      <Text style={styles.roleActionText}>
                        {memberRole ? 'Edit' : 'Assign'}
                      </Text>
                    </TouchableOpacity>
                    {memberRole && (
                      <TouchableOpacity
                        onPress={() => handleDeleteRole(memberRole.id)}
                        style={styles.roleActionButton}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
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

        {/* Upload Buttons */}
        <View style={styles.uploadButtonsRow}>
          <TouchableOpacity
            style={[styles.uploadButton, uploadingMedia && styles.uploadButtonDisabled]}
            onPress={() => pickMedia(false)}
            disabled={uploadingMedia}
          >
            {uploadingMedia ? (
              <ActivityIndicator color="#ff6b35" />
            ) : (
              <>
                <Ionicons name="images-outline" size={24} color="#ff6b35" />
                <Text style={styles.uploadButtonText}>Photo Library</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadButton, uploadingMedia && styles.uploadButtonDisabled]}
            onPress={() => pickMedia(true)}
            disabled={uploadingMedia}
          >
            {uploadingMedia ? (
              <ActivityIndicator color="#ff6b35" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={24} color="#ff6b35" />
                <Text style={styles.uploadButtonText}>Take Photo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Media Grid */}
        {mediaItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>No media yet</Text>
            <Text style={styles.emptyHint}>Upload photos and videos to share with your team</Text>
          </View>
        ) : (
          <View style={styles.mediaGrid}>
            {mediaItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={styles.mediaItem}
                onPress={() => openImageViewer(index)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: item.photo_url }} style={styles.mediaImage} />
                <View style={styles.mediaOverlay}>
                  <Text style={styles.mediaUploader} numberOfLines={1}>
                    {item.uploader_name || 'Unknown'}
                  </Text>
                  {item.uploaded_by === user?.id && (
                    <TouchableOpacity
                      style={styles.mediaDeleteButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteMedia(item.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Team Workspace</Text>
          {selectedPod && (
            <Text style={styles.headerPodName} numberOfLines={1}>{selectedPod.title}</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Toggle Button - Always visible */}
        <TouchableOpacity
          style={styles.sidebarToggle}
          onPress={toggleSidebar}
        >
          <Ionicons
            name={sidebarOpen ? "chevron-back" : "chevron-forward"}
            size={20}
            color="#ff6b35"
          />
        </TouchableOpacity>

        {/* Animated Sidebar */}
        <Animated.View
          style={[
            styles.sidebar,
            {
              width: sidebarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, SIDEBAR_WIDTH],
              }),
              opacity: sidebarAnim,
            }
          ]}
        >
          <View style={styles.sidebarInner}>
            <Text style={styles.sidebarTitle}>My Pods</Text>
            <ScrollView style={styles.podList}>
              {pods.map((pod) => (
                <TouchableOpacity
                  key={pod.id}
                  style={[
                    styles.podTab,
                    selectedPodId === pod.id && styles.podTabActive
                  ]}
                  onPress={() => selectPod(pod.id)}
                >
                  <Text style={[
                    styles.podTabText,
                    selectedPodId === pod.id && styles.podTabTextActive
                  ]} numberOfLines={2}>
                    {pod.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Animated.View>

        {/* Main Content Area - takes full width */}
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
              <Text style={styles.modalTitle}>
                {editingContribution ? 'Edit Contribution' : 'Make a Contribution'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowContributeModal(false);
                setEditingContribution(null);
              }}>
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
                spellCheck={true}
                autoCorrect={true}
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
                spellCheck={true}
                autoCorrect={true}
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
                onPress={editingContribution ? handleUpdateContribution : handleCreateContribution}
                disabled={submittingContribution}
              >
                {submittingContribution ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingContribution ? 'Update' : 'Submit'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Role Assignment Modal */}
      <Modal visible={showRoleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRole?.id ? 'Edit Role' : 'Assign Role'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowRoleModal(false);
                setEditingRole(null);
                setRoleTitle('');
                setRoleDescription('');
              }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.memberNameLabel}>
                For: {editingRole?.memberName}
              </Text>

              {/* Role Title */}
              <Text style={styles.fieldLabel}>Role Title *</Text>
              <TextInput
                style={styles.input}
                value={roleTitle}
                onChangeText={setRoleTitle}
                placeholder="e.g., Project Manager, Developer, Designer"
                placeholderTextColor="#666"
                spellCheck={true}
                autoCorrect={true}
              />

              {/* Role Description */}
              <Text style={styles.fieldLabel}>Role Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={roleDescription}
                onChangeText={setRoleDescription}
                placeholder="Describe the responsibilities and expectations for this role..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                spellCheck={true}
                autoCorrect={true}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowRoleModal(false);
                  setEditingRole(null);
                  setRoleTitle('');
                  setRoleDescription('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSaveRole}
                disabled={submittingRole}
              >
                {submittingRole ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Save Role</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal visible={showImageViewer} animationType="fade" transparent>
        <View style={styles.imageViewerContainer}>
          {/* Header */}
          <View style={styles.imageViewerHeader}>
            <TouchableOpacity
              onPress={() => setShowImageViewer(false)}
              style={styles.imageViewerCloseButton}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.imageViewerCounter}>
              {selectedImageIndex + 1} / {mediaItems.length}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const currentItem = mediaItems[selectedImageIndex];
                if (currentItem) {
                  saveImageToPhone(currentItem.photo_url);
                }
              }}
              style={styles.imageViewerDownloadButton}
              disabled={savingImage}
            >
              {savingImage ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="download-outline" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Swipeable Image Gallery */}
          <FlatList
            ref={imageViewerRef}
            data={mediaItems}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={selectedImageIndex}
            getItemLayout={(data, index) => ({
              length: Dimensions.get('window').width,
              offset: Dimensions.get('window').width * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(
                e.nativeEvent.contentOffset.x / Dimensions.get('window').width
              );
              setSelectedImageIndex(newIndex);
            }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.imageViewerSlide}>
                <Image
                  source={{ uri: item.photo_url }}
                  style={styles.imageViewerImage}
                  resizeMode="contain"
                />
                <View style={styles.imageViewerInfo}>
                  <Text style={styles.imageViewerUploader}>
                    Uploaded by {item.uploader_name || 'Unknown'}
                  </Text>
                </View>
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', // Notebook feel
  },
  headerPodName: {
    fontSize: 12,
    color: '#ff6b35',
    marginTop: 2,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  // Sidebar Toggle
  sidebarToggle: {
    position: 'absolute',
    left: 0,
    top: 60,
    zIndex: 100,
    backgroundColor: '#2a2a2a',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderLeftWidth: 0,
    borderColor: '#ff6b35',
  },
  // Sidebar
  sidebar: {
    backgroundColor: '#2a2a2a',
    borderRightWidth: 2,
    borderRightColor: '#ff6b35',
    overflow: 'hidden',
    zIndex: 50,
  },
  sidebarInner: {
    width: SIDEBAR_WIDTH,
    padding: 16,
    height: '100%',
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  contributionTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
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
  contributionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  contributionActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    padding: 4,
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
  roleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleHeader: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  roleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  roleActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  roleActionText: {
    fontSize: 13,
    color: '#ff6b35',
    fontWeight: '600',
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
  memberNameLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
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
  // Media Tab
  uploadButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ff6b35',
    gap: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff6b35',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mediaItem: {
    width: (Dimensions.get('window').width - 72) / 3,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mediaOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaUploader: {
    fontSize: 10,
    color: '#ccc',
    flex: 1,
  },
  mediaDeleteButton: {
    padding: 4,
  },
  // Image Viewer
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  imageViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  imageViewerCloseButton: {
    padding: 8,
  },
  imageViewerCounter: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  imageViewerDownloadButton: {
    padding: 8,
  },
  imageViewerSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 200,
  },
  imageViewerInfo: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  imageViewerUploader: {
    fontSize: 14,
    color: '#ccc',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
});
