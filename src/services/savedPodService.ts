import { supabase } from '../config/supabase';

// Postgres unique_violation — raised when two taps race the same insert.
const UNIQUE_VIOLATION = '23505';
// PostgREST "table not in schema cache" — the saved_pods migration (077)
// hasn't been applied to this environment yet.
const TABLE_MISSING = 'PGRST205';

let warnedTableMissing = false;

function isTableMissing(error: any): boolean {
  if (error?.code !== TABLE_MISSING) return false;
  if (!warnedTableMissing) {
    warnedTableMissing = true;
    // console.log, not console.error — a missing optional table is a known
    // setup state, not a crash, and shouldn't red-box the whole app.
    console.log(
      '[savedPods] table `saved_pods` not found — apply supabase-migrations/077_saved_pods.sql. Saving is disabled until then.'
    );
  }
  return true;
}

/**
 * Thrown by save/unsave when the table is absent. Carries a flag so callers
 * can revert their optimistic UI without logging it as a crash.
 */
export function unavailableError(): Error & { savedPodsUnavailable?: boolean } {
  const err: Error & { savedPodsUnavailable?: boolean } = new Error(
    'Saved pods are unavailable until migration 077_saved_pods.sql is applied.'
  );
  err.savedPodsUnavailable = true;
  return err;
}

export const savedPodService = {
  // Whether a single pod is saved by this user.
  async isSaved(pursuitId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('saved_pods')
      .select('id')
      .eq('pursuit_id', pursuitId)
      .eq('user_id', userId)
      .maybeSingle();

    if (isTableMissing(error)) return false;
    if (error) throw error;
    return !!data;
  },

  // One query for the whole visible list — the feed hydrates every card's
  // bookmark state from this rather than firing a request per card.
  async getSavedPursuitIds(userId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('saved_pods')
      .select('pursuit_id')
      .eq('user_id', userId);

    if (isTableMissing(error)) return new Set();
    if (error) throw error;
    return new Set((data || []).map(row => row.pursuit_id));
  },

  async save(pursuitId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_pods')
      .insert([{ pursuit_id: pursuitId, user_id: userId }]);

    if (isTableMissing(error)) throw unavailableError();
    // Already saved is the desired end state, not a failure.
    if (error && error.code !== UNIQUE_VIOLATION) throw error;
  },

  async unsave(pursuitId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_pods')
      .delete()
      .eq('pursuit_id', pursuitId)
      .eq('user_id', userId);

    if (isTableMissing(error)) throw unavailableError();
    if (error) throw error;
  },

  // Returns the resulting saved state.
  async toggleSave(pursuitId: string, userId: string, currentlySaved: boolean): Promise<boolean> {
    if (currentlySaved) {
      await savedPodService.unsave(pursuitId, userId);
      return false;
    }
    await savedPodService.save(pursuitId, userId);
    return true;
  },

  // Card-shaped rows for Profile -> Pods -> Saved Pods. Selects the same
  // pursuit fields privacyService.getUserPods does, so the existing podCard
  // markup renders these without changes.
  async getSavedPods(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('saved_pods')
      .select(`
        created_at,
        pursuit:pursuits!saved_pods_pursuit_id_fkey (
          id, title, status, default_picture, created_at, current_members_count, creator_id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (isTableMissing(error)) return [];
    if (error) throw error;

    // A pursuit deleted out from under a save leaves a null join row.
    return (data || [])
      .filter((row: any) => row.pursuit)
      .map((row: any) => ({
        ...row.pursuit,
        saved_at: row.created_at,
        isCreator: row.pursuit.creator_id === userId,
      }));
  },
};
