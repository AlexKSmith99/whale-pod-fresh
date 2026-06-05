import { useEffect } from 'react';
import { supabase } from '../config/supabase';

type Setter = (value: any) => void;

export function useInterviewListeners(
  auth: any,
  {
    setCurrentToast,
    setViewingInterviewProposal,
    setViewingInterviewScheduling,
  }: {
    setCurrentToast: Setter;
    setViewingInterviewProposal: Setter;
    setViewingInterviewScheduling: Setter;
  }
) {
  // Fetch data needed for interview proposal screen
  const fetchInterviewProposalData = async (applicationId: string, pursuitId: string) => {
    try {
      const { data, error } = await supabase
        .from('pursuits')
        .select('title')
        .eq('id', pursuitId)
        .single();

      if (error) throw error;

      setViewingInterviewProposal({
        applicationId,
        pursuitId,
        pursuitTitle: data?.title || 'Pursuit',
      });
    } catch (error) {
      console.error('Error fetching interview proposal data:', error);
    }
  };

  // Fetch data needed for interview scheduling screen
  const fetchInterviewSchedulingData = async (applicationId: string, pursuitId: string) => {
    try {
      // Fetch application and pursuit data
      const { data: appData, error: appError } = await supabase
        .from('pursuit_applications')
        .select(`
          applicant_id,
          applicant:profiles!applicant_id(
            name,
            email
          )
        `)
        .eq('id', applicationId)
        .single();

      if (appError) throw appError;

      const { data: pursuitData, error: pursuitError } = await supabase
        .from('pursuits')
        .select('title')
        .eq('id', pursuitId)
        .single();

      if (pursuitError) throw pursuitError;

      const applicantProfile = appData?.applicant as any;
      setViewingInterviewScheduling({
        applicationId,
        pursuitId,
        pursuitTitle: pursuitData?.title || 'Pursuit',
        applicantId: appData?.applicant_id || '',
        applicantName: applicantProfile?.name || applicantProfile?.email || 'Applicant',
      });
    } catch (error) {
      console.error('Error fetching interview scheduling data:', error);
    }
  };

  // Listen for interview scheduling requests (fallback for when notification insert fails)
  useEffect(() => {
    if (auth.user) {
      console.log('🎤 Setting up interview request listener for applicant:', auth.user.id);

      const interviewChannel = supabase
        .channel('interview-requests')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'pursuit_applications',
            filter: `applicant_id=eq.${auth.user.id}`,
          },
          async (payload) => {
            console.log('🎤 APPLICATION UPDATE RECEIVED:', payload);
            const updatedApp = payload.new as any;
            const oldApp = payload.old as any;

            // Check if status changed to interview_pending
            if (updatedApp.status === 'interview_pending' && oldApp.status !== 'interview_pending') {
              console.log('🎤 Interview scheduling requested! Showing toast...');

              // Fetch pursuit title for the toast
              try {
                const { data: pursuitData } = await supabase
                  .from('pursuits')
                  .select('title, creator_id, profiles:creator_id(name, email)')
                  .eq('id', updatedApp.pursuit_id)
                  .single();

                const creatorProfile = pursuitData?.profiles as any;
                const creatorName = creatorProfile?.name || creatorProfile?.email?.split('@')[0] || 'The creator';
                const pursuitTitle = pursuitData?.title || 'a pursuit';

                // Show toast notification
                setCurrentToast({
                  title: `${creatorName} wants to schedule an interview`,
                  body: `Propose your available times for "${pursuitTitle}"`,
                  type: 'interview_scheduling_requested',
                  id: updatedApp.id,
                });
              } catch (error) {
                console.error('Error fetching pursuit info for toast:', error);
                // Show generic toast
                setCurrentToast({
                  title: 'Interview Request',
                  body: 'A creator wants to schedule an interview with you',
                  type: 'interview_scheduling_requested',
                  id: updatedApp.id,
                });
              }
            }
          }
        )
        .subscribe((status, err) => {
          console.log('🎤 Interview requests subscription status:', status);
          if (err) {
            console.error('🎤 Interview requests subscription error:', err);
          }
          if (status === 'SUBSCRIBED') {
            console.log('🎤 Successfully subscribed to interview requests');
          }
        });

      return () => {
        console.log('🎤 Cleaning up interview requests subscription');
        supabase.removeChannel(interviewChannel);
      };
    }
  }, [auth.user]);

  // Listen for interview times submitted (for creators to see when applicants submit availability)
  useEffect(() => {
    if (auth.user) {
      console.log('🎤 Setting up interview times listener for creator:', auth.user.id);

      // We need to listen to all pursuit_applications updates and filter by pursuits we created
      const interviewTimesChannel = supabase
        .channel('interview-times-submitted')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'pursuit_applications',
          },
          async (payload) => {
            const updatedApp = payload.new as any;
            const oldApp = payload.old as any;

            // Check if status changed to interview_times_submitted
            if (updatedApp.status === 'interview_times_submitted' && oldApp.status !== 'interview_times_submitted') {
              console.log('🎤 Interview times submitted detected:', updatedApp);

              try {
                // Check if current user is the creator of this pursuit
                const { data: pursuitData } = await supabase
                  .from('pursuits')
                  .select('title, creator_id')
                  .eq('id', updatedApp.pursuit_id)
                  .single();

                if (pursuitData?.creator_id === auth.user?.id) {
                  console.log('🎤 Current user is creator - showing toast');

                  // Fetch applicant name
                  const { data: applicantData } = await supabase
                    .from('profiles')
                    .select('name, email')
                    .eq('id', updatedApp.applicant_id)
                    .single();

                  const applicantName = applicantData?.name || applicantData?.email?.split('@')[0] || 'An applicant';
                  const pursuitTitle = pursuitData?.title || 'a pursuit';

                  // Show toast notification with data for navigation
                  setCurrentToast({
                    title: `${applicantName} submitted interview times`,
                    body: `Review their availability for "${pursuitTitle}"`,
                    type: 'interview_times_submitted',
                    id: updatedApp.id,
                    data: {
                      applicationId: updatedApp.id,
                      pursuitId: updatedApp.pursuit_id,
                    },
                  });
                }
              } catch (error) {
                console.error('Error processing interview times submitted:', error);
              }
            }
          }
        )
        .subscribe((status, err) => {
          console.log('🎤 Interview times submitted subscription status:', status);
          if (err) {
            console.error('🎤 Interview times submitted subscription error:', err);
          }
          if (status === 'SUBSCRIBED') {
            console.log('🎤 Successfully subscribed to interview times submitted');
          }
        });

      return () => {
        console.log('🎤 Cleaning up interview times submitted subscription');
        supabase.removeChannel(interviewTimesChannel);
      };
    }
  }, [auth.user]);

  return { fetchInterviewProposalData, fetchInterviewSchedulingData };
}
