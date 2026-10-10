import { useEffect } from 'react';
import { supabase } from '../config/supabase';

type Setter = (value: any) => void;

export function useOnboardingGate(
  auth: any,
  {
    setOnboardingCompleted,
    setCheckingOnboarding,
    setApplicationStatus,
  }: { setOnboardingCompleted: Setter; setCheckingOnboarding: Setter; setApplicationStatus?: Setter }
) {
  // Check onboarding status when user is authenticated
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!auth.user) {
        setCheckingOnboarding(false);
        setApplicationStatus?.(null);
        return;
      }

      try {
        // Fetch application_status alongside onboarding; fall back gracefully if
        // the column doesn't exist yet (migration 072 not applied).
        let data: any = null;
        let error: any = null;
        ({ data, error } = await supabase
          .from('profiles')
          .select('onboarding_completed, name, application_status')
          .eq('id', auth.user.id)
          .single());
        if (error && error.message?.includes('application_status')) {
          ({ data, error } = await supabase
            .from('profiles')
            .select('onboarding_completed, name')
            .eq('id', auth.user.id)
            .single());
        }
        setApplicationStatus?.(data?.application_status ?? null);

        if (error) {
          // Column may not exist yet - skip onboarding gate
          console.log('Onboarding check skipped (column may not exist yet)');
          setOnboardingCompleted(true);
          return;
        }

        // Auto-complete for existing users who already have a profile
        if (!data?.onboarding_completed && data?.name) {
          await supabase
            .from('profiles')
            .update({ onboarding_completed: true })
            .eq('id', auth.user.id);
          setOnboardingCompleted(true);
        } else {
          setOnboardingCompleted(data?.onboarding_completed ?? true);
        }
      } catch (error) {
        console.log('Onboarding check error, skipping:', error);
        setOnboardingCompleted(true);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, [auth.user]);
}
