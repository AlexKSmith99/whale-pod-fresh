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
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Paths, File as ExpoFile } from 'expo-file-system';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { galleryService, GalleryPhoto } from '../../services/galleryService';
import { notificationService } from '../../services/notificationService';
import { 
  podDocService, 
  podRulesService, 
  DEFAULT_RULES_TEMPLATE, 
  PodDoc, 
  PodRules,
} from '../../services/podContentService';
import UserProfileScreen from '../UserProfileScreen';
import WriteReviewScreen from '../WriteReviewScreen';
import WebRichTextEditor from '../../components/WebRichTextEditor';

// Modern dark theme colors
const theme = {
  // Backgrounds
  bg: '#0f0f0f',
  bgCard: '#1a1a1a',
  bgElevated: '#242424',
  bgHover: '#2a2a2a',
  bgDocument: '#1e1e1e',

  // Accent
  accent: '#ff6b35',
  accentLight: 'rgba(255, 107, 53, 0.15)',
  accentDim: 'rgba(255, 107, 53, 0.08)',

  // Text
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  textMuted: '#666666',

  // Borders & Dividers
  border: '#2a2a2a',
  divider: '#1f1f1f',

  // Status
  success: '#10b981',
  error: '#ef4444',
  highlight: 'rgba(255, 235, 59, 0.3)',
  highlightActive: 'rgba(255, 235, 59, 0.6)',
};

const SIDEBAR_WIDTH = 260;

interface Props {
  onBack: () => void;
  initialPursuitId?: string;
}

type SubTab = 'agenda' | 'roles' | 'media' | 'doc' | 'rules';

interface DocumentEdit {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { name: string; email: string };
}

export default function TeamWorkspaceScreen({ onBack, initialPursuitId }: Props) {
  const { user } = useAuth();
  const [pods, setPods] = useState<any[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('agenda');
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [contributions, setContributions] = useState<DocumentEdit[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [mediaItems, setMediaItems] = useState<GalleryPhoto[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Document state
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const documentInputRef = useRef<TextInput>(null);
  const documentScrollRef = useRef<ScrollView>(null);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Text editing state
  const [newContributionText, setNewContributionText] = useState('');
  const [fullDocumentText, setFullDocumentText] = useState('');
  const [isInEditMode, setIsInEditMode] = useState(false);

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

  // Pod Doc state
  const [podDoc, setPodDoc] = useState<PodDoc | null>(null);
  const [docMission, setDocMission] = useState('');
  const [docNorthstar, setDocNorthstar] = useState('');
  const [docReference, setDocReference] = useState('');
  const [docSaving, setDocSaving] = useState(false);

  // Pod Rules state
  const [podRules, setPodRulesState] = useState<PodRules | null>(null);
  const [rulesContent, setRulesContent] = useState('');
  const [rulesSaving, setRulesSaving] = useState(false);

  // Pod Meetings state (for automatic section headers)
  const [podMeetings, setPodMeetings] = useState<any[]>([]);

  // Rich text agenda document state
  const [agendaDocumentHtml, setAgendaDocumentHtml] = useState<string>('');
  const [agendaDocumentLoading, setAgendaDocumentLoading] = useState(false);
  const [agendaDocumentSaving, setAgendaDocumentSaving] = useState(false);

  // User profile state
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // Write review state
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [revieweeInfo, setRevieweeInfo] = useState<{
    revieweeId: string;
    revieweeName: string;
    revieweePhoto?: string;
  } | null>(null);

  const handleViewProfile = (userId: string) => {
    setSelectedUserId(userId);
    setShowUserProfile(true);
  };
  
  const handleWriteReview = (revieweeId: string, revieweeName: string, revieweePhoto?: string) => {
    setRevieweeInfo({ revieweeId, revieweeName, revieweePhoto });
    setShowWriteReview(true);
  };

  const toggleSidebar = () => {
    const toValue = sidebarOpen ? 0 : 1;
    Animated.spring(sidebarAnim, {
      toValue,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
    setSidebarOpen(!sidebarOpen);
  };

  const selectPod = (podId: string) => {
    setSelectedPodId(podId);
    Animated.spring(sidebarAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
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


  // Get full document text for search
  const getFullDocumentText = () => {
    const sortedContribs = [...contributions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return sortedContribs.map(c => c.content).join('\n\n');
  };

  // Search functionality
  useEffect(() => {
    const documentText = getFullDocumentText();
    if (searchQuery.length > 0 && documentText.length > 0) {
      const matches: number[] = [];
      const lowerText = documentText.toLowerCase();
      const lowerQuery = searchQuery.toLowerCase();
      let pos = 0;
      while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
        matches.push(pos);
        pos += 1;
      }
      setSearchMatches(matches);
      setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
    } else {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
    }
  }, [searchQuery, contributions]);

  const loadUserPods = async () => {
    if (!user) return;

    try {
      const { data: createdPods } = await supabase
        .from('pursuits')
        .select('*')
        .eq('creator_id', user.id)
        .order('title');

      const { data: memberships } = await supabase
        .from('team_members')
        .select('pursuit_id, pursuits(*)')
        .eq('user_id', user.id);

      const memberPods = memberships?.map((m: any) => m.pursuits).filter(Boolean) || [];

      const allPods = [
        ...(createdPods || []),
        ...memberPods
      ];

      const uniquePods = allPods.filter((pod, index, self) =>
        index === self.findIndex((p) => p.id === pod.id)
      );

      setPods(uniquePods);

      if (uniquePods.length > 0 && !selectedPodId) {
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
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, profiles!user_id(id, name, email, profile_picture)')
        .eq('pursuit_id', selectedPodId);

      const { data: pursuit } = await supabase
        .from('pursuits')
        .select('creator_id, profiles!creator_id(id, name, email, profile_picture)')
        .eq('id', selectedPodId)
        .single();

      if (pursuit?.creator_id) {
        setIsCreator(pursuit.creator_id === user.id);
      }

      const allMembers = [...(members?.map((m: any) => m.profiles) || [])];
      if (pursuit?.profiles) {
        allMembers.unshift(pursuit.profiles);
      }

      const uniqueMembers = allMembers.filter((member, index, self) =>
        index === self.findIndex((m) => m.id === member.id)
      );

      setTeamMembers(uniqueMembers);

      if (activeSubTab === 'agenda') {
        await loadAgendaDocument();
        await loadPodMeetings();
      } else if (activeSubTab === 'roles') {
        await loadRoles();
      } else if (activeSubTab === 'media') {
        await loadMedia();
      } else if (activeSubTab === 'doc') {
        await loadPodDoc();
      } else if (activeSubTab === 'rules') {
        await loadPodRulesData();
      }
    } catch (error) {
      console.error('Error loading pod data:', error);
    }
  };

  // Strip any old formatting metadata from content
  const parseContributionContent = (content: string): string => {
    // Remove any legacy formatting metadata
    return content.replace(/<!--FORMAT:.+?-->$/, '');
  };

  const loadContributions = async () => {
    if (!selectedPodId) return;

    try {
      const { data, error } = await supabase
        .from('meeting_contributions')
        .select('*, profiles!user_id(name, email)')
        .eq('pursuit_id', selectedPodId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Parse content (strip any old formatting metadata)
      const parsedData = (data || []).map(item => ({
        ...item,
        content: parseContributionContent(item.content),
      }));

      setContributions(parsedData);
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

  const loadPodDoc = async () => {
    if (!selectedPodId) return;

    try {
      const doc = await podDocService.getDoc(selectedPodId);
      setPodDoc(doc);
      setDocMission(doc?.mission_rich || '');
      setDocNorthstar(doc?.northstar_rich || '');
      setDocReference(doc?.reference_rich || '');
    } catch (error) {
      console.error('Error loading pod doc:', error);
    }
  };

  const loadPodRulesData = async () => {
    if (!selectedPodId) return;

    try {
      const rules = await podRulesService.getRules(selectedPodId);
      setPodRulesState(rules);
      setRulesContent(rules?.rules_rich || '');
    } catch (error) {
      console.error('Error loading pod rules:', error);
    }
  };

  const handleSavePodDoc = async () => {
    if (!selectedPodId) return;
    setDocSaving(true);
    try {
      await podDocService.saveDoc(selectedPodId, {
        mission_rich: docMission,
        northstar_rich: docNorthstar,
        reference_rich: docReference,
      });
      Alert.alert('Saved', 'Pod Doc saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save Pod Doc');
    } finally {
      setDocSaving(false);
    }
  };

  const handleSavePodRules = async () => {
    if (!selectedPodId) return;
    setRulesSaving(true);
    try {
      await podRulesService.saveRules(selectedPodId, rulesContent);
      Alert.alert('Saved', 'Pod Rules saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save Pod Rules');
    } finally {
      setRulesSaving(false);
    }
  };

  const handleUseRulesTemplate = () => {
    Alert.alert(
      'Use Template',
      'This will replace your current rules with the default template. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Use Template', onPress: () => setRulesContent(DEFAULT_RULES_TEMPLATE) },
      ]
    );
  };

  // ==========================================================================
  // POD MEETINGS FUNCTIONS (for automatic section headers)
  // ==========================================================================

  const loadPodMeetings = async () => {
    if (!selectedPodId) return;
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, scheduled_time, status')
        .eq('pursuit_id', selectedPodId)
        .order('scheduled_time', { ascending: false });

      if (error) throw error;
      setPodMeetings(data || []);
    } catch (error) {
      console.error('Error loading pod meetings:', error);
    }
  };

  const loadAgendaDocument = async () => {
    if (!selectedPodId) return;
    setAgendaDocumentLoading(true);
    try {
      const { data, error } = await supabase
        .from('pod_agenda_documents')
        .select('content_html')
        .eq('pod_id', selectedPodId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      setAgendaDocumentHtml(data?.content_html || '');
    } catch (error) {
      console.error('Error loading agenda document:', error);
    } finally {
      setAgendaDocumentLoading(false);
    }
  };

  const saveAgendaDocument = async () => {
    if (!selectedPodId || !user) return;
    setAgendaDocumentSaving(true);
    try {
      const { error } = await supabase
        .from('pod_agenda_documents')
        .upsert({
          pod_id: selectedPodId,
          content_html: agendaDocumentHtml,
          last_edited_by: user.id,
        }, {
          onConflict: 'pod_id'
        });

      if (error) throw error;
      
      setIsInEditMode(false);
      Alert.alert('Saved', 'Document saved successfully');
    } catch (error) {
      console.error('Error saving agenda document:', error);
      Alert.alert('Error', 'Failed to save document');
    } finally {
      setAgendaDocumentSaving(false);
    }
  };

  const handleAgendaContentChange = (html: string) => {
    setAgendaDocumentHtml(html);
  };

  const formatMeetingDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleDocumentBlur = async () => {
    setIsEditingDocument(false);

    // Save text if there's content
    if (newContributionText.trim()) {
      await saveDocumentEdit(newContributionText);
    }

    // Clear the input
    setNewContributionText('');
  };

  const saveDocumentEdit = async (newContent: string) => {
    if (!selectedPodId || !user || !newContent.trim()) return;

    setSavingDocument(true);
    try {
      const { data, error } = await supabase
        .from('meeting_contributions')
        .insert([{
          pursuit_id: selectedPodId,
          user_id: user.id,
          meeting_date: new Date().toISOString().split('T')[0],
          contribution_type: 'meeting notes',
          content: newContent.trim(),
        }])
        .select('*, profiles!user_id(name, email)')
        .single();

      if (error) throw error;

      setContributions(prev => [...prev, { ...data, content: newContent.trim() }]);

      // Notify other team members
      const otherMemberIds = teamMembers.filter(m => m.id !== user.id).map(m => m.id);
      const currentPod = pods.find((p) => p.id === selectedPodId);
      if (otherMemberIds.length > 0 && currentPod) {
        const currentUserProfile = teamMembers.find(m => m.id === user.id);
        const userName = currentUserProfile?.name || currentUserProfile?.email?.split('@')[0] || 'A teammate';
        await notificationService.notifyTeamBoardUpdate(
          otherMemberIds,
          selectedPodId,
          currentPod.title,
          userName,
          'a document update'
        );
      }
    } catch (error: any) {
      console.error('Error saving document:', error);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSavingDocument(false);
    }
  };

  const enterEditMode = () => {
    // Build document text with meeting headers included
    const now = new Date();
    const upcomingMeetings = podMeetings.filter(m => new Date(m.scheduled_time) >= now);
    const pastMeetings = podMeetings.filter(m => new Date(m.scheduled_time) < now);
    
    let documentParts: string[] = [];
    
    // Add upcoming meetings section
    if (upcomingMeetings.length > 0) {
      documentParts.push('═══════════════════════════════════════');
      documentParts.push('📅 UPCOMING MEETINGS');
      documentParts.push('═══════════════════════════════════════');
      documentParts.push('');
      upcomingMeetings.forEach(meeting => {
        documentParts.push(`▸ ${meeting.title}`);
        documentParts.push(`  ${formatMeetingDateTime(meeting.scheduled_time)}`);
        documentParts.push('');
      });
    }
    
    // Add past meetings section
    if (pastMeetings.length > 0) {
      documentParts.push('═══════════════════════════════════════');
      documentParts.push('📋 PAST MEETINGS');
      documentParts.push('═══════════════════════════════════════');
      documentParts.push('');
      pastMeetings.forEach(meeting => {
        documentParts.push(`▸ ${meeting.title}`);
        documentParts.push(`  ${formatMeetingDateTime(meeting.scheduled_time)}`);
        documentParts.push('');
      });
    }
    
    // Add notes section
    if (podMeetings.length > 0) {
      documentParts.push('═══════════════════════════════════════');
      documentParts.push('📝 NOTES & CONTRIBUTIONS');
      documentParts.push('═══════════════════════════════════════');
      documentParts.push('');
    }
    
    // Add contributions
    const sortedContribs = [...contributions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const contributionsText = sortedContribs.map(c => c.content).join('\n\n');
    documentParts.push(contributionsText);
    
    setFullDocumentText(documentParts.join('\n'));
    setIsInEditMode(true);
    setIsEditingDocument(true);
    setShowDocMenu(false);
    setTimeout(() => documentInputRef.current?.focus(), 100);
  };

  const saveEditedDocument = async () => {
    if (!selectedPodId || !user) return;

    const trimmedText = fullDocumentText.trim();
    const originalText = getFullDocumentText();

    // If nothing changed, just exit
    if (trimmedText === originalText) {
      setIsInEditMode(false);
      setIsEditingDocument(false);
      setFullDocumentText('');
      return;
    }

    setSavingDocument(true);
    try {
      // Delete all existing contributions for this pod
      if (contributions.length > 0) {
        const { error: deleteError } = await supabase
          .from('meeting_contributions')
          .delete()
          .eq('pursuit_id', selectedPodId);

        if (deleteError) throw deleteError;
      }

      // If there's new content, save it as a single contribution
      if (trimmedText) {
        const { data, error } = await supabase
          .from('meeting_contributions')
          .insert([{
            pursuit_id: selectedPodId,
            user_id: user.id,
            meeting_date: new Date().toISOString().split('T')[0],
            contribution_type: 'meeting notes',
            content: trimmedText,
          }])
          .select('*, profiles!user_id(name, email)')
          .single();

        if (error) throw error;

        setContributions([{ ...data, content: trimmedText }]);

        // Notify other team members
        const otherMemberIds = teamMembers.filter(m => m.id !== user.id).map(m => m.id);
        const currentPod = pods.find((p) => p.id === selectedPodId);
        if (otherMemberIds.length > 0 && currentPod) {
          const currentUserProfile = teamMembers.find(m => m.id === user.id);
          const userName = currentUserProfile?.name || currentUserProfile?.email?.split('@')[0] || 'A teammate';
          await notificationService.notifyTeamBoardUpdate(
            otherMemberIds,
            selectedPodId,
            currentPod.title,
            userName,
            'a document update'
          );
        }
      } else {
        // All content was deleted
        setContributions([]);
      }
    } catch (error) {
      console.error('Error saving document:', error);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSavingDocument(false);
      setIsInEditMode(false);
      setIsEditingDocument(false);
      setFullDocumentText('');
    }
  };

  const cancelEditMode = () => {
    setIsInEditMode(false);
    setIsEditingDocument(false);
    setFullDocumentText('');
  };

  const getUserInitials = (profile: any) => {
    if (profile?.name) {
      const names = profile.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    return '?';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const navigateSearch = (direction: 'prev' | 'next') => {
    if (searchMatches.length === 0) return;

    let newIndex = currentMatchIndex;
    if (direction === 'next') {
      newIndex = (currentMatchIndex + 1) % searchMatches.length;
    } else {
      newIndex = currentMatchIndex === 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
    }
    setCurrentMatchIndex(newIndex);
  };

  const renderHighlightedText = () => {
    const documentText = getFullDocumentText();
    if (!showSearch || searchQuery.length === 0 || searchMatches.length === 0) {
      return renderFormattedDocument();
    }

    const parts: React.ReactElement[] = [];
    let lastIndex = 0;

    searchMatches.forEach((matchPos, idx) => {
      // Text before match
      if (matchPos > lastIndex) {
        parts.push(
          <Text key={`text-${lastIndex}`} style={styles.documentText}>
            {documentText.substring(lastIndex, matchPos)}
          </Text>
        );
      }
      // Highlighted match
      parts.push(
        <Text
          key={`match-${matchPos}`}
          style={[
            styles.documentText,
            styles.highlightedText,
            idx === currentMatchIndex && styles.activeHighlight
          ]}
        >
          {documentText.substring(matchPos, matchPos + searchQuery.length)}
        </Text>
      );
      lastIndex = matchPos + searchQuery.length;
    });

    // Remaining text
    if (lastIndex < documentText.length) {
      parts.push(
        <Text key={`text-${lastIndex}`} style={styles.documentText}>
          {documentText.substring(lastIndex)}
        </Text>
      );
    }

    return <Text>{parts}</Text>;
  };

  const renderEditHistoryContent = () => {
    const sortedContributions = [...contributions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return (
      <View>
        {sortedContributions.map((contrib) => (
          <View key={contrib.id} style={styles.editHistoryBlock}>
            <Text style={styles.documentText}>
              {contrib.content}
            </Text>
            <View style={styles.editHistoryMeta}>
              <View style={styles.editHistoryAuthor}>
                <Text style={styles.editHistoryInitials}>
                  {getUserInitials(contrib.profiles)}
                </Text>
              </View>
              <Text style={styles.editHistoryTime}>
                {formatDateTime(contrib.created_at)}
              </Text>
            </View>
          </View>
        ))}
        {sortedContributions.length === 0 && (
          <Text style={styles.documentPlaceholder}>No edit history yet</Text>
        )}
      </View>
    );
  };

  const renderFormattedDocument = () => {
    const sortedContributions = [...contributions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    if (sortedContributions.length === 0) {
      return (
        <Text style={styles.documentPlaceholder}>
          No content yet.{'\n\n'}
          Tap the menu (three dots) and select "Edit" to start writing.
        </Text>
      );
    }

    return (
      <View>
        {sortedContributions.map((contrib, index) => (
          <Text
            key={contrib.id}
            style={styles.documentText}
          >
            {contrib.content}
            {index < sortedContributions.length - 1 ? '\n\n' : ''}
          </Text>
        ))}
      </View>
    );
  };

  const pickMedia = async (useCamera: boolean) => {
    try {
      const { status } = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need permission to access your photos/camera');
        return;
      }

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

      const otherMemberIds = teamMembers.filter(m => m.id !== user.id).map(m => m.id);
      const currentPod = pods.find((p) => p.id === selectedPodId);
      if (otherMemberIds.length > 0 && currentPod) {
        const currentUserProfile = teamMembers.find(m => m.id === user.id);
        const userName = currentUserProfile?.name || currentUserProfile?.email?.split('@')[0] || 'A teammate';
        await notificationService.notifyTeamBoardUpdate(
          otherMemberIds,
          selectedPodId,
          currentPod.title,
          userName,
          'a photo'
        );
      }

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
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need permission to save photos to your library');
        return;
      }

      const filename = `photo_${Date.now()}.jpg`;
      const localFile = new ExpoFile(Paths.cache, filename);

      await (ExpoFile as any).downloadFileAsync(imageUrl, localFile);

      await MediaLibrary.saveToLibraryAsync(localFile.uri);

      Alert.alert('Saved!', 'Photo saved to your photo library');
    } catch (error: any) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save photo to library');
    } finally {
      setSavingImage(false);
    }
  };

  const handleOpenRoleModal = (member: any, existingRole?: any) => {
    setEditingRole(existingRole ? { ...existingRole, memberId: member.id, memberName: member.name || 'Team Member' } : { memberId: member.id, memberName: member.name || 'Team Member' });
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

      const otherMemberIds = teamMembers.filter(m => m.id !== user?.id).map(m => m.id);
      const currentPod = pods.find((p) => p.id === selectedPodId);
      if (otherMemberIds.length > 0 && currentPod && user) {
        const currentUserProfile = teamMembers.find(m => m.id === user.id);
        const userName = currentUserProfile?.name || currentUserProfile?.email?.split('@')[0] || 'A teammate';
        await notificationService.notifyTeamBoardUpdate(
          otherMemberIds,
          selectedPodId,
          currentPod.title,
          userName,
          'a role update'
        );
      }

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
            } catch (error) {
              console.error('Error deleting role:', error);
              Alert.alert('Error', 'Failed to delete role');
            }
          },
        },
      ]
    );
  };

  // Build document content with meeting headers
  const renderFormattedDocumentWithMeetings = () => {
    const now = new Date();
    
    // Separate upcoming and past meetings
    const upcomingMeetings = podMeetings.filter(m => new Date(m.scheduled_time) >= now);
    const pastMeetings = podMeetings.filter(m => new Date(m.scheduled_time) < now);
    
    // Get document text from contributions
    const documentText = getFullDocumentText();
    
    return (
      <View>
        {/* Upcoming Meetings Section */}
        {upcomingMeetings.length > 0 && (
          <View style={styles.meetingSectionHeader}>
            <Text style={styles.meetingsSectionLabel}>📅 UPCOMING MEETINGS</Text>
          </View>
        )}
        {upcomingMeetings.map((meeting) => (
          <View key={meeting.id} style={styles.meetingHeaderBlock}>
            <View style={styles.meetingHeaderBar} />
            <Text style={styles.meetingHeaderTitle}>{meeting.title}</Text>
            <Text style={styles.meetingHeaderDate}>{formatMeetingDateTime(meeting.scheduled_time)}</Text>
            <Text style={styles.meetingHeaderStatus}>
              {meeting.status === 'scheduled' ? '🟢 Scheduled' : meeting.status}
            </Text>
          </View>
        ))}

        {/* Past Meetings Section */}
        {pastMeetings.length > 0 && (
          <View style={[styles.meetingSectionHeader, { marginTop: upcomingMeetings.length > 0 ? 24 : 0 }]}>
            <Text style={styles.meetingsSectionLabel}>📋 PAST MEETINGS</Text>
          </View>
        )}
        {pastMeetings.map((meeting) => (
          <View key={meeting.id} style={[styles.meetingHeaderBlock, styles.pastMeetingHeaderBlock]}>
            <View style={[styles.meetingHeaderBar, styles.pastMeetingHeaderBar]} />
            <Text style={styles.meetingHeaderTitle}>{meeting.title}</Text>
            <Text style={styles.meetingHeaderDate}>{formatMeetingDateTime(meeting.scheduled_time)}</Text>
            <Text style={styles.meetingHeaderStatus}>
              {meeting.status === 'completed' ? '✅ Completed' : meeting.status === 'cancelled' ? '❌ Cancelled' : '⏰ Past'}
            </Text>
          </View>
        ))}

        {/* Document Content */}
        {podMeetings.length > 0 && (
          <View style={styles.notesAreaDivider}>
            <Text style={styles.notesAreaLabel}>📝 NOTES & CONTRIBUTIONS</Text>
          </View>
        )}
        
        {documentText.length > 0 ? (
          <Text style={styles.documentText}>{documentText}</Text>
        ) : (
          <Text style={styles.emptyDocumentText}>
            {podMeetings.length > 0 
              ? 'Start adding notes and contributions below the meeting headers...'
              : 'No meetings scheduled yet. Schedule a meeting to see it appear here automatically.\n\nYou can still add notes and contributions below.'}
          </Text>
        )}
      </View>
    );
  };

  const renderAgendaTab = () => {
    // Full-screen rich text edit mode
    if (isInEditMode) {
      return (
        <WebRichTextEditor
          initialContent={agendaDocumentHtml}
          onChange={handleAgendaContentChange}
          onSave={saveAgendaDocument}
          onCancel={() => {
            setIsInEditMode(false);
            // Reload to discard changes
            loadAgendaDocument();
          }}
          placeholder="Start typing your meeting notes..."
          editable={true}
        />
      );
    }

    // Loading state
    if (agendaDocumentLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      );
    }

    // Read mode - show HTML content rendered or empty state
    return (
      <View style={styles.documentContainerCompact}>
        {/* Document Header with Edit Button */}
        <View style={styles.documentHeaderCompact}>
          <Text style={styles.agendaTitle}>Meeting Agenda & Notes</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsInEditMode(true)}
          >
            <Ionicons name="create-outline" size={18} color={theme.accent} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Document Content */}
        <ScrollView
          style={styles.documentScrollCompact}
          showsVerticalScrollIndicator={false}
        >
          {/* Meeting Headers */}
          {podMeetings.length > 0 && (
            <View style={styles.meetingHeadersSection}>
              {podMeetings.filter(m => new Date(m.scheduled_time) >= new Date()).length > 0 && (
                <>
                  <Text style={styles.meetingsSectionLabel}>📅 UPCOMING MEETINGS</Text>
                  {podMeetings
                    .filter(m => new Date(m.scheduled_time) >= new Date())
                    .map((meeting) => (
                      <View key={meeting.id} style={styles.meetingHeaderBlock}>
                        <Text style={styles.meetingHeaderTitle}>{meeting.title}</Text>
                        <Text style={styles.meetingHeaderDate}>{formatMeetingDateTime(meeting.scheduled_time)}</Text>
                      </View>
                    ))}
                </>
              )}
              {podMeetings.filter(m => new Date(m.scheduled_time) < new Date()).length > 0 && (
                <>
                  <Text style={[styles.meetingsSectionLabel, { marginTop: 16 }]}>📋 PAST MEETINGS</Text>
                  {podMeetings
                    .filter(m => new Date(m.scheduled_time) < new Date())
                    .slice(0, 5)
                    .map((meeting) => (
                      <View key={meeting.id} style={[styles.meetingHeaderBlock, { opacity: 0.7 }]}>
                        <Text style={styles.meetingHeaderTitle}>{meeting.title}</Text>
                        <Text style={styles.meetingHeaderDate}>{formatMeetingDateTime(meeting.scheduled_time)}</Text>
                      </View>
                    ))}
                </>
              )}
            </View>
          )}

          {/* Document Content */}
          <View style={styles.documentContentSection}>
            <Text style={styles.meetingsSectionLabel}>📝 NOTES</Text>
            {agendaDocumentHtml ? (
              <View style={styles.htmlContentContainer}>
                <Text style={styles.htmlContentPlaceholder}>
                  {/* Extract plain text from JSON document for preview */}
                  {(() => {
                    try {
                      const doc = JSON.parse(agendaDocumentHtml);
                      const text = doc.paragraphs?.map((p: any) => 
                        p.spans?.map((s: any) => s.text || '').join('')
                      ).join('\n') || '';
                      return text.substring(0, 500) || 'Tap Edit to view and modify your notes...';
                    } catch {
                      // Fallback for plain text or HTML
                      const text = agendaDocumentHtml.replace(/<[^>]*>/g, '');
                      return text.substring(0, 500) || 'Tap Edit to view and modify your notes...';
                    }
                  })()}
                </Text>
              </View>
            ) : (
              <View style={styles.emptyDocContainer}>
                <Ionicons name="document-text-outline" size={48} color={theme.textMuted} />
                <Text style={styles.emptyDocText}>No notes yet</Text>
                <Text style={styles.emptyDocSubtext}>Tap Edit to start adding meeting notes</Text>
              </View>
            )}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    );
  };

  const renderPodDocTab = () => {
    return (
      <ScrollView style={styles.documentContainer}>
        <View style={styles.podDocHeader}>
          <Text style={styles.podDocTitle}>📄 Pod Doc</Text>
          <TouchableOpacity
            style={[styles.saveDocButton, docSaving && styles.saveDocButtonDisabled]}
            onPress={handleSavePodDoc}
            disabled={docSaving}
          >
            {docSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveDocButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.podDocSection}>
          <Text style={styles.podDocSectionTitle}>🎯 Pod Mission</Text>
          <Text style={styles.podDocSectionHint}>What is the core purpose of this pod?</Text>
          <TextInput
            style={styles.podDocInput}
            value={docMission}
            onChangeText={setDocMission}
            placeholder="Define your pod's mission..."
            placeholderTextColor={theme.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.podDocSection}>
          <Text style={styles.podDocSectionTitle}>⭐ Northstar Vision</Text>
          <Text style={styles.podDocSectionHint}>What does success look like for this pod?</Text>
          <TextInput
            style={styles.podDocInput}
            value={docNorthstar}
            onChangeText={setDocNorthstar}
            placeholder="Describe your vision of success..."
            placeholderTextColor={theme.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.podDocSection}>
          <Text style={styles.podDocSectionTitle}>📚 Shared Reference Notes</Text>
          <Text style={styles.podDocSectionHint}>Important links, resources, and ongoing notes</Text>
          <TextInput
            style={[styles.podDocInput, { minHeight: 200 }]}
            value={docReference}
            onChangeText={setDocReference}
            placeholder="Add links, resources, or reference notes..."
            placeholderTextColor={theme.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>
    );
  };

  const renderPodRulesTab = () => {
    return (
      <ScrollView style={styles.documentContainer}>
        <View style={styles.podDocHeader}>
          <Text style={styles.podDocTitle}>📜 Pod Rules</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.templateButton}
              onPress={handleUseRulesTemplate}
            >
              <Text style={styles.templateButtonText}>Use Template</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveDocButton, rulesSaving && styles.saveDocButtonDisabled]}
              onPress={handleSavePodRules}
              disabled={rulesSaving}
            >
              {rulesSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveDocButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.rulesHint}>
          Define the rules, guidelines, and expectations for this pod
        </Text>

        <TextInput
          style={[styles.podDocInput, { minHeight: 400 }]}
          value={rulesContent}
          onChangeText={setRulesContent}
          placeholder="Add your pod rules and guidelines...

Example:
**Pod Guidelines**
1. Be respectful and supportive
2. Communicate schedule changes early
3. Come prepared to meetings
4. Keep discussions focused"
          placeholderTextColor={theme.textMuted}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>
    );
  };

  const renderRolesTab = () => {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {teamMembers.map((member) => {
          const memberRole = roles.find((r) => r.user_id === member.id);
          const canEditRole = isCreator || member.id === user?.id;

          return (
            <View key={member.id} style={styles.roleCard}>
              <View style={styles.roleHeader}>
                <TouchableOpacity
                  style={styles.memberInfo}
                  onPress={() => handleViewProfile(member.id)}
                >
                  {member.profile_picture ? (
                    <Image source={{ uri: member.profile_picture }} style={styles.memberAvatarImage} />
                  ) : (
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>{getUserInitials(member)}</Text>
                    </View>
                  )}
                  <View style={styles.memberNameContainer}>
                    <Text style={styles.memberNameText}>{member.name || 'Unknown'}</Text>
                    <Text style={styles.viewProfileLink}>View profile →</Text>
                  </View>
                </TouchableOpacity>
                {canEditRole && (
                  <TouchableOpacity
                    onPress={() => handleOpenRoleModal(member, memberRole)}
                    style={styles.roleEditBtn}
                  >
                    <Ionicons name={memberRole ? "pencil-outline" : "add"} size={18} color={theme.accent} />
                  </TouchableOpacity>
                )}
              </View>
              {memberRole ? (
                <View style={styles.roleContent}>
                  <Text style={styles.roleTitleText}>{memberRole.role_title}</Text>
                  {memberRole.role_description && (
                    <Text style={styles.roleDescText}>{memberRole.role_description}</Text>
                  )}
                  {canEditRole && memberRole && (
                    <TouchableOpacity
                      onPress={() => handleDeleteRole(memberRole.id)}
                      style={styles.roleDeleteBtn}
                    >
                      <Ionicons name="trash-outline" size={14} color={theme.error} />
                      <Text style={styles.roleDeleteText}>Remove role</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text style={styles.noRoleText}>No role assigned</Text>
              )}
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderMediaTab = () => {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.uploadRow}>
          <TouchableOpacity
            style={[styles.uploadBtn, uploadingMedia && styles.uploadBtnDisabled]}
            onPress={() => pickMedia(false)}
            disabled={uploadingMedia}
            activeOpacity={0.8}
          >
            {uploadingMedia ? (
              <ActivityIndicator color={theme.accent} size="small" />
            ) : (
              <>
                <Ionicons name="images-outline" size={22} color={theme.accent} />
                <Text style={styles.uploadBtnText}>Library</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadBtn, uploadingMedia && styles.uploadBtnDisabled]}
            onPress={() => pickMedia(true)}
            disabled={uploadingMedia}
            activeOpacity={0.8}
          >
            {uploadingMedia ? (
              <ActivityIndicator color={theme.accent} size="small" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={22} color={theme.accent} />
                <Text style={styles.uploadBtnText}>Camera</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {mediaItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="images-outline" size={40} color={theme.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No media yet</Text>
            <Text style={styles.emptySubtitle}>Share photos and videos with your team</Text>
          </View>
        ) : (
          <View style={styles.mediaGrid}>
            {mediaItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={styles.mediaItem}
                onPress={() => openImageViewer(index)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: item.photo_url }} style={styles.mediaImage} />
                <View style={styles.mediaOverlay}>
                  <Text style={styles.mediaUploader} numberOfLines={1}>
                    {item.uploader_name || 'Unknown'}
                  </Text>
                  {item.uploaded_by === user?.id && (
                    <TouchableOpacity
                      style={styles.mediaDeleteBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteMedia(item.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // Show write review screen
  if (showWriteReview && revieweeInfo) {
    return (
      <WriteReviewScreen
        route={{ params: revieweeInfo }}
        navigation={{
          goBack: () => {
            setShowWriteReview(false);
            setRevieweeInfo(null);
          },
        }}
      />
    );
  }

  // Show user profile screen
  if (showUserProfile && selectedUserId) {
    const navigation = {
      navigate: () => {},
      goBack: () => {
        setShowUserProfile(false);
        setSelectedUserId(null);
      },
      replace: () => {
        setShowUserProfile(false);
        setSelectedUserId(null);
      },
    };

    return (
      <UserProfileScreen
        route={{ params: { userId: selectedUserId } }}
        navigation={navigation}
        onWriteReview={handleWriteReview}
      />
    );
  }

  const selectedPod = pods.find((p) => p.id === selectedPodId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Team Board</Text>
          {selectedPod && (
            <TouchableOpacity onPress={toggleSidebar} style={styles.podSelector}>
              {selectedPod.default_picture && (
                <Image source={{ uri: selectedPod.default_picture }} style={styles.headerPodPicture} />
              )}
              <Text style={styles.podName} numberOfLines={1}>{selectedPod.title}</Text>
              <Ionicons name="chevron-down" size={16} color={theme.accent} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={toggleSidebar} style={styles.menuBtn}>
          <Ionicons name={sidebarOpen ? "close" : "menu"} size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.mainArea}>
        {/* Sidebar Overlay */}
        {sidebarOpen && (
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={toggleSidebar}
          />
        )}

        {/* Animated Sidebar */}
        <Animated.View
          style={[
            styles.sidebar,
            {
              transform: [{
                translateX: sidebarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-SIDEBAR_WIDTH, 0],
                })
              }],
              opacity: sidebarAnim,
            }
          ]}
        >
          <Text style={styles.sidebarTitle}>Your Pods</Text>
          <ScrollView style={styles.podList} showsVerticalScrollIndicator={false}>
            {pods.map((pod) => (
              <TouchableOpacity
                key={pod.id}
                style={[styles.podItem, selectedPodId === pod.id && styles.podItemActive]}
                onPress={() => selectPod(pod.id)}
                activeOpacity={0.7}
              >
                {pod.default_picture ? (
                  <Image source={{ uri: pod.default_picture }} style={styles.podItemPicture} />
                ) : (
                  <View style={styles.podItemPlaceholder}>
                    <Ionicons name="people" size={14} color={theme.textMuted} />
                  </View>
                )}
                <Text style={[styles.podItemText, selectedPodId === pod.id && styles.podItemTextActive]} numberOfLines={2}>
                  {pod.title}
                </Text>
                {selectedPodId === pod.id && (
                  <View style={styles.podItemIndicator} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Main Content */}
        <View style={styles.content}>
          {selectedPod && (
            <>
              {/* Segmented Tabs - Hidden when in edit mode on agenda tab */}
              {!(isInEditMode && activeSubTab === 'agenda') && (
                <View style={styles.tabBar}>
                  {(['agenda', 'doc', 'rules', 'roles', 'media'] as SubTab[]).map((tab) => (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.tab, activeSubTab === tab && styles.tabActive]}
                      onPress={() => setActiveSubTab(tab)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.tabText, activeSubTab === tab && styles.tabTextActive]}>
                        {tab === 'agenda' ? 'Agenda & Notes' : tab === 'doc' ? 'Pod Doc' : tab === 'rules' ? 'Rules' : tab === 'roles' ? 'Roles' : 'Media'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {activeSubTab === 'agenda' && renderAgendaTab()}
              {activeSubTab === 'doc' && renderPodDocTab()}
              {activeSubTab === 'rules' && renderPodRulesTab()}
              {activeSubTab === 'roles' && renderRolesTab()}
              {activeSubTab === 'media' && renderMediaTab()}
            </>
          )}
        </View>
      </View>

      {/* Role Modal */}
      <Modal visible={showRoleModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRole?.id ? 'Edit Role' : 'Assign Role'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowRoleModal(false);
                  setEditingRole(null);
                  setRoleTitle('');
                  setRoleDescription('');
                }}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.memberLabel}>For: {editingRole?.memberName}</Text>

              <Text style={styles.inputLabel}>Role Title</Text>
              <TextInput
                style={styles.input}
                value={roleTitle}
                onChangeText={setRoleTitle}
                placeholder="e.g., Project Lead, Designer"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={roleDescription}
                onChangeText={setRoleDescription}
                placeholder="Describe responsibilities..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={4}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowRoleModal(false);
                  setEditingRole(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submittingRole && styles.submitBtnDisabled]}
                onPress={handleSaveRole}
                disabled={submittingRole}
              >
                {submittingRole ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal visible={showImageViewer} animationType="fade" transparent>
        <View style={styles.imageViewerContainer}>
          <View style={styles.imageViewerHeader}>
            <TouchableOpacity onPress={() => setShowImageViewer(false)} style={styles.imageViewerClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.imageViewerCounter}>
              {selectedImageIndex + 1} / {mediaItems.length}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const currentItem = mediaItems[selectedImageIndex];
                if (currentItem) saveImageToPhone(currentItem.photo_url);
              }}
              style={styles.imageViewerDownload}
              disabled={savingImage}
            >
              {savingImage ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="download-outline" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

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
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
              setSelectedImageIndex(newIndex);
            }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.imageViewerSlide}>
                <Image source={{ uri: item.photo_url }} style={styles.imageViewerImage} resizeMode="contain" />
                <Text style={styles.imageViewerUploader}>by {item.uploader_name || 'Unknown'}</Text>
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
    backgroundColor: theme.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 16,
    backgroundColor: theme.bgCard,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  podSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  podName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    maxWidth: 200,
  },
  headerPodPicture: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
  menuBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Main Area
  mainArea: {
    flex: 1,
    position: 'relative',
  },

  // Sidebar
  sidebarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: theme.bgCard,
    zIndex: 20,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  sidebarTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  podList: {
    flex: 1,
  },
  podItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: theme.bgElevated,
    flexDirection: 'row',
    alignItems: 'center',
  },
  podItemActive: {
    backgroundColor: theme.accentLight,
  },
  podItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  podItemTextActive: {
    color: theme.accent,
    fontWeight: '600',
  },
  podItemIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.accent,
  },
  podItemPicture: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  podItemPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  // Content
  content: {
    flex: 1,
    backgroundColor: theme.bg,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: theme.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },

  // Tab Content
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Document Styles
  documentContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  documentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  modeBadge: {
    backgroundColor: theme.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.accent,
  },
  docMenuButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: theme.bgCard,
  },
  documentScroll: {
    flex: 1,
  },
  documentPage: {
    backgroundColor: theme.bgDocument,
    borderRadius: 12,
    padding: 20,
    minHeight: SCREEN_HEIGHT - 300,
  },
  documentTouchable: {
    flex: 1,
    minHeight: 400,
  },
  documentText: {
    fontSize: 16,
    color: theme.text,
    lineHeight: 26,
  },
  documentPlaceholder: {
    fontSize: 16,
    color: theme.textMuted,
    lineHeight: 26,
    fontStyle: 'italic',
  },
  documentInput: {
    fontSize: 16,
    color: theme.text,
    lineHeight: 26,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  fullDocumentEdit: {
    minHeight: 300,
    backgroundColor: theme.bgElevated,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  editModeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  editModeCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: theme.bgElevated,
  },
  editModeCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  editModeSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: theme.accent,
  },
  editModeSaveBtnDisabled: {
    opacity: 0.5,
  },
  editModeSaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  newContributionInput: {
    marginTop: 16,
    minHeight: 80,
    backgroundColor: theme.bgElevated,
    borderRadius: 8,
    padding: 12,
  },
  highlightedText: {
    backgroundColor: theme.highlight,
  },
  activeHighlight: {
    backgroundColor: theme.highlightActive,
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    padding: 0,
  },
  searchNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchCount: {
    fontSize: 12,
    color: theme.textSecondary,
    marginRight: 4,
  },
  searchNavBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.bgElevated,
    borderRadius: 8,
  },
  searchCloseBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Formatting Toolbar
  formatToolbarScroll: {
    maxHeight: 52,
    marginBottom: 12,
  },
  formatToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 8,
    gap: 4,
  },
  formatGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  formatBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: theme.bgElevated,
  },
  formatBtnActive: {
    backgroundColor: theme.accent,
  },
  formatBtnText: {
    fontSize: 16,
    color: theme.text,
  },
  formatBtnTextActive: {
    color: '#fff',
  },
  formatBtnBold: {
    fontWeight: '700',
  },
  formatBtnItalic: {
    fontStyle: 'italic',
  },
  formatBtnUnderline: {
    textDecorationLine: 'underline',
  },
  formatDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.border,
    marginHorizontal: 8,
  },
  formatDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  formatDropdownText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pickerDropdown: {
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  pickerOptionActive: {
    backgroundColor: theme.accentLight,
  },
  pickerOptionText: {
    color: theme.text,
    fontWeight: '500',
  },
  pickerOptionTextActive: {
    color: theme.accent,
  },
  colorPickerDropdown: {
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: theme.accent,
  },

  // Edit History
  editHistoryBlock: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  editHistoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  editHistoryAuthor: {
    backgroundColor: theme.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  editHistoryInitials: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  editHistoryTime: {
    fontSize: 11,
    color: theme.textMuted,
  },

  // Menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 180 : 140,
    paddingRight: 24,
  },
  menuContainer: {
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    minWidth: 180,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
  },
  menuItemTextActive: {
    color: theme.accent,
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.divider,
    marginHorizontal: 16,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // Role Card
  roleCard: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  memberNameContainer: {
    flex: 1,
  },
  memberNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  viewProfileLink: {
    fontSize: 12,
    color: theme.accent,
    fontWeight: '500',
    marginTop: 2,
  },
  roleEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleContent: {
    paddingLeft: 52,
  },
  roleTitleText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
    marginBottom: 4,
  },
  roleDescText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  roleDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  roleDeleteText: {
    fontSize: 12,
    color: theme.error,
  },
  noRoleText: {
    fontSize: 14,
    color: theme.textMuted,
    fontStyle: 'italic',
    paddingLeft: 52,
  },

  // Upload Row
  uploadRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bgCard,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  uploadBtnDisabled: {
    opacity: 0.5,
  },
  uploadBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.accent,
  },

  // Media Grid
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mediaItem: {
    width: (SCREEN_WIDTH - 52) / 3,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.bgCard,
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaUploader: {
    fontSize: 10,
    color: '#fff',
    flex: 1,
  },
  mediaDeleteBtn: {
    padding: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.accent,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.bgElevated,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.text,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: theme.bgElevated,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: theme.accent,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Image Viewer
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  imageViewerClose: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCounter: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  imageViewerDownload: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
  imageViewerUploader: {
    fontSize: 14,
    color: '#999',
    marginTop: 16,
  },

  // Pod Doc & Rules styles
  podDocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  podDocTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.text,
  },
  saveDocButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveDocButtonDisabled: {
    opacity: 0.5,
  },
  saveDocButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  templateButton: {
    backgroundColor: theme.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  templateButtonText: {
    color: theme.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  podDocSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  podDocSectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  podDocSectionHint: {
    fontSize: 13,
    color: theme.textMuted,
    marginBottom: 12,
  },
  podDocInput: {
    backgroundColor: theme.bgElevated,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rulesHint: {
    fontSize: 14,
    color: theme.textSecondary,
    padding: 16,
    paddingBottom: 8,
  },

  // Meeting Headers in Document Styles
  meetingSectionHeader: {
    marginBottom: 12,
  },
  meetingsSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.accent,
    letterSpacing: 1,
  },
  meetingHeaderBlock: {
    backgroundColor: theme.bgElevated,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
  },
  pastMeetingHeaderBlock: {
    opacity: 0.7,
  },
  meetingHeaderBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: theme.accent,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  pastMeetingHeaderBar: {
    backgroundColor: theme.textMuted,
  },
  meetingHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  meetingHeaderDate: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  meetingHeaderStatus: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 4,
  },
  notesAreaDivider: {
    marginTop: 20,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  notesAreaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
    letterSpacing: 1,
  },
  emptyDocumentText: {
    fontSize: 14,
    color: theme.textMuted,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // Formatting Toolbar Styles
  formattingToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  formattingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formattingDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.border,
    marginHorizontal: 10,
  },
  formatBtnTextBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  formatBtnTextItalic: {
    fontSize: 16,
    fontStyle: 'italic',
    color: theme.text,
  },
  formatBtnTextUnderline: {
    fontSize: 16,
    textDecorationLine: 'underline',
    color: theme.text,
  },
  textSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.bgHover,
    gap: 4,
  },
  textSettingsBtnText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
  },
  textSettingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textSettingsContainer: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 320,
  },
  textSettingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  textSettingsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  textSettingsOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  textSettingsOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.bgElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  textSettingsOptionActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentLight,
  },
  textSettingsOptionText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  textSettingsOptionTextActive: {
    color: theme.accent,
    fontWeight: '600',
  },

  // Compact Edit Mode Styles
  editModeContainer: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  editModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  editModeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editModeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  compactToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: theme.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  compactFormatBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactFormatBtnActive: {
    backgroundColor: theme.accentLight,
  },
  compactFormatBtnBold: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
  },
  compactFormatBtnItalic: {
    fontSize: 14,
    fontStyle: 'italic',
    color: theme.text,
  },
  compactFormatBtnUnderline: {
    fontSize: 14,
    textDecorationLine: 'underline',
    color: theme.text,
  },
  compactDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.border,
    marginHorizontal: 6,
  },
  compactTextSettingsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: theme.bgHover,
  },
  compactTextSettingsBtnText: {
    fontSize: 13,
    color: theme.text,
    fontWeight: '500',
  },
  fullScreenEditor: {
    flex: 1,
    padding: 12,
    color: theme.text,
    textAlignVertical: 'top',
  },

  // Compact Read Mode Styles
  documentContainerCompact: {
    flex: 1,
    backgroundColor: theme.bgDocument,
  },
  documentHeaderCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchBarCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.bgElevated,
    gap: 8,
  },
  searchCountCompact: {
    fontSize: 12,
    color: theme.textMuted,
  },
  documentScrollCompact: {
    flex: 1,
  },
  documentPageCompact: {
    padding: 12,
  },
  agendaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.accentLight,
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 14,
    color: theme.accent,
    fontWeight: '500',
  },
  meetingHeadersSection: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  documentContentSection: {
    padding: 12,
  },
  htmlContentContainer: {
    backgroundColor: theme.bgElevated,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  htmlContentPlaceholder: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  emptyDocContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyDocText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginTop: 12,
  },
  emptyDocSubtext: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 4,
  },
});
