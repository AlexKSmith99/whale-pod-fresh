import { supabase } from '../config/supabase';

// Valid allowlist values
export const ALLOWLIST_OPTIONS = [
  { key: 'none', label: 'Visible to no one', exclusive: true },
  { key: 'connections', label: 'Visible to connections' },
  { key: 'pod_members', label: 'Visible to Pod members' },
  { key: 'pod_creator_when_applying', label: 'Visible to Pod creator when applying' },
  { key: 'everyone', label: 'Visible to everyone' },
] as const;

export type AllowlistValue = 'none' | 'connections' | 'pod_members' | 'pod_creator_when_applying' | 'everyone';

export interface PrivacyPreferences {
  user_id: string;
  profile_access_allowlist: AllowlistValue[];
  socials_allowlist: AllowlistValue[];
  reviews_allowlist: AllowlistValue[];
  pods_tab_allowlist: AllowlistValue[];
  connections_allowlist: AllowlistValue[];
  pod_public_roster_listed: boolean;
  pod_public_roster_profile_clickable: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ViewerRelationship {
  isSelf: boolean;
  isConnection: boolean;
  isSharedPodMember: boolean;
  isCreatorForApplicant: boolean;
  isPodCreator: boolean; // Target user is a pod creator
}

const DEFAULT_PREFERENCES: Omit<PrivacyPreferences, 'user_id'> = {
  profile_access_allowlist: ['everyone'],
  socials_allowlist: ['everyone'],
  reviews_allowlist: ['everyone'],
  pods_tab_allowlist: ['everyone'],
  connections_allowlist: ['everyone'],
  pod_public_roster_listed: true,
  pod_public_roster_profile_clickable: true,
};

export const privacyService = {
  // Get privacy preferences for a user (creates defaults if not exists)
  async getPreferences(userId: string): Promise<PrivacyPreferences> {
    try {
      // Try to get existing preferences
      const { data, error } = await supabase
        .from('privacy_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned - that's expected if no prefs exist yet
        // For other errors, log but continue with defaults
        console.log('Note: Could not fetch privacy preferences, using defaults');
      }

      if (data) {
        return data as PrivacyPreferences;
      }

      // No existing preferences - try to create defaults using upsert
      // This handles both insert and "already exists" cases gracefully
      const { data: newData, error: upsertError } = await supabase
        .from('privacy_preferences')
        .upsert({
          user_id: userId,
          ...DEFAULT_PREFERENCES,
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (upsertError) {
        // If upsert fails (RLS or other), just return defaults
        // This is non-fatal - the app works fine with defaults
        console.log('Using default privacy preferences');
        return { user_id: userId, ...DEFAULT_PREFERENCES };
      }

      return newData as PrivacyPreferences;
    } catch (error) {
      // Any unexpected error - return defaults
      console.log('Using default privacy preferences');
      return { user_id: userId, ...DEFAULT_PREFERENCES };
    }
  },

  // Update privacy preferences
  async updatePreferences(userId: string, updates: Partial<PrivacyPreferences>): Promise<PrivacyPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('privacy_preferences')
        .upsert({
          user_id: userId,
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating privacy preferences:', error);
        return null;
      }

      return data as PrivacyPreferences;
    } catch (error) {
      console.error('Error in updatePreferences:', error);
      return null;
    }
  },

  // Get viewer's relationship to target user
  async getViewerRelationship(viewerId: string | null, targetUserId: string): Promise<ViewerRelationship> {
    const result: ViewerRelationship = {
      isSelf: false,
      isConnection: false,
      isSharedPodMember: false,
      isCreatorForApplicant: false,
      isPodCreator: false,
    };

    // Check if target is a pod creator
    try {
      const { data: creatorCheck } = await supabase
        .from('pursuits')
        .select('id')
        .eq('creator_id', targetUserId)
        .limit(1);
      
      result.isPodCreator = !!(creatorCheck && creatorCheck.length > 0);
    } catch (error) {
      console.error('Error checking pod creator status:', error);
    }

    if (!viewerId) {
      return result;
    }

    // Check if self
    result.isSelf = viewerId === targetUserId;
    if (result.isSelf) {
      return result; // No need to check other relationships
    }

    // Check if connected
    try {
      const { data: connectionData } = await supabase
        .from('connections')
        .select('id')
        .eq('status', 'accepted')
        .or(`and(user_id_1.eq.${viewerId},user_id_2.eq.${targetUserId}),and(user_id_1.eq.${targetUserId},user_id_2.eq.${viewerId})`)
        .limit(1);

      result.isConnection = !!(connectionData && connectionData.length > 0);
    } catch (error) {
      console.error('Error checking connection:', error);
    }

    // Check if shared pod member
    try {
      // Get viewer's pods (as creator or member)
      const { data: viewerPods } = await supabase
        .from('team_members')
        .select('pursuit_id')
        .eq('user_id', viewerId)
        .in('status', ['active', 'accepted']);

      const { data: viewerCreatedPods } = await supabase
        .from('pursuits')
        .select('id')
        .eq('creator_id', viewerId);

      const viewerPodIds = [
        ...(viewerPods?.map(p => p.pursuit_id) || []),
        ...(viewerCreatedPods?.map(p => p.id) || []),
      ];

      if (viewerPodIds.length > 0) {
        // Check if target is in any of viewer's pods
        const { data: targetMemberships } = await supabase
          .from('team_members')
          .select('pursuit_id')
          .eq('user_id', targetUserId)
          .in('pursuit_id', viewerPodIds)
          .in('status', ['active', 'accepted']);

        const { data: targetCreatedPods } = await supabase
          .from('pursuits')
          .select('id')
          .eq('creator_id', targetUserId)
          .in('id', viewerPodIds);

        result.isSharedPodMember =
          !!(targetMemberships && targetMemberships.length > 0) ||
          !!(targetCreatedPods && targetCreatedPods.length > 0);
      }
    } catch (error) {
      console.error('Error checking shared pod membership:', error);
    }

    // Check if viewer is creator of a pod where target has applied
    try {
      const { data: creatorForApplicant } = await supabase
        .from('pursuit_applications')
        .select('id, pursuits!inner(creator_id)')
        .eq('applicant_id', targetUserId)
        .in('status', ['pending', 'interview_pending', 'interview_scheduled']);

      if (creatorForApplicant) {
        result.isCreatorForApplicant = creatorForApplicant.some(
          (app: any) => app.pursuits?.creator_id === viewerId
        );
      }
    } catch (error) {
      console.error('Error checking creator for applicant:', error);
    }

    return result;
  },

  // Check if viewer can view a specific section
  canViewSection(
    allowlist: AllowlistValue[],
    relationship: ViewerRelationship,
    section: 'profile_access' | 'socials' | 'reviews' | 'pods_tab' | 'connections'
  ): boolean {
    // Self can always see everything
    if (relationship.isSelf) {
      return true;
    }

    // Handle null/empty allowlist - default to everyone
    if (!allowlist || allowlist.length === 0) {
      return true;
    }

    // Check for 'none' - blocks everyone except self
    if (allowlist.includes('none')) {
      return false;
    }

    // Check for 'everyone' - allows all
    if (allowlist.includes('everyone')) {
      return true;
    }

    // Special rule: Pod creators' profiles are always accessible
    if (section === 'profile_access' && relationship.isPodCreator) {
      return true;
    }

    // Check relationship-based access
    if (allowlist.includes('connections') && relationship.isConnection) {
      return true;
    }

    if (allowlist.includes('pod_members') && relationship.isSharedPodMember) {
      return true;
    }

    if (allowlist.includes('pod_creator_when_applying') && relationship.isCreatorForApplicant) {
      return true;
    }

    return false;
  },

  // Convenience method to check all sections at once
  async checkAllSectionVisibility(
    viewerId: string | null,
    targetUserId: string
  ): Promise<{
    canAccessProfile: boolean;
    canViewSocials: boolean;
    canViewReviews: boolean;
    canViewPodsTab: boolean;
    canViewConnections: boolean;
    relationship: ViewerRelationship;
  }> {
    const relationship = await this.getViewerRelationship(viewerId, targetUserId);
    const prefs = await this.getPreferences(targetUserId);

    return {
      canAccessProfile: this.canViewSection(prefs.profile_access_allowlist, relationship, 'profile_access'),
      canViewSocials: this.canViewSection(prefs.socials_allowlist, relationship, 'socials'),
      canViewReviews: this.canViewSection(prefs.reviews_allowlist, relationship, 'reviews'),
      canViewPodsTab: this.canViewSection(prefs.pods_tab_allowlist, relationship, 'pods_tab'),
      canViewConnections: this.canViewSection(prefs.connections_allowlist, relationship, 'connections'),
      relationship,
    };
  },

  // Get user's pods (for Pods tab)
  async getUserPods(userId: string): Promise<any[]> {
    try {
      console.log('📦 getUserPods called for userId:', userId);
      
      // Get pods where user is creator
      const { data: createdPods, error: createdError } = await supabase
        .from('pursuits')
        .select('id, title, status, default_picture, created_at, current_members_count')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false });

      console.log('📦 Created pods:', createdPods?.length, createdError);

      // Get memberships for this user
      const { data: memberships, error: memberError } = await supabase
        .from('team_members')
        .select('pursuit_id, status, joined_at')
        .eq('user_id', userId);
      
      console.log('📦 Memberships:', memberships?.length, memberError);

      // Get the pursuit IDs from memberships
      const memberPursuitIds = (memberships || []).map(m => m.pursuit_id).filter(Boolean);
      
      // Fetch the pursuit details for memberships
      let memberPods: any[] = [];
      if (memberPursuitIds.length > 0) {
        const { data: pursuitData } = await supabase
          .from('pursuits')
          .select('id, title, status, default_picture, created_at, current_members_count')
          .in('id', memberPursuitIds);

        // Merge pursuit data with membership data
        memberPods = (pursuitData || []).map(p => {
          const membership = memberships?.find(m => m.pursuit_id === p.id);
          return {
            ...p,
            membership_status: membership?.status,
            joined_at: membership?.joined_at,
          };
        });
      }

      // Combine and dedupe (creators shouldn't also appear as members)
      const createdPodIds = new Set((createdPods || []).map(p => p.id));
      const allPods = [
        ...(createdPods?.map(p => ({ ...p, isCreator: true })) || []),
        ...memberPods.filter(mp => !createdPodIds.has(mp.id)).map(p => ({ ...p, isCreator: false })),
      ];

      console.log('📦 All pods combined:', allPods.length, allPods.map(p => ({ id: p.id, title: p.title, status: p.status, membership_status: p.membership_status })));

      // Separate into current and past
      // Current: awaiting_kickoff, collecting_proposals, active, or null/undefined (for older pods)
      // Past: completed, archived, or membership left/removed
      const currentPods = allPods.filter(p => 
        !p.status || // null/undefined status = current (default)
        ['awaiting_kickoff', 'collecting_proposals', 'active'].includes(p.status) || 
        (p.membership_status && ['active', 'accepted'].includes(p.membership_status))
      );

      const pastPods = allPods.filter(p => 
        (['completed', 'archived'].includes(p.status) ||
        (p.membership_status && ['left', 'removed'].includes(p.membership_status))) &&
        !currentPods.some(cp => cp.id === p.id)
      );

      console.log('📦 Current pods:', currentPods.length);
      console.log('📦 Past pods:', pastPods.length);

      // Fetch members for each pod (for collage display)
      const podsWithMembers = await Promise.all(
        [...currentPods, ...pastPods].map(async (pod) => {
          try {
            // Get creator
            const { data: pursuit } = await supabase
              .from('pursuits')
              .select('creator_id, creator:profiles!creator_id(id, name, profile_picture)')
              .eq('id', pod.id)
              .single();

            // Get team members
            const { data: teamMembers } = await supabase
              .from('team_members')
              .select('user:profiles!user_id(id, name, profile_picture)')
              .eq('pursuit_id', pod.id)
              .in('status', ['active', 'accepted']);

            const members: { id: string; name?: string; profile_picture?: string }[] = [];

            if (pursuit?.creator) {
              members.push(pursuit.creator as any);
            }

            teamMembers?.forEach((m: any) => {
              if (m.user && m.user.id !== pursuit?.creator_id) {
                members.push(m.user);
              }
            });

            return { ...pod, members };
          } catch (error) {
            console.error('Error fetching members for pod:', pod.id, error);
            return { ...pod, members: [] };
          }
        })
      );

      return podsWithMembers;
    } catch (error) {
      console.error('Error getting user pods:', error);
      return [];
    }
  },

  // Check if user should be shown in public pod roster
  async shouldShowInPublicRoster(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs.pod_public_roster_listed;
  },

  // Check if user's profile is clickable from public pod roster
  async isProfileClickableFromRoster(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs.pod_public_roster_profile_clickable;
  },

  // Process allowlist update with exclusive 'none' logic
  processAllowlistUpdate(
    currentList: AllowlistValue[],
    toggledValue: AllowlistValue
  ): AllowlistValue[] {
    // If toggling 'none'
    if (toggledValue === 'none') {
      // If 'none' is already selected, deselect it
      if (currentList.includes('none')) {
        return [];
      }
      // Select only 'none', clearing everything else
      return ['none'];
    }

    // If toggling any other value
    let newList = [...currentList];

    // Remove 'none' if it was selected
    newList = newList.filter(v => v !== 'none');

    // Toggle the value
    if (newList.includes(toggledValue)) {
      newList = newList.filter(v => v !== toggledValue);
    } else {
      newList.push(toggledValue);
    }

    return newList;
  },
};

