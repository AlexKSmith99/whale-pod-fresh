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
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
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
import { useTheme } from '../../theme/ThemeContext';
import { getThemedStyles } from '../../theme/themedStyles';
import GrainTexture from '../../components/ui/GrainTexture';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';

// Aligned with light mode design system — parchment, forest green, sienna
const softTheme = {
  // Backgrounds — warm parchment palette
  bg: '#FAF9F6',              // Raw parchment (matches designSystem)
  bgCard: '#FFFFFF',          // Pure white cards
  bgElevated: '#F2F0EB',     // Warm gray (backgroundSecondary)
  bgHover: '#E8E6E0',        // borderLight tone
  bgDocument: '#FFFFFF',      // Pure white for documents
  bgGradientStart: '#F2F0EB',
  bgGradientMid: '#FAF9F6',
  bgGradientEnd: '#FAF9F6',

  // Accent — forest green (matches legacyColors.primary)
  accent: '#2D5016',          // Forest green
  accentLight: '#E4EDDE',     // primaryLight
  accentDim: 'rgba(45, 80, 22, 0.08)',
  accentSoft: '#4A7A2E',      // Medium forest green

  // Secondary — sienna / burnt orange
  secondary: '#A0522D',       // Sienna
  secondaryLight: '#F5EBE3',  // secondaryLight

  // Text — high-contrast ink
  text: '#1B1B18',            // Near black (textPrimary)
  textSecondary: '#52524E',   // Dark gray (textSecondary)
  textMuted: '#8A8A85',       // Medium gray (textTertiary)

  // Borders & Dividers — hemp / linen
  border: '#D6D3CC',          // Natural border
  divider: '#E8E6E0',         // Soft divider (borderLight)

  // Status
  success: '#2D6B2E',         // Green
  error: '#8B2500',           // Deep red
  highlight: 'rgba(45, 80, 22, 0.20)',
  highlightActive: 'rgba(45, 80, 22, 0.35)',
};

// Keep for backwards compatibility
const localDarkTheme = softTheme;

// Helper function to get local theme colors - always use soft theme for TeamBoard
function getLocalTheme(isNewTheme: boolean, colors: any) {
  // Always use the soft, airy theme for TeamBoard regardless of app theme
  return softTheme;
}

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
  const { theme: appTheme, isNewTheme } = useTheme();
  const appColors = appTheme.colors;
  const themedStyles = getThemedStyles(appColors, isNewTheme);
  const theme = getLocalTheme(isNewTheme, appColors);

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

  // Edit access state — tracks which pages a non-creator has been granted access to
  const [editAccess, setEditAccess] = useState<{ guide: boolean; rules: boolean; roles: boolean }>({ guide: false, rules: false, roles: false });
  const [requestingAccess, setRequestingAccess] = useState<string | null>(null);

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

  // Request edit access — sends notification to pod creator
  const handleRequestEditAccess = async (page: 'guide' | 'rules' | 'roles') => {
    if (!selectedPodId || !user) return;
    setRequestingAccess(page);
    try {
      const { data: pursuit } = await supabase
        .from('pursuits')
        .select('creator_id, title')
        .eq('id', selectedPodId)
        .single();
      if (!pursuit) return;

      const userName = user.name || user.email?.split('@')[0] || 'A member';
      const pageLabel = page === 'guide' ? 'Pod Guide' : page === 'rules' ? 'Pod Rules' : 'Pod Roles';
      await notificationService.sendPushNotification(
        [pursuit.creator_id],
        `${userName} requested edit access`,
        `${userName} wants to edit the ${pageLabel} page for "${pursuit.title}"`,
        { type: 'edit_access_request', pursuitId: selectedPodId, requesterId: user.id, page },
        'edit_access_request',
        selectedPodId,
        'pursuit'
      );
      Alert.alert('Request Sent', 'The pod leader will be notified of your request.');
    } catch (error) {
      console.error('Error requesting edit access:', error);
      Alert.alert('Error', 'Failed to send request');
    } finally {
      setRequestingAccess(null);
    }
  };

  // Grant edit access — called by pod creator from notification
  const handleGrantEditAccess = (page: 'guide' | 'rules' | 'roles') => {
    setEditAccess(prev => ({ ...prev, [page]: true }));
  };

  // Check if user can edit a given page
  const canEditPage = (page: 'guide' | 'rules' | 'roles') => {
    return isCreator || editAccess[page];
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
    } catch (error: any) {
      console.error('Error saving agenda document:', error);
      Alert.alert('Error', 'Failed to save document: ' + (error?.message || JSON.stringify(error)));
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

  // Build inline meeting header HTML — shared between read and edit modes
  const buildMeetingHeadersHtml = () => {
    const upcomingMeetings = podMeetings.filter(m => new Date(m.scheduled_time) >= new Date());
    const pastMeetings = podMeetings.filter(m => new Date(m.scheduled_time) < new Date()).slice(0, 5);
    let html = '';
    upcomingMeetings.forEach((m) => {
      html += `<p style="margin:10px 0 2px; font-size:13px; color:#8A8A85;"><i>${m.title} — ${formatMeetingDateTime(m.scheduled_time)}</i></p>`;
    });
    pastMeetings.forEach((m) => {
      html += `<p style="margin:10px 0 2px; font-size:13px; color:#8A8A85; opacity:0.55;"><i>${m.title} — ${formatMeetingDateTime(m.scheduled_time)}</i></p>`;
    });
    return html;
  };

  const renderAgendaTab = () => {
    const meetingHeadersHtml = buildMeetingHeadersHtml();

    // Full-screen rich text edit mode — include meeting headers as read-only context
    if (isInEditMode) {
      const editContent = meetingHeadersHtml
        ? meetingHeadersHtml + '<hr style="border:none;border-top:1px solid #E8E6E0;margin:12px 0;">' + (agendaDocumentHtml || '')
        : agendaDocumentHtml;

      return (
        <WebRichTextEditor
          initialContent={editContent}
          onChange={handleAgendaContentChange}
          onSave={saveAgendaDocument}
          onCancel={() => {
            setIsInEditMode(false);
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

    const fullHtml = meetingHeadersHtml + (agendaDocumentHtml || '');

    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        {/* Minimal header bar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text, fontFamily: 'Sora_600SemiBold' }}>Pod Doc</Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.bgElevated }}
            onPress={() => setIsInEditMode(true)}
          >
            <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
            <Text style={{ fontSize: 14, color: theme.textSecondary, fontFamily: 'Sora_400Regular' }}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Full-page document */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {fullHtml ? (
            <View style={{ flex: 1, paddingHorizontal: 20, minHeight: SCREEN_HEIGHT - 280 }}>
              <WebView
                originWhitelist={['*']}
                source={{
                  html: `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                        <style>
                          * { margin: 0; padding: 0; box-sizing: border-box; }
                          body {
                            font-family: Georgia, 'Times New Roman', serif;
                            font-size: 16px;
                            line-height: 1.7;
                            color: #1B1B18;
                            background-color: #FFFFFF;
                            padding: 12px 0;
                            word-wrap: break-word;
                          }
                          p { margin-bottom: 14px; }
                          h1, h2, h3 { color: #1B1B18; margin-bottom: 8px; margin-top: 20px; }
                          h1 { font-size: 24px; }
                          h2 { font-size: 20px; }
                          h3 { font-size: 17px; }
                          strong, b { font-weight: 700; }
                          em, i { font-style: italic; }
                          u { text-decoration: underline; }
                          ul, ol { margin-left: 20px; margin-bottom: 14px; }
                          li { margin-bottom: 4px; }
                          blockquote {
                            border-left: 3px solid #D6D3CC;
                            padding-left: 14px;
                            margin: 14px 0;
                            color: #52524E;
                            font-style: italic;
                          }
                          a { color: #2D5016; }
                          code {
                            background-color: #F2F0EB;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-family: monospace;
                            font-size: 14px;
                          }
                          pre {
                            background-color: #F2F0EB;
                            padding: 14px;
                            border-radius: 8px;
                            overflow-x: auto;
                            margin: 14px 0;
                          }
                          hr {
                            border: none;
                            border-top: 1px solid #E8E6E0;
                            margin: 20px 0;
                          }
                        </style>
                      </head>
                      <body>${fullHtml}</body>
                    </html>
                  `
                }}
                style={[styles.htmlWebView, { minHeight: SCREEN_HEIGHT - 300 }]}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 }}>
              <Ionicons name="document-text-outline" size={40} color={theme.textMuted} />
              <Text style={{ fontSize: 16, color: theme.textMuted, marginTop: 12, fontFamily: 'Sora_400Regular' }}>Tap Edit to start writing</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderPodDocTab = () => {
    const canEdit = canEditPage('guide');
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text, fontFamily: 'Sora_600SemiBold' }}>Pod Guide</Text>
          {canEdit ? (
            <TouchableOpacity
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.accent }}
              onPress={handleSavePodDoc}
              disabled={docSaving}
            >
              {docSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600', fontFamily: 'Sora_600SemiBold' }}>Save</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.bgElevated }}
              onPress={() => handleRequestEditAccess('guide')}
              disabled={requestingAccess === 'guide'}
            >
              {requestingAccess === 'guide' ? (
                <ActivityIndicator size="small" color={theme.textMuted} />
              ) : (
                <>
                  <Ionicons name="lock-closed-outline" size={14} color={theme.textMuted} />
                  <Text style={{ fontSize: 13, color: theme.textMuted, fontFamily: 'Sora_400Regular' }}>Request edit access</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textMuted, marginBottom: 8, marginTop: 8, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase' }}>Mission</Text>
          <TextInput
            style={[styles.podDocInput, { borderWidth: 0, backgroundColor: theme.bgElevated }]}
            value={docMission}
            onChangeText={setDocMission}
            placeholder="What is this pod about?"
            placeholderTextColor={theme.textMuted}
            multiline
            textAlignVertical="top"
            editable={canEdit}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textMuted, marginBottom: 8, marginTop: 24, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase' }}>Vision</Text>
          <TextInput
            style={[styles.podDocInput, { borderWidth: 0, backgroundColor: theme.bgElevated }]}
            value={docNorthstar}
            onChangeText={setDocNorthstar}
            placeholder="What does success look like?"
            placeholderTextColor={theme.textMuted}
            multiline
            textAlignVertical="top"
            editable={canEdit}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textMuted, marginBottom: 8, marginTop: 24, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase' }}>References</Text>
          <TextInput
            style={[styles.podDocInput, { minHeight: 200, borderWidth: 0, backgroundColor: theme.bgElevated }]}
            value={docReference}
            onChangeText={setDocReference}
            placeholder="Links, resources, notes..."
            placeholderTextColor={theme.textMuted}
            multiline
            textAlignVertical="top"
            editable={canEdit}
          />
        </ScrollView>
      </View>
    );
  };

  const renderPodRulesTab = () => {
    const canEdit = canEditPage('rules');
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text, fontFamily: 'Sora_600SemiBold' }}>Pod Rules</Text>
          {canEdit ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.bgElevated }}
                onPress={handleUseRulesTemplate}
              >
                <Text style={{ fontSize: 14, color: theme.textSecondary, fontFamily: 'Sora_400Regular' }}>Template</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.accent }}
                onPress={handleSavePodRules}
                disabled={rulesSaving}
              >
                {rulesSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600', fontFamily: 'Sora_600SemiBold' }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.bgElevated }}
              onPress={() => handleRequestEditAccess('rules')}
              disabled={requestingAccess === 'rules'}
            >
              {requestingAccess === 'rules' ? (
                <ActivityIndicator size="small" color={theme.textMuted} />
              ) : (
                <>
                  <Ionicons name="lock-closed-outline" size={14} color={theme.textMuted} />
                  <Text style={{ fontSize: 13, color: theme.textMuted, fontFamily: 'Sora_400Regular' }}>Request edit access</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 100 }}>
          <TextInput
            style={[styles.podDocInput, { minHeight: SCREEN_HEIGHT - 280, borderWidth: 0, backgroundColor: theme.bgElevated }]}
            value={rulesContent}
            onChangeText={setRulesContent}
            placeholder="Guidelines and expectations for this pod..."
            placeholderTextColor={theme.textMuted}
            multiline
            textAlignVertical="top"
            editable={canEdit}
          />
        </ScrollView>
      </View>
    );
  };

  const renderRolesTab = () => {
    const canEdit = canEditPage('roles');
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text, fontFamily: 'Sora_600SemiBold' }}>Pod Roles</Text>
          {!canEdit && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.bgElevated }}
              onPress={() => handleRequestEditAccess('roles')}
              disabled={requestingAccess === 'roles'}
            >
              {requestingAccess === 'roles' ? (
                <ActivityIndicator size="small" color={theme.textMuted} />
              ) : (
                <>
                  <Ionicons name="lock-closed-outline" size={14} color={theme.textMuted} />
                  <Text style={{ fontSize: 13, color: theme.textMuted, fontFamily: 'Sora_400Regular' }}>Request edit access</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
          {teamMembers.map((member) => {
            const memberRole = roles.find((r) => r.user_id === member.id);
            const canEditRole = canEdit && (isCreator || member.id === user?.id);

            return (
              <View key={member.id} style={{ backgroundColor: theme.bgElevated, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
                    onPress={() => handleViewProfile(member.id)}
                  >
                    {member.profile_picture ? (
                      <Image source={{ uri: member.profile_picture }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>{getUserInitials(member)}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text, fontFamily: 'Sora_600SemiBold' }}>{member.name || 'Unknown'}</Text>
                      {memberRole && (
                        <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 2, fontFamily: 'Sora_400Regular' }}>{memberRole.role_title}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {canEditRole && (
                    <TouchableOpacity
                      onPress={() => handleOpenRoleModal(member, memberRole)}
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Ionicons name={memberRole ? "pencil-outline" : "add"} size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                {memberRole?.role_description && (
                  <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginTop: 10, paddingLeft: 56, fontFamily: 'Sora_400Regular' }}>{memberRole.role_description}</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderMediaTab = () => {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text, fontFamily: 'Sora_600SemiBold' }}>Media</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.bgElevated }}
              onPress={() => pickMedia(false)}
              disabled={uploadingMedia}
            >
              {uploadingMedia ? (
                <ActivityIndicator color={theme.textSecondary} size="small" />
              ) : (
                <>
                  <Ionicons name="images-outline" size={16} color={theme.textSecondary} />
                  <Text style={{ fontSize: 14, color: theme.textSecondary, fontFamily: 'Sora_400Regular' }}>Library</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.bgElevated }}
              onPress={() => pickMedia(true)}
              disabled={uploadingMedia}
            >
              <Ionicons name="camera-outline" size={16} color={theme.textSecondary} />
              <Text style={{ fontSize: 14, color: theme.textSecondary, fontFamily: 'Sora_400Regular' }}>Camera</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
          {mediaItems.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 80 }}>
              <Ionicons name="images-outline" size={40} color={theme.textMuted} />
              <Text style={{ fontSize: 16, color: theme.textMuted, marginTop: 12, fontFamily: 'Sora_400Regular' }}>No media yet</Text>
            </View>
          ) : (
            <View style={styles.mediaGrid}>
              {mediaItems.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.mediaItem, { borderWidth: 0, borderRadius: 10 }]}
                  onPress={() => openImageViewer(index)}
                  activeOpacity={0.9}
                >
                  <Image source={{ uri: item.photo_url }} style={styles.mediaImage} />
                  {item.uploaded_by === user?.id && (
                    <TouchableOpacity
                      style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteMedia(item.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
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
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.bgCard }]}>
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
              <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
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
          <Text style={styles.sidebarTitle}>Pods</Text>
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
                  {(['agenda', 'doc', 'rules', 'roles', 'media'] as SubTab[]).map((tab) => {
                    // Avant-garde icon representations for each tab
                    const getTabIcon = () => {
                      switch (tab) {
                        case 'agenda': return 'flash-outline'; // Energy, action items, dynamic flow
                        case 'doc': return 'binoculars-outline'; // Pod Guide - overview/vision
                        case 'rules': return 'shield-checkmark-outline'; // Protection, guidelines, structure
                        case 'roles': return 'finger-print-outline'; // Identity, uniqueness
                        case 'media': return 'aperture-outline'; // Creative lens, visual focus
                        default: return 'ellipse-outline';
                      }
                    };
                    const isActive = activeSubTab === tab;
                    return (
                      <TouchableOpacity
                        key={tab}
                        style={[styles.tab, isActive && styles.tabActive]}
                        onPress={() => setActiveSubTab(tab)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={getTabIcon() as any}
                          size={24}
                          color={isActive ? theme.text : theme.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
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
    backgroundColor: softTheme.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: softTheme.bg,
  },

  // Header - bold, defined
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 12,
    backgroundColor: softTheme.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: softTheme.divider,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: softTheme.text,
    letterSpacing: 0.3,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  podSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  podName: {
    fontSize: 15,
    fontWeight: '500',
    color: softTheme.textSecondary,
    maxWidth: 220,
    fontFamily: 'Sora_400Regular',
  },
  headerPodPicture: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 6,
    borderWidth: 1,
    borderColor: softTheme.border,
  },
  menuBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Main Area
  mainArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: softTheme.bg,
  },

  // Sidebar - bold, defined
  sidebarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 26, 0.5)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: softTheme.bgCard,
    zIndex: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: softTheme.border,
  },
  sidebarTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: softTheme.text,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 18,
    fontFamily: 'Sora_700Bold',
  },
  podList: {
    flex: 1,
  },
  podItem: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: localDarkTheme.bgElevated,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: localDarkTheme.divider,
  },
  podItemActive: {
    backgroundColor: localDarkTheme.accentLight,
    borderColor: localDarkTheme.accent,
    borderWidth: 1,
  },
  podItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: localDarkTheme.text,
    fontFamily: 'Lora_500Medium',
  },
  podItemTextActive: {
    color: localDarkTheme.accent,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
  },
  podItemIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: localDarkTheme.accent,
  },
  podItemPicture: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },
  podItemPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: localDarkTheme.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },

  // Content
  content: {
    flex: 1,
    backgroundColor: localDarkTheme.bg,
  },

  // Tab Bar - Icon only, avant-garde style
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: softTheme.bgElevated,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Sora_700Bold',
    color: localDarkTheme.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },

  // Tab Content
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Document Styles - Bold, defined
  documentContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  documentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savingText: {
    fontSize: 13,
    color: softTheme.textSecondary,
    fontFamily: 'Lora_400Regular',
  },
  modeBadge: {
    backgroundColor: softTheme.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: softTheme.accent,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: softTheme.accent,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 1.5,
  },
  docMenuButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: softTheme.bgCard,
  },
  documentScroll: {
    flex: 1,
  },
  documentPage: {
    backgroundColor: softTheme.bgDocument,
    borderRadius: 12,
    padding: 20,
    minHeight: SCREEN_HEIGHT - 280,
    borderWidth: 1,
    borderColor: softTheme.border,
  },
  documentTouchable: {
    flex: 1,
    minHeight: 400,
  },
  documentText: {
    fontSize: 17,
    color: softTheme.text,
    lineHeight: 26,
    fontFamily: 'Lora_400Regular',
  },
  documentPlaceholder: {
    fontSize: 17,
    color: softTheme.textMuted,
    lineHeight: 26,
    fontStyle: 'italic',
    fontFamily: 'Lora_400Regular',
  },
  documentInput: {
    fontSize: 17,
    color: softTheme.text,
    lineHeight: 26,
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: 'Lora_400Regular',
  },
  fullDocumentEdit: {
    minHeight: 350,
    backgroundColor: softTheme.bgElevated,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: softTheme.accent,
  },
  editModeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  editModeCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: softTheme.bgElevated,
    borderWidth: 1,
    borderColor: softTheme.divider,
  },
  editModeCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: localDarkTheme.text,
    fontFamily: 'Lora_600SemiBold',
  },
  editModeSaveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: localDarkTheme.accent,
  },
  editModeSaveBtnDisabled: {
    opacity: 0.5,
  },
  editModeSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Lora_700Bold',
  },
  newContributionInput: {
    marginTop: 16,
    minHeight: 80,
    backgroundColor: localDarkTheme.bgElevated,
    borderRadius: 8,
    padding: 12,
  },
  highlightedText: {
    backgroundColor: localDarkTheme.highlight,
  },
  activeHighlight: {
    backgroundColor: localDarkTheme.highlightActive,
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: localDarkTheme.bgCard,
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: localDarkTheme.bgElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: localDarkTheme.text,
    padding: 0,
    fontFamily: 'Lora_400Regular',
  },
  searchNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchCount: {
    fontSize: 14,
    color: localDarkTheme.textSecondary,
    marginRight: 6,
    fontFamily: 'Lora_400Regular',
  },
  searchNavBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: localDarkTheme.bgElevated,
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
    backgroundColor: localDarkTheme.bgCard,
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
    backgroundColor: localDarkTheme.bgElevated,
  },
  formatBtnActive: {
    backgroundColor: localDarkTheme.accent,
  },
  formatBtnText: {
    fontSize: 16,
    color: localDarkTheme.text,
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
    backgroundColor: localDarkTheme.border,
    marginHorizontal: 8,
  },
  formatDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: localDarkTheme.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  formatDropdownText: {
    fontSize: 15,
    color: localDarkTheme.text,
    fontWeight: '600',
    fontFamily: 'Lora_600SemiBold',
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },
  pickerDropdown: {
    backgroundColor: localDarkTheme.bgCard,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: localDarkTheme.divider,
  },
  pickerOptionActive: {
    backgroundColor: localDarkTheme.accentLight,
  },
  pickerOptionText: {
    color: localDarkTheme.text,
    fontWeight: '500',
    fontFamily: 'Lora_500Medium',
    fontSize: 15,
  },
  pickerOptionTextActive: {
    color: localDarkTheme.accent,
    fontFamily: 'Lora_700Bold',
  },
  colorPickerDropdown: {
    backgroundColor: localDarkTheme.bgCard,
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: localDarkTheme.accent,
  },

  // Edit History
  editHistoryBlock: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: localDarkTheme.divider,
  },
  editHistoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  editHistoryAuthor: {
    backgroundColor: localDarkTheme.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  editHistoryInitials: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Lora_700Bold',
  },
  editHistoryTime: {
    fontSize: 13,
    color: localDarkTheme.textSecondary,
    fontFamily: 'Lora_400Regular',
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
    backgroundColor: localDarkTheme.bgCard,
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
    fontSize: 16,
    fontWeight: '600',
    color: localDarkTheme.text,
    fontFamily: 'Lora_600SemiBold',
  },
  menuItemTextActive: {
    color: localDarkTheme.accent,
    fontFamily: 'Lora_700Bold',
  },
  menuDivider: {
    height: 1,
    backgroundColor: localDarkTheme.divider,
    marginHorizontal: 16,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 70,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: localDarkTheme.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: localDarkTheme.text,
    marginBottom: 10,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 0.5,
  },
  emptySubtitle: {
    fontSize: 16,
    color: localDarkTheme.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
    fontFamily: 'Lora_400Regular',
  },

  // Role Card
  roleCard: {
    backgroundColor: localDarkTheme.bgCard,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: localDarkTheme.border,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: localDarkTheme.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Lora_700Bold',
  },
  memberNameContainer: {
    flex: 1,
  },
  memberNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: localDarkTheme.text,
    fontFamily: 'Lora_700Bold',
  },
  viewProfileLink: {
    fontSize: 13,
    color: localDarkTheme.accent,
    fontWeight: '600',
    marginTop: 3,
    fontFamily: 'Lora_600SemiBold',
  },
  roleEditBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: localDarkTheme.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleContent: {
    paddingLeft: 62,
  },
  roleTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: localDarkTheme.accent,
    marginBottom: 4,
    fontFamily: 'Lora_700Bold',
  },
  roleDescText: {
    fontSize: 15,
    color: localDarkTheme.text,
    lineHeight: 22,
    fontFamily: 'Lora_400Regular',
  },
  roleDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  roleDeleteText: {
    fontSize: 13,
    color: localDarkTheme.error,
    fontFamily: 'Lora_400Regular',
  },
  noRoleText: {
    fontSize: 15,
    color: localDarkTheme.textMuted,
    fontStyle: 'italic',
    paddingLeft: 62,
    fontFamily: 'Lora_400Regular',
  },

  // Upload Row
  uploadRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: localDarkTheme.bgCard,
    paddingVertical: 18,
    borderRadius: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },
  uploadBtnDisabled: {
    opacity: 0.5,
  },
  uploadBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: localDarkTheme.accent,
    fontFamily: 'Lora_700Bold',
  },

  // Media Grid
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  mediaItem: {
    width: (SCREEN_WIDTH - 54) / 3,
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: localDarkTheme.bgCard,
    borderWidth: 1,
    borderColor: localDarkTheme.border,
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
    fontSize: 11,
    color: '#fff',
    flex: 1,
    fontFamily: 'Lora_400Regular',
  },
  mediaDeleteBtn: {
    padding: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: localDarkTheme.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: localDarkTheme.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: localDarkTheme.border,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: localDarkTheme.text,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.5,
  },
  modalClose: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: localDarkTheme.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },
  modalBody: {
    padding: 24,
    maxHeight: 420,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: localDarkTheme.text,
    marginBottom: 10,
    marginTop: 18,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontFamily: 'Sora_700Bold',
  },
  memberLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: localDarkTheme.accent,
    marginBottom: 8,
    fontFamily: 'Lora_700Bold',
  },
  input: {
    backgroundColor: localDarkTheme.bgElevated,
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: localDarkTheme.text,
    fontFamily: 'Lora_400Regular',
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },
  textArea: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: localDarkTheme.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: localDarkTheme.bgElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: localDarkTheme.text,
    fontFamily: 'Lora_600SemiBold',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: localDarkTheme.accent,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Lora_700Bold',
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
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Lora_700Bold',
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
    fontSize: 15,
    color: '#aaa',
    marginTop: 14,
    fontFamily: 'Lora_400Regular',
  },

  // Pod Doc & Rules styles - bold, larger
  podDocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: localDarkTheme.border,
  },
  podDocTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: localDarkTheme.text,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 1,
  },
  saveDocButton: {
    backgroundColor: softTheme.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveDocButtonDisabled: {
    opacity: 0.5,
  },
  saveDocButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    fontFamily: 'Lora_600SemiBold',
  },
  templateButton: {
    backgroundColor: softTheme.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: softTheme.border,
  },
  templateButtonText: {
    color: softTheme.text,
    fontWeight: '600',
    fontSize: 14,
    fontFamily: 'Lora_600SemiBold',
  },
  podDocSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: softTheme.divider,
  },
  podDocSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: softTheme.text,
    marginBottom: 6,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 0.5,
  },
  podDocSectionHint: {
    fontSize: 14,
    color: softTheme.textSecondary,
    marginBottom: 12,
    fontFamily: 'Lora_400Regular',
  },
  podDocInput: {
    backgroundColor: softTheme.bgElevated,
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: softTheme.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: softTheme.border,
    fontFamily: 'Lora_400Regular',
  },
  rulesHint: {
    fontSize: 15,
    color: softTheme.textSecondary,
    padding: 16,
    paddingBottom: 10,
    fontFamily: 'Lora_400Regular',
  },

  // Meeting Headers in Document Styles - Bold, defined
  meetingSectionHeader: {
    marginBottom: 12,
  },
  meetingsSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: softTheme.accent,
    letterSpacing: 2.5,
    fontFamily: 'Sora_700Bold',
    textTransform: 'uppercase',
  },
  meetingHeaderBlock: {
    backgroundColor: softTheme.bgElevated,
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: softTheme.accent,
  },
  pastMeetingHeaderBlock: {
    opacity: 0.7,
  },
  meetingHeaderBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: softTheme.accent,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  pastMeetingHeaderBar: {
    backgroundColor: softTheme.textMuted,
  },
  meetingHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: softTheme.text,
    marginBottom: 4,
    fontFamily: 'Lora_600SemiBold',
  },
  meetingHeaderDate: {
    fontSize: 14,
    color: softTheme.textSecondary,
    fontFamily: 'Lora_400Regular',
  },
  meetingHeaderStatus: {
    fontSize: 12,
    color: softTheme.textMuted,
    marginTop: 4,
    fontFamily: 'Lora_400Regular',
  },
  notesAreaDivider: {
    marginTop: 20,
    marginBottom: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: softTheme.border,
  },
  notesAreaLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: softTheme.text,
    letterSpacing: 2.5,
    fontFamily: 'Sora_700Bold',
    textTransform: 'uppercase',
  },
  emptyDocumentText: {
    fontSize: 16,
    color: softTheme.textMuted,
    fontStyle: 'italic',
    lineHeight: 24,
    fontFamily: 'Lora_400Regular',
  },

  // Formatting Toolbar Styles
  formattingToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: localDarkTheme.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },
  formattingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formattingDivider: {
    width: 1,
    height: 24,
    backgroundColor: localDarkTheme.border,
    marginHorizontal: 10,
  },
  formatBtnTextBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: localDarkTheme.text,
  },
  formatBtnTextItalic: {
    fontSize: 16,
    fontStyle: 'italic',
    color: localDarkTheme.text,
  },
  formatBtnTextUnderline: {
    fontSize: 16,
    textDecorationLine: 'underline',
    color: localDarkTheme.text,
  },
  textSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: localDarkTheme.bgHover,
    gap: 4,
  },
  textSettingsBtnText: {
    fontSize: 15,
    color: localDarkTheme.text,
    fontWeight: '600',
    fontFamily: 'Lora_600SemiBold',
  },
  textSettingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textSettingsContainer: {
    backgroundColor: localDarkTheme.bgCard,
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 320,
  },
  textSettingsTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: localDarkTheme.text,
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.5,
  },
  textSettingsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: localDarkTheme.text,
    marginBottom: 12,
    marginTop: 16,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  textSettingsOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  textSettingsOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: localDarkTheme.bgElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },
  textSettingsOptionActive: {
    borderColor: localDarkTheme.accent,
    backgroundColor: localDarkTheme.accentLight,
  },
  textSettingsOptionText: {
    fontSize: 15,
    color: localDarkTheme.textSecondary,
    fontFamily: 'Lora_400Regular',
  },
  textSettingsOptionTextActive: {
    color: localDarkTheme.accent,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
  },

  // Compact Edit Mode Styles
  editModeContainer: {
    flex: 1,
    backgroundColor: localDarkTheme.bg,
  },
  editModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: localDarkTheme.divider,
  },
  editModeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editModeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: localDarkTheme.text,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 0.5,
  },
  compactToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: localDarkTheme.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: localDarkTheme.border,
  },
  compactFormatBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactFormatBtnActive: {
    backgroundColor: localDarkTheme.accentLight,
  },
  compactFormatBtnBold: {
    fontSize: 14,
    fontWeight: 'bold',
    color: localDarkTheme.text,
  },
  compactFormatBtnItalic: {
    fontSize: 14,
    fontStyle: 'italic',
    color: localDarkTheme.text,
  },
  compactFormatBtnUnderline: {
    fontSize: 14,
    textDecorationLine: 'underline',
    color: localDarkTheme.text,
  },
  compactDivider: {
    width: 1,
    height: 20,
    backgroundColor: localDarkTheme.border,
    marginHorizontal: 6,
  },
  compactTextSettingsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: localDarkTheme.bgHover,
  },
  compactTextSettingsBtnText: {
    fontSize: 14,
    color: localDarkTheme.text,
    fontWeight: '600',
    fontFamily: 'Lora_600SemiBold',
  },
  fullScreenEditor: {
    flex: 1,
    padding: 16,
    color: localDarkTheme.text,
    textAlignVertical: 'top',
    fontFamily: 'Lora_400Regular',
    fontSize: 17,
  },

  // Compact Read Mode Styles
  documentContainerCompact: {
    flex: 1,
    backgroundColor: localDarkTheme.bgDocument,
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
    backgroundColor: localDarkTheme.bgElevated,
    gap: 8,
  },
  searchCountCompact: {
    fontSize: 14,
    color: localDarkTheme.textSecondary,
    fontFamily: 'Lora_400Regular',
  },
  documentScrollCompact: {
    flex: 1,
  },
  documentPageCompact: {
    padding: 12,
  },
  agendaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: localDarkTheme.text,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 0.5,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: localDarkTheme.bgElevated,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 14,
    color: localDarkTheme.textSecondary,
    fontWeight: '500',
    fontFamily: 'Sora_400Regular',
  },
  meetingHeadersSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: localDarkTheme.border,
  },
  documentContentSection: {
    padding: 16,
  },
  htmlContentContainer: {
    backgroundColor: localDarkTheme.bgElevated,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    minHeight: 180,
    borderWidth: 1,
    borderColor: localDarkTheme.border,
  },
  htmlWebView: {
    backgroundColor: 'transparent',
    minHeight: 120,
    flex: 1,
  },
  htmlContentPlaceholder: {
    fontSize: 16,
    color: localDarkTheme.textSecondary,
    lineHeight: 24,
    fontFamily: 'Lora_400Regular',
  },
  emptyDocContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyDocText: {
    fontSize: 20,
    fontWeight: '700',
    color: localDarkTheme.text,
    marginTop: 16,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 0.5,
  },
  emptyDocSubtext: {
    fontSize: 15,
    color: localDarkTheme.textSecondary,
    marginTop: 6,
    fontFamily: 'Lora_400Regular',
  },
});
