import { supabase } from '../config/supabase';

export interface TimeSlotProposal {
  id: string;
  pursuit_id: string;
  user_id: string;
  proposed_slots: {
    datetime: string; // ISO date-time string
    location_type: 'video' | 'in_person';
    location_details?: string;
  }[];
  created_at: string;
}

export interface KickoffMeeting {
  id: string;
  pursuit_id: string;
  scheduled_date: string;
  location_type: 'video' | 'in_person';
  location_details?: string;
  google_calendar_event_id?: string;
  meeting_notes_id?: string;
  created_by: string;
  created_at: string;
}

export const kickoffService = {
  // Submit time slot proposals from a team member
  async submitTimeSlotProposals(
    pursuitId: string,
    userId: string,
    proposals: { datetime: string; location_type: 'video' | 'in_person'; location_details?: string }[]
  ) {
    // Check if user already submitted proposals
    const { data: existing } = await supabase
      .from('time_slot_proposals')
      .select('id')
      .eq('pursuit_id', pursuitId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update existing proposals
      const { data, error } = await supabase
        .from('time_slot_proposals')
        .update({ proposed_slots: proposals })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new proposals
      const { data, error } = await supabase
        .from('time_slot_proposals')
        .insert([
          {
            pursuit_id: pursuitId,
            user_id: userId,
            proposed_slots: proposals,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Get all time slot proposals for a pursuit
  async getTimeSlotProposals(pursuitId: string): Promise<TimeSlotProposal[]> {
    const { data, error } = await supabase
      .from('time_slot_proposals')
      .select('*')
      .eq('pursuit_id', pursuitId);

    if (error) throw error;
    return data || [];
  },

  // Check if a user has submitted proposals
  async hasUserSubmittedProposals(pursuitId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('time_slot_proposals')
      .select('id')
      .eq('pursuit_id', pursuitId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return !!data;
  },

  // Get count of submitted proposals
  async getProposalCount(pursuitId: string): Promise<number> {
    const { count, error } = await supabase
      .from('time_slot_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('pursuit_id', pursuitId);

    if (error) throw error;
    return count || 0;
  },

  // Creator selects the final kickoff time
  async scheduleKickoffMeeting(
    pursuitId: string,
    creatorId: string,
    selectedSlot: {
      datetime: string;
      location_type: 'video' | 'in_person';
      location_details?: string;
    }
  ) {
    const { data, error } = await supabase
      .from('kickoff_meetings')
      .insert([
        {
          pursuit_id: pursuitId,
          scheduled_date: selectedSlot.datetime,
          location_type: selectedSlot.location_type,
          location_details: selectedSlot.location_details,
          created_by: creatorId,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Update pursuit status to active and mark kickoff as scheduled
    const { error: pursuitError } = await supabase
      .from('pursuits')
      .update({
        status: 'active',
        kickoff_scheduled: true,
        kickoff_date: selectedSlot.datetime,
      })
      .eq('id', pursuitId);

    if (pursuitError) throw pursuitError;

    return data;
  },

  // Get kickoff meeting details
  async getKickoffMeeting(pursuitId: string): Promise<KickoffMeeting | null> {
    const { data, error } = await supabase
      .from('kickoff_meetings')
      .select('*')
      .eq('pursuit_id', pursuitId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Update kickoff meeting with Google Calendar event ID
  async updateCalendarEventId(kickoffMeetingId: string, eventId: string) {
    const { error } = await supabase
      .from('kickoff_meetings')
      .update({ google_calendar_event_id: eventId })
      .eq('id', kickoffMeetingId);

    if (error) throw error;
  },

  // Add pre-meeting notes
  async addMeetingNotes(
    kickoffMeetingId: string,
    userId: string,
    notes: string,
    isShared: boolean
  ) {
    const { data, error } = await supabase
      .from('meeting_notes')
      .insert([
        {
          kickoff_meeting_id: kickoffMeetingId,
          user_id: userId,
          notes,
          is_shared: isShared,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get meeting notes for a kickoff
  async getMeetingNotes(kickoffMeetingId: string, userId: string) {
    const { data, error } = await supabase
      .from('meeting_notes')
      .select('*')
      .eq('kickoff_meeting_id', kickoffMeetingId)
      .or(`user_id.eq.${userId},is_shared.eq.true`);

    if (error) throw error;
    return data || [];
  },

  // Request time slot proposals from team members
  async requestTimeSlots(pursuitId: string, creatorId: string) {
    // Get all accepted team members
    const { data: members, error } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('pursuit_id', pursuitId)
      .eq('status', 'accepted');

    if (error) throw error;

    // Mark pursuit as requesting time slots
    const { error: updateError } = await supabase
      .from('pursuits')
      .update({ requesting_time_slots: true })
      .eq('id', pursuitId);

    if (updateError) throw updateError;

    return members || [];
  },

  // Generate available time slots for next 7 days
  getAvailableTimeSlots(): Date[] {
    const slots: Date[] = [];
    const now = new Date();

    // Generate time slots for the next 7 days
    for (let day = 1; day <= 7; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);

      // Morning slot (9 AM)
      const morning = new Date(date);
      morning.setHours(9, 0, 0, 0);
      slots.push(morning);

      // Afternoon slot (2 PM)
      const afternoon = new Date(date);
      afternoon.setHours(14, 0, 0, 0);
      slots.push(afternoon);

      // Evening slot (6 PM)
      const evening = new Date(date);
      evening.setHours(18, 0, 0, 0);
      slots.push(evening);
    }

    return slots;
  },

  // Analyze proposals to find most popular time slots
  analyzeBestTimeSlots(proposals: TimeSlotProposal[]): {
    datetime: string;
    count: number;
    location_type: 'video' | 'in_person';
  }[] {
    const slotCounts = new Map<string, { count: number; location_type: 'video' | 'in_person' }>();

    proposals.forEach((proposal) => {
      proposal.proposed_slots.forEach((slot) => {
        const key = slot.datetime;
        const existing = slotCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          slotCounts.set(key, { count: 1, location_type: slot.location_type });
        }
      });
    });

    const results = Array.from(slotCounts.entries()).map(([datetime, { count, location_type }]) => ({
      datetime,
      count,
      location_type,
    }));

    // Sort by count (most popular first)
    results.sort((a, b) => b.count - a.count);

    return results;
  },
};
