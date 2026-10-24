import { supabase } from '../config/supabase';

/**
 * Profile credential badges, computed server-side by get_user_badges
 * (migration 083).
 *
 * The RPC is SECURITY DEFINER because it reads other people's pursuits and
 * memberships, which RLS hides. It returns only counts and booleans — never
 * which pods — so it can't be used to enumerate someone's pod history.
 */

// PostgREST "function not found" — migration 083 not applied yet.
const FN_MISSING = 'PGRST202';
let warnedMissing = false;

export interface UserBadges {
  led_count: number;
  pod_count: number;
  pod_leader: boolean;
  regular: boolean;
}

export const NO_BADGES: UserBadges = {
  led_count: 0,
  pod_count: 0,
  pod_leader: false,
  regular: false,
};

export const badgeService = {
  /** Never throws — a profile should render fine with no badges. */
  async get(userId: string): Promise<UserBadges> {
    if (!userId) return { ...NO_BADGES };

    const { data, error } = await supabase.rpc('get_user_badges', {
      p_user_id: userId,
    });

    if (error) {
      if (error.code === FN_MISSING) {
        if (!warnedMissing) {
          warnedMissing = true;
          // Known setup state, not a crash — don't red-box the app.
          console.log(
            '[badges] get_user_badges not found — apply supabase-migrations/083_user_badges.sql. Profiles show no badges until then.'
          );
        }
      } else {
        console.error('Error loading user badges:', error);
      }
      return { ...NO_BADGES };
    }

    return { ...NO_BADGES, ...(data as any) };
  },
};
