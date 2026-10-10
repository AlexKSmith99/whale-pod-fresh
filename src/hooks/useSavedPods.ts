import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { savedPodService } from '../services/savedPodService';
import { hapticService } from '../services/hapticService';

/**
 * Owns the set of pursuit ids the current user has saved, plus an optimistic
 * toggle that reverts if the write fails. Shared by PursuitDetailScreen and
 * FeedScreen so the optimistic logic lives in one place.
 */
export function useSavedPods() {
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Mirrors savedIds. State updaters are not guaranteed to run synchronously,
  // so toggle() reads the pre-tap value from here rather than from inside a
  // setState callback — otherwise it can send a stale flag to the service.
  const savedIdsRef = useRef<Set<string>>(savedIds);
  const applySaved = useCallback((next: Set<string>) => {
    savedIdsRef.current = next;
    setSavedIds(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      applySaved(new Set());
      return;
    }
    setLoading(true);
    try {
      applySaved(await savedPodService.getSavedPursuitIds(user.id));
    } catch (error) {
      console.error('Error loading saved pods:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, applySaved]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isSaved = useCallback((pursuitId: string) => savedIds.has(pursuitId), [savedIds]);

  const toggle = useCallback(
    async (pursuitId: string) => {
      if (!user?.id) return;

      const wasSaved = savedIdsRef.current.has(pursuitId);

      // Optimistic flip.
      const optimistic = new Set(savedIdsRef.current);
      if (wasSaved) optimistic.delete(pursuitId);
      else optimistic.add(pursuitId);
      applySaved(optimistic);

      hapticService.lightTap();

      try {
        await savedPodService.toggleSave(pursuitId, user.id, wasSaved);
      } catch (error: any) {
        // A missing saved_pods table is a known setup state, already reported
        // once by the service — don't red-box it on every tap.
        if (!error?.savedPodsUnavailable) {
          console.error('Error toggling saved pod:', error);
        }
        // Revert just this id, preserving any other changes made meanwhile.
        const reverted = new Set(savedIdsRef.current);
        if (wasSaved) reverted.add(pursuitId);
        else reverted.delete(pursuitId);
        applySaved(reverted);
      }
    },
    [user?.id, applySaved]
  );

  return { savedIds, isSaved, toggle, loading, refresh };
}
