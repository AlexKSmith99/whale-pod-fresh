import { supabase } from '../config/supabase';

/**
 * Returns the possessive pronoun (his/her/their) for a given gender string.
 */
export function possessivePronoun(gender: string | null | undefined): string {
  switch (gender?.toLowerCase()) {
    case 'male':
      return 'his';
    case 'female':
      return 'her';
    default:
      return 'their';
  }
}

/**
 * Returns the subject pronoun (he/she/they) for a given gender string.
 */
export function subjectPronoun(gender: string | null | undefined): string {
  switch (gender?.toLowerCase()) {
    case 'male':
      return 'he';
    case 'female':
      return 'she';
    default:
      return 'they';
  }
}

/**
 * Fetches the possessive pronoun for a user by their profile ID.
 * Falls back to "their" if lookup fails.
 */
export async function fetchPossessivePronoun(userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('gender')
      .eq('id', userId)
      .single();
    return possessivePronoun(data?.gender);
  } catch {
    return 'their';
  }
}
