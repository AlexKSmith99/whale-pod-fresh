import { supabase } from '../config/supabase';
import { notificationService } from './notificationService';

export const applicationService = {
  // Submit an application
  async createApplication(data: any) {
    const { data: application, error } = await supabase
      .from('pursuit_applications')
      .insert([data])
      .select()
      .single();

    if (error) throw error;

    // Get pursuit and applicant details for notification
    const { data: pursuit } = await supabase
      .from('pursuits')
      .select('title, creator_id')
      .eq('id', data.pursuit_id)
      .single();

    const { data: applicant } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', data.applicant_id)
      .single();

    // Notify pursuit creator
    if (pursuit && applicant) {
      await notificationService.notifyApplicationReceived(
        data.pursuit_id,
        pursuit.creator_id,
        applicant.name || 'Someone',
        pursuit.title
      ).catch(err => console.error('Failed to send notification:', err));
    }

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
    // First, get the application to know the pursuit and applicant
    const { data: application, error: appError } = await supabase
      .from('pursuit_applications')
      .select('pursuit_id, applicant_id')
      .eq('id', applicationId)
      .single();

    if (appError) throw appError;
    if (!application) throw new Error('Application not found');

    // Update application status
    const { error: updateError } = await supabase
      .from('pursuit_applications')
      .update({ status: 'accepted' })
      .eq('id', applicationId);

    if (updateError) throw updateError;

    // Create team_member record
    const { error: memberError } = await supabase
      .from('team_members')
      .insert([{
        pursuit_id: application.pursuit_id,
        user_id: application.applicant_id,
        status: 'accepted',
        role: 'member',
      }]);

    if (memberError) throw memberError;

    // Get current pursuit to check team size and update count
    const { data: pursuit, error: pursuitError } = await supabase
      .from('pursuits')
      .select('current_members_count, team_size_min, status, title')
      .eq('id', application.pursuit_id)
      .single();

    if (pursuitError) throw pursuitError;

    // Notify applicant that their application was accepted
    await notificationService.notifyApplicationAccepted(
      application.pursuit_id,
      application.applicant_id,
      pursuit.title
    ).catch(err => console.error('Failed to send notification:', err));

    // Increment current_members_count
    const newCount = (pursuit.current_members_count || 0) + 1;

    // Check if minimum team size is reached (including creator)
    // Creator counts as 1, so total members = newCount + 1
    const totalMembers = newCount + 1;
    const shouldBeAwaitingKickoff = totalMembers >= pursuit.team_size_min && pursuit.status !== 'active';

    // Update pursuit
    const updateData: any = {
      current_members_count: newCount,
    };

    if (shouldBeAwaitingKickoff) {
      updateData.status = 'awaiting_kickoff';
    }

    const { error: countError } = await supabase
      .from('pursuits')
      .update(updateData)
      .eq('id', application.pursuit_id);

    if (countError) throw countError;
  },

  // Reject application
  async rejectApplication(applicationId: string) {
    // Get application details
    const { data: application, error: appError } = await supabase
      .from('pursuit_applications')
      .select('pursuit_id, applicant_id')
      .eq('id', applicationId)
      .single();

    if (appError) throw appError;

    const { error } = await supabase
      .from('pursuit_applications')
      .update({ status: 'declined' })
      .eq('id', applicationId);

    if (error) throw error;

    // Get pursuit title for notification
    const { data: pursuit } = await supabase
      .from('pursuits')
      .select('title')
      .eq('id', application.pursuit_id)
      .single();

    // Notify applicant that their application was rejected
    if (pursuit) {
      await notificationService.notifyApplicationRejected(
        application.pursuit_id,
        application.applicant_id,
        pursuit.title
      ).catch(err => console.error('Failed to send notification:', err));
    }
  },
};
