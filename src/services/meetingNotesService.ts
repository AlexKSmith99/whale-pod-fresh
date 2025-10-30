import { supabase } from '../config/supabase';

export interface MeetingNote {
  id: string;
  pursuit_id: string;
  title: string;
  meeting_date: string;
  agenda: string | null;
  notes: string | null;
  attendees: string[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Get all meeting notes for a pursuit
export async function getMeetingNotes(pursuitId: string): Promise<MeetingNote[]> {
  try {
    const { data, error } = await supabase
      .from('meeting_notes')
      .select('*')
      .eq('pursuit_id', pursuitId)
      .order('meeting_date', { ascending: false });

    if (error) {
      console.error('Error fetching meeting notes:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getMeetingNotes:', error);
    return [];
  }
}

// Create a new meeting note
export async function createMeetingNote(
  pursuitId: string,
  title: string,
  meetingDate: string,
  agenda?: string,
  notes?: string,
  attendees?: string[]
): Promise<MeetingNote | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('meeting_notes')
      .insert([{
        pursuit_id: pursuitId,
        title,
        meeting_date: meetingDate,
        agenda: agenda || null,
        notes: notes || null,
        attendees: attendees || null,
        created_by: user.id
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating meeting note:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createMeetingNote:', error);
    return null;
  }
}

// Update a meeting note
export async function updateMeetingNote(
  noteId: string,
  updates: {
    title?: string;
    meeting_date?: string;
    agenda?: string;
    notes?: string;
    attendees?: string[];
  }
): Promise<MeetingNote | null> {
  try {
    const { data, error } = await supabase
      .from('meeting_notes')
      .update(updates)
      .eq('id', noteId)
      .select()
      .single();

    if (error) {
      console.error('Error updating meeting note:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateMeetingNote:', error);
    return null;
  }
}

// Delete a meeting note
export async function deleteMeetingNote(noteId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('meeting_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      console.error('Error deleting meeting note:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteMeetingNote:', error);
    return false;
  }
}
