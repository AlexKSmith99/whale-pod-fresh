import { supabase } from '../config/supabase';
import { notificationService } from './notificationService';

export const meetingService = {
  // Create a meeting
  async createMeeting(data: {
    pursuit_id: string;
    creator_id: string;
    title: string;
    description?: string;
    meeting_type: 'in_person' | 'video' | 'hybrid';
    location?: string;
    scheduled_time: string;
    duration_minutes?: number;
    timezone?: string;
    is_kickoff?: boolean;
    recording_enabled?: boolean;
    participant_ids: string[];
  }) {
    console.log('📅 Creating meeting:', data.title);
    console.log('📅 Participant IDs:', data.participant_ids);

    // Create the meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert([{
        pursuit_id: data.pursuit_id,
        creator_id: data.creator_id,
        title: data.title,
        description: data.description,
        meeting_type: data.meeting_type,
        location: data.location,
        scheduled_time: data.scheduled_time,
        duration_minutes: data.duration_minutes || 60,
        timezone: data.timezone || 'America/New_York',
        is_kickoff: data.is_kickoff || false,
        recording_enabled: data.recording_enabled || false,
        status: 'scheduled',
      }])
      .select()
      .single();

    if (meetingError) {
      console.error('❌ Error creating meeting:', meetingError);
      throw meetingError;
    }

    console.log('✅ Meeting created:', meeting.id);

    // Add participants
    const participants = data.participant_ids.map(user_id => ({
      meeting_id: meeting.id,
      user_id,
      status: 'invited',
    }));

    console.log(`📅 Adding ${participants.length} participants to meeting`);

    const { error: participantsError } = await supabase
      .from('meeting_participants')
      .insert(participants);

    if (participantsError) {
      console.error('❌ Error adding participants:', participantsError);
      throw participantsError;
    }

    console.log('✅ Participants added successfully');

    return meeting;
  },

  // Get all meetings for a user
  async getUserMeetings(userId: string) {
    console.log('📅 getUserMeetings called for user:', userId);

    const { data, error } = await supabase
      .from('meeting_participants')
      .select(`
        *,
        meeting:meetings(
          *,
          pursuit:pursuits(id, title)
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error fetching user meetings:', error);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} meeting participations for user`);
    if (data && data.length > 0) {
      console.log('First meeting sample:', JSON.stringify(data[0], null, 2));
    }

    // Sort by meeting scheduled_time in JavaScript
    const sorted = data?.sort((a: any, b: any) => {
      const dateA = new Date(a.meeting.scheduled_time).getTime();
      const dateB = new Date(b.meeting.scheduled_time).getTime();
      return dateA - dateB;
    });

    return sorted || [];
  },

  // Get meetings for a specific pursuit
  async getPursuitMeetings(pursuitId: string) {
    const { data, error } = await supabase
      .from('meetings')
      .select(`
        *,
        participants:meeting_participants(*),
        agenda_items:meeting_agenda_items(*)
      `)
      .eq('pursuit_id', pursuitId)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Get next meeting for a pursuit
  async getNextPursuitMeeting(pursuitId: string) {
    const { data, error } = await supabase
      .from('meetings')
      .select(`
        *,
        participants:meeting_participants(*),
        agenda_items:meeting_agenda_items(*)
      `)
      .eq('pursuit_id', pursuitId)
      .eq('status', 'scheduled')
      .gte('scheduled_time', new Date().toISOString())
      .order('scheduled_time', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
    return data;
  },

  // Update meeting status
  async updateMeetingStatus(meetingId: string, status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled') {
    const { error } = await supabase
      .from('meetings')
      .update({ status })
      .eq('id', meetingId);

    if (error) throw error;
  },

  // Update participant status
  async updateParticipantStatus(meetingId: string, userId: string, status: 'invited' | 'accepted' | 'declined' | 'maybe') {
    const { error } = await supabase
      .from('meeting_participants')
      .update({ status })
      .eq('meeting_id', meetingId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // Submit kickoff time proposals
  async submitKickoffProposal(pursuitId: string, userId: string, proposedTimes: any[], timezone: string) {
    const { error } = await supabase
      .from('kickoff_time_proposals')
      .upsert({
        pursuit_id: pursuitId,
        user_id: userId,
        proposed_times: proposedTimes,
        timezone,
      });

    if (error) throw error;

    // Send notification to creator immediately
    try {
      // Get pursuit details including creator
      const { data: pursuit } = await supabase
        .from('pursuits')
        .select('title, creator_id')
        .eq('id', pursuitId)
        .single();

      if (!pursuit) return;

      // Get submitter's name
      const { data: submitter } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', userId)
        .single();

      const memberName = submitter?.name || submitter?.email?.split('@')[0] || 'A team member';

      // Notify creator that this member submitted their availability
      await notificationService.notifyTimeProposalSubmitted(
        pursuit.creator_id,
        pursuitId,
        pursuit.title,
        memberName
      );
    } catch (notifError) {
      console.error('Error sending time proposal notification:', notifError);
      // Don't throw - notification failure shouldn't block proposal submission
    }

    // Check if all team members have submitted proposals
    try {
      // Get pursuit details including creator
      const { data: pursuit } = await supabase
        .from('pursuits')
        .select('title, creator_id')
        .eq('id', pursuitId)
        .single();

      if (!pursuit) return;

      // Get all team members (excluding creator)
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('pursuit_id', pursuitId)
        .in('status', ['active', 'accepted'])
        .neq('user_id', pursuit.creator_id);

      // Get all proposals
      const { data: proposals } = await supabase
        .from('kickoff_time_proposals')
        .select('user_id')
        .eq('pursuit_id', pursuitId);

      // Check if all team members have submitted
      if (teamMembers && proposals &&
          teamMembers.length === proposals.length &&
          teamMembers.length > 0) {
        // All proposals submitted! Notify creator
        await notificationService.notifyAllProposalsSubmitted(
          pursuit.creator_id,
          pursuitId,
          pursuit.title,
          proposals.length
        );
      }
    } catch (notifError) {
      console.error('Error sending all proposals notification:', notifError);
      // Don't throw - notification failure shouldn't block proposal submission
    }
  },

  // Get kickoff proposals for a pursuit
  async getKickoffProposals(pursuitId: string) {
    // First get proposals
    const { data: proposals, error: proposalsError } = await supabase
      .from('kickoff_time_proposals')
      .select('*')
      .eq('pursuit_id', pursuitId);

    if (proposalsError) throw proposalsError;
    if (!proposals || proposals.length === 0) return [];

    // Then fetch profiles separately
    const userIds = [...new Set(proposals.map(p => p.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Combine proposals with their profiles
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    return proposals.map(proposal => ({
      ...proposal,
      user: profileMap.get(proposal.user_id) || null
    }));
  },

  // Add agenda item
  async addAgendaItem(meetingId: string, creatorId: string, title: string, description?: string) {
    const { data, error } = await supabase
      .from('meeting_agenda_items')
      .insert([{
        meeting_id: meetingId,
        creator_id: creatorId,
        title,
        description,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get agenda items for a meeting
  async getAgendaItems(meetingId: string) {
    const { data, error } = await supabase
      .from('meeting_agenda_items')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Update agenda item
  async updateAgendaItem(itemId: string, updates: { title?: string; description?: string; is_completed?: boolean }) {
    const { error } = await supabase
      .from('meeting_agenda_items')
      .update(updates)
      .eq('id', itemId);

    if (error) throw error;
  },

  // Delete meeting
  async deleteMeeting(meetingId: string) {
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', meetingId);

    if (error) throw error;
  },

  // Update meeting details
  async updateMeeting(meetingId: string, updates: {
    title?: string;
    description?: string;
    scheduled_time?: string;
    duration_minutes?: number;
    meeting_type?: 'in_person' | 'video' | 'hybrid';
    location?: string;
  }) {
    const { data, error } = await supabase
      .from('meetings')
      .update(updates)
      .eq('id', meetingId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get meeting participants with profile info
  async getMeetingParticipants(meetingId: string) {
    // First get participants
    const { data: participants, error: participantsError } = await supabase
      .from('meeting_participants')
      .select('*')
      .eq('meeting_id', meetingId);

    if (participantsError) throw participantsError;
    if (!participants || participants.length === 0) return [];

    // Then fetch profiles separately
    const userIds = participants.map(p => p.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email, profile_picture')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Combine participants with their profiles
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    return participants.map(participant => ({
      ...participant,
      user: profileMap.get(participant.user_id) || null
    }));
  },

  // Add participant to meeting
  async addParticipant(meetingId: string, userId: string) {
    const { error } = await supabase
      .from('meeting_participants')
      .upsert({
        meeting_id: meetingId,
        user_id: userId,
        status: 'invited',
      }, {
        onConflict: 'meeting_id,user_id',
        ignoreDuplicates: true
      });

    if (error) throw error;
  },

  // Remove participant from meeting
  async removeParticipant(meetingId: string, userId: string) {
    const { error } = await supabase
      .from('meeting_participants')
      .delete()
      .eq('meeting_id', meetingId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // Get pod members for adding to meeting
  async getPodMembers(pursuitId: string) {
    // First get team members
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('pursuit_id', pursuitId)
      .in('status', ['active', 'accepted']);

    if (membersError) throw membersError;
    if (!members || members.length === 0) return [];

    // Then fetch profiles separately
    const userIds = members.map(m => m.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email, profile_picture')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Combine members with their profiles
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    return members.map(member => ({
      ...member,
      user: profileMap.get(member.user_id) || null
    }));
  },
};
