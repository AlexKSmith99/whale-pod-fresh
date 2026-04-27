import { supabase } from '../config/supabase';
import { notificationService } from './notificationService';
import { ROLE_MANAGER_TITLE } from '../constants/podRoles';

// Single source of truth for all role-management logic.
// Mirrors the pattern used by applicationService/connectionService.

export const roleService = {
  // ---- Reads ----

  /** All role rows for a pod (supports multi-role — can return N rows per user). */
  async getPodRoles(pursuitId: string) {
    const { data, error } = await supabase
      .from('member_roles')
      .select('*')
      .eq('pursuit_id', pursuitId);
    if (error) throw error;
    return data || [];
  },

  /** Group the flat role rows into a map: userId -> [roleTitle, roleTitle, …]. */
  buildUserRoleMap(roleRows: any[]): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const r of roleRows) {
      if (!map[r.user_id]) map[r.user_id] = [];
      map[r.user_id].push(r.role_title);
    }
    return map;
  },

  /** Does this user have role-edit permission for this pod? */
  async canEditRoles(pursuitId: string, userId: string): Promise<boolean> {
    try {
      const { data: pursuit } = await supabase
        .from('pursuits')
        .select('creator_id')
        .eq('id', pursuitId)
        .single();
      if (pursuit?.creator_id === userId) return true;

      const { data: mgr } = await supabase
        .from('member_roles')
        .select('id')
        .eq('pursuit_id', pursuitId)
        .eq('user_id', userId)
        .ilike('role_title', ROLE_MANAGER_TITLE)
        .maybeSingle();
      return !!mgr;
    } catch (err) {
      console.warn('canEditRoles check failed:', err);
      return false;
    }
  },

  // ---- Writes ----

  /**
   * Replace a member's roles for a pod with the given set.
   * Inserts new roles and deletes roles that were removed. Idempotent.
   * Server-side RLS will block this unless the caller is a role editor.
   */
  async setMemberRoles(pursuitId: string, memberUserId: string, desiredTitles: string[]) {
    const titlesNormalized = Array.from(new Set(desiredTitles.map(t => t.trim()).filter(Boolean)));

    // Fetch existing rows
    const { data: existing, error: readErr } = await supabase
      .from('member_roles')
      .select('id, role_title')
      .eq('pursuit_id', pursuitId)
      .eq('user_id', memberUserId);
    if (readErr) throw readErr;

    const existingTitles = new Set((existing || []).map(r => r.role_title.toLowerCase()));
    const desiredLower = new Set(titlesNormalized.map(t => t.toLowerCase()));

    const toAdd = titlesNormalized.filter(t => !existingTitles.has(t.toLowerCase()));
    const toRemove = (existing || []).filter(r => !desiredLower.has(r.role_title.toLowerCase()));

    if (toAdd.length > 0) {
      const rows = toAdd.map(t => ({
        pursuit_id: pursuitId,
        user_id: memberUserId,
        role_title: t,
      }));
      const { error: insErr } = await supabase.from('member_roles').insert(rows);
      if (insErr) throw insErr;
    }

    if (toRemove.length > 0) {
      const ids = toRemove.map(r => r.id);
      const { error: delErr } = await supabase
        .from('member_roles')
        .delete()
        .in('id', ids);
      if (delErr) throw delErr;
    }

    return { added: toAdd.length, removed: toRemove.length };
  },

  // ---- Edit-access requests ----

  /** Member asks for role-edit access. Creates a pending request + notifies editors. */
  async requestRoleEditAccess(pursuitId: string, requesterUserId: string) {
    // Upsert so the same user can't spam — unique partial index on (pursuit, requester) WHERE status='pending'
    const { data: existing } = await supabase
      .from('role_edit_requests')
      .select('id, status')
      .eq('pursuit_id', pursuitId)
      .eq('requester_id', requesterUserId)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) return existing;

    const { data: inserted, error: insErr } = await supabase
      .from('role_edit_requests')
      .insert([{ pursuit_id: pursuitId, requester_id: requesterUserId }])
      .select()
      .single();
    if (insErr) throw insErr;

    // Notify editors (creator + all Role Managers)
    const editorIds = await this.getRoleEditorIds(pursuitId);
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', requesterUserId)
      .single();
    const { data: pursuit } = await supabase
      .from('pursuits')
      .select('title')
      .eq('id', pursuitId)
      .single();

    const requesterName = requesterProfile?.name
      || requesterProfile?.email?.split('@')[0]
      || 'A pod member';
    const pursuitTitle = pursuit?.title || 'your pod';

    if (editorIds.length > 0) {
      await notificationService.sendPushNotification(
        editorIds,
        `${requesterName} wants to manage roles in "${pursuitTitle}"`,
        'Review the request in the Team Roles tab.',
        { type: 'role_edit_requested', pursuitId, requestId: inserted.id },
        'role_edit_requested',
        inserted.id,
        'role_edit_request'
      );
    }

    return inserted;
  },

  /** Approve a pending request: set approved + assign the requester the Role Manager role. */
  async approveRoleEditRequest(requestId: string, approverUserId: string) {
    const { data: req, error: fetchErr } = await supabase
      .from('role_edit_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (fetchErr) throw fetchErr;
    if (req.status !== 'pending') return req;

    // Mark approved
    const { error: updErr } = await supabase
      .from('role_edit_requests')
      .update({
        status: 'approved',
        decided_by: approverUserId,
        decided_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    if (updErr) throw updErr;

    // Grant the Role Manager role (upsert-style — ignore if they already had it)
    await supabase
      .from('member_roles')
      .upsert(
        {
          pursuit_id: req.pursuit_id,
          user_id: req.requester_id,
          role_title: ROLE_MANAGER_TITLE,
        },
        { onConflict: 'pursuit_id,user_id,role_title', ignoreDuplicates: true }
      );

    // Notify requester
    const { data: pursuit } = await supabase
      .from('pursuits')
      .select('title')
      .eq('id', req.pursuit_id)
      .single();
    await notificationService.sendPushNotification(
      [req.requester_id],
      `You can now manage roles in "${pursuit?.title || 'your pod'}"`,
      'The Role Manager role has been granted.',
      { type: 'role_edit_approved', pursuitId: req.pursuit_id },
      'role_edit_approved',
      req.pursuit_id,
      'pursuit'
    );

    return { ...req, status: 'approved' };
  },

  async rejectRoleEditRequest(requestId: string, approverUserId: string) {
    const { error } = await supabase
      .from('role_edit_requests')
      .update({
        status: 'rejected',
        decided_by: approverUserId,
        decided_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    if (error) throw error;
  },

  async getPendingRoleEditRequests(pursuitId: string) {
    const { data, error } = await supabase
      .from('role_edit_requests')
      .select('*')
      .eq('pursuit_id', pursuitId)
      .eq('status', 'pending');
    if (error) throw error;
    return data || [];
  },

  /** Return the set of user IDs allowed to edit roles: creator + all Role Managers. */
  async getRoleEditorIds(pursuitId: string): Promise<string[]> {
    const editorIds = new Set<string>();
    try {
      const { data: pursuit } = await supabase
        .from('pursuits')
        .select('creator_id')
        .eq('id', pursuitId)
        .single();
      if (pursuit?.creator_id) editorIds.add(pursuit.creator_id);

      const { data: mgrs } = await supabase
        .from('member_roles')
        .select('user_id')
        .eq('pursuit_id', pursuitId)
        .ilike('role_title', ROLE_MANAGER_TITLE);
      (mgrs || []).forEach(m => editorIds.add(m.user_id));
    } catch (err) {
      console.warn('getRoleEditorIds failed:', err);
    }
    return Array.from(editorIds);
  },
};
