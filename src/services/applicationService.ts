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

    // Send notification to pursuit creator
    try {
      console.log('🔔 Attempting to send application notification for pursuit:', data.pursuit_id);

      // Get pursuit details
      const { data: pursuit, error: pursuitError } = await supabase
        .from('pursuits')
        .select('title, creator_id')
        .eq('id', data.pursuit_id)
        .single();

      if (pursuitError) {
        console.error('❌ Error fetching pursuit:', pursuitError);
        throw pursuitError;
      }

      console.log('✅ Pursuit found:', pursuit);

      // Get applicant profile
      const { data: applicant, error: applicantError } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', data.applicant_id)
        .single();

      if (applicantError) {
        console.error('❌ Error fetching applicant:', applicantError);
        throw applicantError;
      }

      console.log('✅ Applicant found:', applicant);

      if (pursuit && applicant) {
        const applicantName = applicant.name || applicant.email?.split('@')[0] || 'Someone';
        console.log('🔔 Sending notification to creator:', pursuit.creator_id, 'about applicant:', applicantName);

        await notificationService.notifyApplicationReceived(
          pursuit.creator_id,
          data.pursuit_id,
          pursuit.title,
          applicantName,
          data.applicant_id
        );

        console.log('✅ Notification sent successfully!');
      }
    } catch (notifError) {
      console.error('❌ Error sending application notification:', notifError);
      // Don't throw - notification failure shouldn't block application
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
    // Get application details
    const { data: application, error: appError } = await supabase
      .from('pursuit_applications')
      .select('pursuit_id, applicant_id')
      .eq('id', applicationId)
      .single();

    if (appError) throw appError;

    // Update application status
    const { error: updateError } = await supabase
      .from('pursuit_applications')
      .update({ status: 'accepted' })
      .eq('id', applicationId);

    if (updateError) throw updateError;

    // Create or update team member record (upsert to handle duplicates)
    const { error: teamError } = await supabase
      .from('team_members')
      .upsert({
        pursuit_id: application.pursuit_id,
        user_id: application.applicant_id,
        status: 'accepted',
      }, {
        onConflict: 'pursuit_id,user_id'
      });

    if (teamError) throw teamError;

    // Increment current_members_count
    const { error: countError } = await supabase.rpc('increment_pursuit_member_count', {
      pursuit_id: application.pursuit_id
    });

    if (countError) {
      // If RPC doesn't exist, do it manually
      const { data: pursuit } = await supabase
        .from('pursuits')
        .select('current_members_count')
        .eq('id', application.pursuit_id)
        .single();

      if (pursuit) {
        await supabase
          .from('pursuits')
          .update({ current_members_count: (pursuit.current_members_count || 0) + 1 })
          .eq('id', application.pursuit_id);
      }
    }

    // Add new member to all future scheduled meetings for this pod
    try {
      console.log('📅 Checking for future meetings to add new member to...');

      // Get all future scheduled meetings for this pursuit
      const { data: futureMeetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('id, title')
        .eq('pursuit_id', application.pursuit_id)
        .eq('status', 'scheduled')
        .gte('scheduled_time', new Date().toISOString());

      if (meetingsError) {
        console.error('❌ Error fetching future meetings:', meetingsError);
      } else if (futureMeetings && futureMeetings.length > 0) {
        console.log(`📅 Found ${futureMeetings.length} future meetings to add new member to`);

        // Add new member as participant to each meeting
        const participantRecords = futureMeetings.map(meeting => ({
          meeting_id: meeting.id,
          user_id: application.applicant_id,
          status: 'invited',
        }));

        const { error: participantsError } = await supabase
          .from('meeting_participants')
          .upsert(participantRecords, {
            onConflict: 'meeting_id,user_id',
            ignoreDuplicates: true
          });

        if (participantsError) {
          console.error('❌ Error adding new member to meetings:', participantsError);
        } else {
          console.log(`✅ Added new member to ${futureMeetings.length} future meetings`);
        }
      } else {
        console.log('📅 No future meetings found for this pod');
      }
    } catch (meetingError) {
      console.error('❌ Error adding member to future meetings:', meetingError);
      // Don't throw - meeting participant failure shouldn't block acceptance
    }

    // Send notifications
    try {
      console.log('🔔 Fetching pursuit details for acceptance notification...');

      // Get pursuit details
      const { data: pursuit, error: pursuitError } = await supabase
        .from('pursuits')
        .select('title, creator_id, current_members_count, min_team_size')
        .eq('id', application.pursuit_id)
        .single();

      if (pursuitError) {
        console.error('❌ Error fetching pursuit:', pursuitError);
        throw pursuitError;
      }

      console.log('✅ Pursuit found:', pursuit);

      // Get creator profile
      const { data: creator, error: creatorError } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', pursuit.creator_id)
        .single();

      if (creatorError) {
        console.error('❌ Error fetching creator:', creatorError);
        throw creatorError;
      }

      console.log('✅ Creator found:', creator);

      if (pursuit && creator) {
        const creatorName = creator.name || creator.email?.split('@')[0] || 'The creator';
        console.log('🔔 Sending acceptance notification to:', application.applicant_id, 'for pursuit:', pursuit.title);

        await notificationService.notifyApplicationAccepted(
          application.applicant_id,
          application.pursuit_id,
          pursuit.title,
          creatorName
        );

        console.log('✅ Acceptance notification sent successfully');

        // Check if min team size reached and notify creator
        if (pursuit.current_members_count >= pursuit.min_team_size) {
          // Check if this is the first time reaching min size (to avoid duplicate notifications)
          const previousCount = pursuit.current_members_count - 1;
          if (previousCount < pursuit.min_team_size) {
            await notificationService.notifyMinTeamSizeReached(
              pursuit.creator_id,
              application.pursuit_id,
              pursuit.title,
              pursuit.current_members_count,
              pursuit.min_team_size
            );
          }
        }
      }
    } catch (notifError) {
      console.error('Error sending notifications:', notifError);
      // Don't throw - notification failure shouldn't block acceptance
    }
  },

  // Reject application
  async rejectApplication(applicationId: string) {
    // Get application details for notification
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

    // Send notification to applicant
    try {
      console.log('🔔 Fetching pursuit details for rejection notification...');

      // Get pursuit details
      const { data: pursuit, error: pursuitError } = await supabase
        .from('pursuits')
        .select('title, creator_id')
        .eq('id', application.pursuit_id)
        .single();

      if (pursuitError) {
        console.error('❌ Error fetching pursuit:', pursuitError);
        throw pursuitError;
      }

      console.log('✅ Pursuit found:', pursuit);

      // Get creator profile
      const { data: creator, error: creatorError } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', pursuit.creator_id)
        .single();

      if (creatorError) {
        console.error('❌ Error fetching creator:', creatorError);
        throw creatorError;
      }

      console.log('✅ Creator found:', creator);

      if (pursuit && creator) {
        const creatorName = creator.name || creator.email?.split('@')[0] || 'The creator';
        console.log('🔔 Sending rejection notification to:', application.applicant_id, 'for pursuit:', pursuit.title);

        await notificationService.notifyApplicationRejected(
          application.applicant_id,
          application.pursuit_id,
          pursuit.title,
          creatorName
        );

        console.log('✅ Rejection notification sent successfully');
      }
    } catch (notifError) {
      console.error('❌ Error sending rejection notification:', notifError);
      // Don't throw - notification failure shouldn't block rejection
    }
  },
};
