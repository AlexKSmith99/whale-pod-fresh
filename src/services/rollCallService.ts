import { supabase } from '../config/supabase';
import { notificationService } from './notificationService';
import { displayName } from '../utils/displayName';

/**
 * Roll Call — "are you IN or are you OUT" posted into a pod chat.
 *
 * A roll call points at one of two things, and that choice decides where the
 * answers are stored:
 *
 *   • an existing meeting → answers are `meeting_participants.status`
 *     ('accepted' / 'declined'). The calendar, MeetingDetailScreen and the
 *     reminder scheduler already read that column, so answering in chat
 *     updates the person's calendar too. If roll calls kept their own copy
 *     there would be two answers to "is Maya coming on Thursday" and no way
 *     to pick a winner.
 *
 *   • a proposed date not yet on the calendar → answers are
 *     `roll_call_responses`, because there is no meeting for them to live on.
 *     Once enough people are in, `promoteToMeeting` turns it into a real
 *     meeting and the meeting's participants take over from there.
 *
 * Everything below normalises those two paths into one `RollCall` shape, so no
 * component ever has to know which kind it is looking at.
 */

export type RollCallAnswer = 'in' | 'out';
export type RollCallStatus = 'open' | 'closed' | 'promoted';

export interface RollCallResponder {
  userId: string;
  name: string;
  profilePicture: string | null;
  answer: RollCallAnswer;
}

export interface RollCall {
  id: string;
  pursuitId: string;
  createdBy: string;
  createdByName: string;
  status: RollCallStatus;
  note: string | null;
  createdAt: string;

  /** True when this roll call is attached to a meeting already on the calendar. */
  isMeetingBacked: boolean;
  meetingId: string | null;
  meetingTitle: string | null;
  promotedMeetingId: string | null;

  /** The time being asked about, whichever kind it is. */
  time: string | null;

  responders: RollCallResponder[];
  inCount: number;
  outCount: number;
  /** The current user's answer, or null if they haven't said. */
  myAnswer: RollCallAnswer | null;
  /** Pod members who haven't answered yet. */
  pendingCount: number;
}

/** meeting_participants.status → our binary answer. 'maybe'/'invited' aren't answers. */
function answerFromParticipantStatus(status: string | null): RollCallAnswer | null {
  if (status === 'accepted') return 'in';
  if (status === 'declined') return 'out';
  return null;
}

function participantStatusFromAnswer(answer: RollCallAnswer): string {
  return answer === 'in' ? 'accepted' : 'declined';
}

/** Active roster for a pod, used for the "x haven't answered" count. */
async function podMemberIds(pursuitId: string): Promise<string[]> {
  const ids = new Set<string>();

  const { data: pursuit } = await supabase
    .from('pursuits')
    .select('creator_id')
    .eq('id', pursuitId)
    .maybeSingle();
  if (pursuit?.creator_id) ids.add(pursuit.creator_id);

  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('pursuit_id', pursuitId)
    .in('status', ['active', 'accepted']);
  (members || []).forEach((m: any) => m.user_id && ids.add(m.user_id));

  return Array.from(ids);
}

export const rollCallService = {
  /**
   * Post a roll call into a pod chat.
   *
   * Pass EITHER meetingId (for something already on the calendar) OR
   * proposedTime (for a date that isn't) — the DB rejects both or neither.
   */
  async create(opts: {
    pursuitId: string;
    createdBy: string;
    meetingId?: string;
    proposedTime?: string;
    note?: string;
  }): Promise<string | null> {
    const { pursuitId, createdBy, meetingId, proposedTime, note } = opts;

    if (!!meetingId === !!proposedTime) {
      console.warn('rollCallService.create: pass exactly one of meetingId / proposedTime');
      return null;
    }

    const { data: rc, error } = await supabase
      .from('roll_calls')
      .insert({
        pursuit_id: pursuitId,
        created_by: createdBy,
        meeting_id: meetingId ?? null,
        proposed_time: proposedTime ?? null,
        note: note?.trim() || null,
      })
      .select('id')
      .single();

    if (error || !rc) {
      console.error('Error creating roll call:', error?.message);
      return null;
    }

    // Post it into the chat stream. `content` is a plain-text fallback: it's
    // what push previews and any older build without the card will show, so it
    // has to read as a complete sentence on its own.
    const when = proposedTime || (await this.meetingTime(meetingId!));
    const fallback = when
      ? `Roll call — ${new Date(when).toLocaleString([], {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })}. Are you in or out?`
      : 'Roll call — are you in or out?';

    const { error: msgError } = await supabase.from('pod_chat_messages').insert({
      pursuit_id: pursuitId,
      sender_id: createdBy,
      content: fallback,
      kind: 'roll_call',
      roll_call_id: rc.id,
    });

    if (msgError) {
      // The roll call exists but nothing points at it in the chat — better to
      // remove it than leave an orphan nobody can see or answer.
      console.error('Error posting roll call message, rolling back:', msgError.message);
      await supabase.from('roll_calls').delete().eq('id', rc.id);
      return null;
    }

    await this.notifyPod(rc.id, pursuitId, createdBy, fallback);
    return rc.id;
  },

  async meetingTime(meetingId: string): Promise<string | null> {
    const { data } = await supabase
      .from('meetings')
      .select('scheduled_time')
      .eq('id', meetingId)
      .maybeSingle();
    return data?.scheduled_time ?? null;
  },

  /** Push + alerts-tab notification to everyone in the pod except the author. */
  async notifyPod(rollCallId: string, pursuitId: string, authorId: string, body: string) {
    try {
      const [ids, { data: pursuit }, { data: author }] = await Promise.all([
        podMemberIds(pursuitId),
        supabase.from('pursuits').select('title').eq('id', pursuitId).maybeSingle(),
        supabase.from('profiles').select('name').eq('id', authorId).maybeSingle(),
      ]);

      const recipients = ids.filter(id => id !== authorId);
      if (recipients.length === 0) return;

      await notificationService.sendPushNotification(
        recipients,
        `${displayName(author, 'Someone')} called a roll call`,
        body,
        { type: 'roll_call', rollCallId, pursuitId },
        'roll_call',
        pursuitId,
        'pursuit',
        authorId
      );
    } catch (e) {
      // Notifications are secondary — never let them block the roll call.
      console.warn('Roll call notification failed:', e);
    }
  },

  /**
   * Record the current user's answer.
   *
   * Meeting-backed roll calls write meeting_participants, so the answer shows
   * up on their calendar as well. Proposed-date roll calls write
   * roll_call_responses.
   */
  async respond(rollCallId: string, userId: string, answer: RollCallAnswer): Promise<boolean> {
    const { data: rc, error } = await supabase
      .from('roll_calls')
      .select('id, status, meeting_id')
      .eq('id', rollCallId)
      .maybeSingle();

    if (error || !rc) {
      console.error('Error loading roll call to respond:', error?.message);
      return false;
    }
    if (rc.status !== 'open') return false;

    if (rc.meeting_id) {
      const { error: upErr } = await supabase
        .from('meeting_participants')
        .upsert(
          {
            meeting_id: rc.meeting_id,
            user_id: userId,
            status: participantStatusFromAnswer(answer),
          },
          { onConflict: 'meeting_id,user_id' }
        );
      if (upErr) {
        console.error('Error writing meeting RSVP:', upErr.message);
        return false;
      }
      return true;
    }

    const { error: respErr } = await supabase
      .from('roll_call_responses')
      .upsert(
        { roll_call_id: rollCallId, user_id: userId, response: answer, responded_at: new Date().toISOString() },
        { onConflict: 'roll_call_id,user_id' }
      );
    if (respErr) {
      console.error('Error writing roll call response:', respErr.message);
      return false;
    }
    return true;
  },

  /**
   * Load one roll call, normalised. `currentUserId` is only used to fill in
   * `myAnswer` for the UI.
   */
  async get(rollCallId: string, currentUserId: string): Promise<RollCall | null> {
    const { data: rc, error } = await supabase
      .from('roll_calls')
      .select(`
        id, pursuit_id, created_by, status, note, created_at,
        meeting_id, proposed_time, promoted_meeting_id,
        creator:profiles!roll_calls_created_by_fkey(id, name)
      `)
      .eq('id', rollCallId)
      .maybeSingle();

    if (error || !rc) {
      if (error) console.error('Error loading roll call:', error.message);
      return null;
    }

    let meetingTitle: string | null = null;
    let time: string | null = rc.proposed_time ?? null;
    if (rc.meeting_id) {
      const { data: meeting } = await supabase
        .from('meetings')
        .select('title, scheduled_time')
        .eq('id', rc.meeting_id)
        .maybeSingle();
      meetingTitle = meeting?.title ?? null;
      time = meeting?.scheduled_time ?? null;
    }

    // Gather answers from whichever store owns them, then resolve names once.
    let raw: { userId: string; answer: RollCallAnswer }[] = [];

    if (rc.meeting_id) {
      const { data: parts } = await supabase
        .from('meeting_participants')
        .select('user_id, status')
        .eq('meeting_id', rc.meeting_id);
      raw = (parts || [])
        .map((p: any) => ({ userId: p.user_id, answer: answerFromParticipantStatus(p.status) }))
        .filter((r): r is { userId: string; answer: RollCallAnswer } => r.answer !== null);
    } else {
      const { data: resp } = await supabase
        .from('roll_call_responses')
        .select('user_id, response')
        .eq('roll_call_id', rollCallId);
      raw = (resp || []).map((r: any) => ({ userId: r.user_id, answer: r.response as RollCallAnswer }));
    }

    let responders: RollCallResponder[] = [];
    if (raw.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, profile_picture')
        .in('id', raw.map(r => r.userId));
      const byId = new Map((profiles || []).map((p: any) => [p.id, p]));
      responders = raw.map(r => {
        const p = byId.get(r.userId);
        return {
          userId: r.userId,
          name: displayName(p),
          profilePicture: p?.profile_picture ?? null,
          answer: r.answer,
        };
      });
    }

    const roster = await podMemberIds(rc.pursuit_id);
    const answered = new Set(responders.map(r => r.userId));

    return {
      id: rc.id,
      pursuitId: rc.pursuit_id,
      createdBy: rc.created_by,
      createdByName: displayName((rc as any).creator, 'Someone'),
      status: rc.status as RollCallStatus,
      note: rc.note ?? null,
      createdAt: rc.created_at,
      isMeetingBacked: !!rc.meeting_id,
      meetingId: rc.meeting_id ?? null,
      meetingTitle,
      promotedMeetingId: rc.promoted_meeting_id ?? null,
      time,
      responders,
      inCount: responders.filter(r => r.answer === 'in').length,
      outCount: responders.filter(r => r.answer === 'out').length,
      myAnswer: responders.find(r => r.userId === currentUserId)?.answer ?? null,
      pendingCount: roster.filter(id => !answered.has(id)).length,
    };
  },

  /** Batch loader so a chat full of roll calls isn't N round trips per render. */
  async getMany(rollCallIds: string[], currentUserId: string): Promise<Record<string, RollCall>> {
    const unique = Array.from(new Set(rollCallIds.filter(Boolean)));
    const results = await Promise.all(unique.map(id => this.get(id, currentUserId)));
    const map: Record<string, RollCall> = {};
    results.forEach(rc => { if (rc) map[rc.id] = rc; });
    return map;
  },

  /** Stop taking answers. Author or pod creator only (enforced by RLS). */
  async close(rollCallId: string): Promise<boolean> {
    const { error } = await supabase
      .from('roll_calls')
      .update({ status: 'closed' })
      .eq('id', rollCallId);
    if (error) {
      console.error('Error closing roll call:', error.message);
      return false;
    }
    return true;
  },

  /**
   * Turn a proposed-date roll call into a real meeting, inviting everyone who
   * said IN. After this the meeting's own participants are the source of
   * truth, which is why the roll call moves to 'promoted' rather than staying
   * open — two places taking answers is the thing this design avoids.
   */
  async promoteToMeeting(
    rollCallId: string,
    currentUserId: string,
    opts?: { title?: string; durationMinutes?: number; meetingType?: 'in_person' | 'video' | 'hybrid'; location?: string }
  ): Promise<string | null> {
    const rc = await this.get(rollCallId, currentUserId);
    if (!rc) return null;
    if (rc.isMeetingBacked) {
      console.warn('promoteToMeeting: roll call already has a meeting');
      return null;
    }
    if (!rc.time) return null;

    const { data: pursuit } = await supabase
      .from('pursuits')
      .select('title')
      .eq('id', rc.pursuitId)
      .maybeSingle();

    const { data: meeting, error } = await supabase
      .from('meetings')
      .insert({
        pursuit_id: rc.pursuitId,
        creator_id: currentUserId,
        title: opts?.title?.trim() || pursuit?.title || 'Pod meeting',
        description: rc.note,
        meeting_type: opts?.meetingType || 'in_person',
        location: opts?.location ?? null,
        scheduled_time: rc.time,
        duration_minutes: opts?.durationMinutes ?? 60,
      })
      .select('id')
      .single();

    if (error || !meeting) {
      console.error('Error promoting roll call to meeting:', error?.message);
      return null;
    }

    // Everyone who said IN becomes an accepted participant; the organiser too,
    // matching how meetingService builds its participant rows.
    const attendees = new Set(rc.responders.filter(r => r.answer === 'in').map(r => r.userId));
    attendees.add(currentUserId);

    const { error: partErr } = await supabase.from('meeting_participants').insert(
      Array.from(attendees).map(userId => ({
        meeting_id: meeting.id,
        user_id: userId,
        status: 'accepted',
      }))
    );
    if (partErr) console.warn('Promoted meeting created but participants failed:', partErr.message);

    const { error: statusErr } = await supabase
      .from('roll_calls')
      .update({ status: 'promoted', promoted_meeting_id: meeting.id })
      .eq('id', rollCallId);
    if (statusErr) console.warn('Meeting created but roll call not marked promoted:', statusErr.message);

    return meeting.id;
  },

  /**
   * Upcoming meetings for a pod, for the "reference an existing meeting"
   * picker in the create sheet.
   */
  async upcomingMeetings(pursuitId: string): Promise<{ id: string; title: string; scheduledTime: string }[]> {
    const { data, error } = await supabase
      .from('meetings')
      .select('id, title, scheduled_time')
      .eq('pursuit_id', pursuitId)
      .eq('status', 'scheduled')
      .gte('scheduled_time', new Date().toISOString())
      .order('scheduled_time', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Error loading upcoming meetings:', error.message);
      return [];
    }
    return (data || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      scheduledTime: m.scheduled_time,
    }));
  },
};
