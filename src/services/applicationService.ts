import { supabase } from '../config/supabase';

export const applicationService = {
  // Submit an application
  async createApplication(data: any) {
    const { data: application, error } = await supabase
      .from('pursuit_applications')
      .insert([data])
      .select()
      .single();
    
    if (error) throw error;
    return application;
  },

  // Get applications for a pursuit
  async getApplicationsForPursuit(pursuitId: string) {
    const { data, error } = await supabase
      .from('pursuit_applications')
      .select('*, applicant:profiles!applicant_id(*)')
      .eq('pursuit_id', pursuitId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Check if user already applied
  async hasUserApplied(pursuitId: string, userId: string) {
    const { data, error } = await supabase
      .from('pursuit_applications')
      .select('id')
      .eq('pursuit_id', pursuitId)
      .eq('applicant_id', userId)
      .single();
    
    return !!data && !error;
  },

  // Accept application
  async acceptApplication(applicationId: string) {
    const { error } = await supabase
      .from('pursuit_applications')
      .update({ status: 'accepted' })
      .eq('id', applicationId);
    
    if (error) throw error;
  },

  // Reject application
  async rejectApplication(applicationId: string) {
    const { error } = await supabase
      .from('pursuit_applications')
      .update({ status: 'declined' })
      .eq('id', applicationId);
    
    if (error) throw error;
  },
};
