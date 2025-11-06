import { supabase } from '../config/supabase';

export const pursuitService = {
  // Create a pursuit
  async createPursuit(data: any) {
    const { data: pursuit, error } = await supabase
      .from('pursuits')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    return pursuit;
  },

  // Update a pursuit
  async updatePursuit(pursuitId: string, data: any) {
    const { data: pursuit, error } = await supabase
      .from('pursuits')
      .update(data)
      .eq('id', pursuitId)
      .select()
      .single();

    if (error) throw error;
    return pursuit;
  },

  // Get all pursuits with optional filtering
  async getPursuits(filters?: any) {
    let query = supabase
      .from('pursuits')
      .select('*');

    // Apply status filter (multiple)
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    // Apply pursuit type filter (multiple)
    if (filters?.pursuit_types && filters.pursuit_types.length > 0) {
      // Use contains operator for array field
      query = query.contains('pursuit_types', filters.pursuit_types);
    }

    // Apply decision system filter (multiple)
    if (filters?.decision_system && filters.decision_system.length > 0) {
      query = query.in('decision_system', filters.decision_system);
    }

    // Apply roles filter (multiple) - check if pursuit has any of the selected roles
    if (filters?.roles && filters.roles.length > 0) {
      query = query.overlaps('roles', filters.roles);
    }

    // Apply location filter (contains text)
    if (filters?.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }

    // Apply search filter if provided
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error} = await query;

    if (error) throw error;
    return data || [];
  },

  // Delete a pursuit
  async deletePursuit(id: string) {
    const { error} = await supabase
      .from('pursuits')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Update pursuit status
  async updatePursuitStatus(pursuitId: string, status: 'awaiting_kickoff' | 'active') {
    const { data, error } = await supabase
      .from('pursuits')
      .update({ status })
      .eq('id', pursuitId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Schedule kickoff meeting
  async scheduleKickoff(pursuitId: string, kickoffData: {
    kickoff_date: string;
    kickoff_location?: string;
    google_calendar_event_id?: string;
  }) {
    const { data, error } = await supabase
      .from('pursuits')
      .update({
        ...kickoffData,
        kickoff_scheduled: true,
        status: 'active', // Transition to active when kickoff is scheduled
      })
      .eq('id', pursuitId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get team members count for a pursuit
  async getAcceptedMembersCount(pursuitId: string) {
    const { count, error } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('pursuit_id', pursuitId)
      .eq('status', 'accepted');

    if (error) throw error;
    return count || 0;
  },

  // Get pursuit by ID
  async getPursuitById(pursuitId: string) {
    const { data, error } = await supabase
      .from('pursuits')
      .select('*')
      .eq('id', pursuitId)
      .single();

    if (error) throw error;
    return data;
  },
};
