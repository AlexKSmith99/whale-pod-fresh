import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../config/supabase';

type Setter = (value: any) => void;

// Reminds a pod LEADER, every time they open/foreground the app, that a pod of
// theirs has reached its minimum team size but kickoff still hasn't been
// activated (status is still 'awaiting_kickoff'). It re-surfaces the same "team
// ready" nudge as a tappable toast — which routes to the pod detail so they can
// activate kickoff — instead of writing duplicate rows into the notification
// inbox on every open.
export function useKickoffReminder(
  auth: any,
  { setCurrentToast }: { setCurrentToast: Setter }
) {
  const checkTeamReadyPods = async () => {
    if (!auth.user) return;

    try {
      // Pods this user leads that are still awaiting kickoff.
      const { data, error } = await supabase
        .from('pursuits')
        .select('id, title, current_members_count, team_size_min')
        .eq('creator_id', auth.user.id)
        .eq('status', 'awaiting_kickoff');

      if (error || !data) return;

      // team_size_min varies per pod, so filter the min-size check in JS.
      const ready = data.filter(
        (p: any) => (p.current_members_count || 0) >= (p.team_size_min || 2)
      );
      if (ready.length === 0) return;

      const first = ready[0];
      const body =
        ready.length > 1
          ? `${ready.length} of your pods hit their minimum size. tap to lock one in.`
          : `"${first.title}" hit ${first.current_members_count}/${first.team_size_min || 2}. tap to activate kickoff.`;

      setCurrentToast({
        title: 'team ready',
        body,
        type: 'min_team_size_reached',
        id: first.id,
        data: { pursuitId: first.id },
      });
    } catch (e) {
      console.error('Error checking team-ready pods:', e);
    }
  };

  useEffect(() => {
    if (!auth.user) return;

    // Cold start / login.
    checkTeamReadyPods();

    // Every warm foreground (returning to the app without a JS reboot).
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkTeamReadyPods();
    });

    return () => sub.remove();
  }, [auth.user]);
}
