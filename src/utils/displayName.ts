/**
 * How a person is labelled when their profile has no name on it.
 *
 * The app used to fall back to the local part of their email address
 * (`name || email.split('@')[0]`) at roughly twenty places — chat headers,
 * meeting participant lists, team board activity, push notification bodies.
 * That meant every one of those reads had to pull `email` for other users, and
 * an address leaked into the UI whenever a profile was incomplete.
 *
 * Email is personal data and a poor identity token: `id` is the key everywhere
 * that actually matters. Migration 084 stopped returning it from cross-user
 * profile reads, so these helpers give the fallback somewhere to go.
 */

import { supabase } from '../config/supabase';

/** Shown in place of a missing name. */
export const UNNAMED_USER = 'Member';

type NamedLike = { name?: string | null } | null | undefined;

/**
 * A person's display name, or `UNNAMED_USER`.
 *
 * Pass an override for contexts that read better with something specific —
 * `'the organizer'`, `'A teammate'`, `'Someone'` — which is how most of the
 * notification copy used to read.
 */
export function displayName(profile: NamedLike, fallback: string = UNNAMED_USER): string {
  const name = profile?.name?.trim();
  return name || fallback;
}

/** Single uppercase initial for avatar placeholders; `'?'` when unknown. */
export function initialOf(profile: NamedLike): string {
  const name = profile?.name?.trim();
  return name ? name.charAt(0).toUpperCase() : '?';
}

/**
 * Look up one user's display name by id.
 *
 * For the places that only have a user id in hand — notification bodies, for
 * the most part. Several screens used to write `user?.name || user?.email`
 * against the *auth* user, which has no `name` at all, so they silently always
 * produced the author's email local-part and sent it to the other party.
 *
 * Never throws: a failed lookup returns the fallback.
 */
export async function fetchDisplayName(
  userId: string | null | undefined,
  fallback: string = UNNAMED_USER
): Promise<string> {
  if (!userId) return fallback;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();
    return displayName(data, fallback);
  } catch {
    return fallback;
  }
}
