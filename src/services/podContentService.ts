import { supabase } from '../config/supabase';

// =============================================================================
// TYPES
// =============================================================================

export interface MeetingPage {
  id: string;
  pod_id: string;
  meeting_date: string;
  title: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  agenda_items?: AgendaItem[];
  materials?: Material[];
  notes?: MeetingNotes;
  recap_items?: RecapItem[];
}

export interface AgendaItem {
  id: string;
  meeting_page_id: string;
  sort_order: number;
  title: string;
  description_rich: string | null;
  owner_label: string | null;
  role_label: string | null;
}

export interface Material {
  id: string;
  meeting_page_id: string;
  sort_order: number;
  title: string;
  url: string | null;
}

export interface MeetingNotes {
  meeting_page_id: string;
  notes_rich: string | null;
  font_family: string;
  font_size: string;
}

export interface RecapItem {
  id: string;
  meeting_page_id: string;
  category: 'accomplished' | 'metrics';
  sort_order: number;
  title: string;
  detail: string | null;
}

export interface PodDoc {
  pod_id: string;
  mission_rich: string | null;
  northstar_rich: string | null;
  reference_rich: string | null;
  font_family: string;
  font_size: string;
}

export interface PodRules {
  pod_id: string;
  rules_rich: string | null;
  font_family: string;
  font_size: string;
}

// =============================================================================
// MEETING PAGES SERVICE
// =============================================================================

export const meetingPageService = {
  // Get all meeting pages for a pod (list view)
  async getMeetingPages(podId: string): Promise<MeetingPage[]> {
    try {
      const { data, error } = await supabase
        .from('pod_meeting_pages')
        .select(`
          *,
          agenda_items:pod_meeting_agenda_items(id, title, sort_order),
          recap_items:pod_meeting_recap_items(id, title, category, sort_order)
        `)
        .eq('pod_id', podId)
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching meeting pages:', error);
      return [];
    }
  },

  // Get single meeting page with all details
  async getMeetingPage(pageId: string): Promise<MeetingPage | null> {
    try {
      const { data, error } = await supabase
        .from('pod_meeting_pages')
        .select(`
          *,
          agenda_items:pod_meeting_agenda_items(*),
          materials:pod_meeting_materials(*),
          notes:pod_meeting_notes(*),
          recap_items:pod_meeting_recap_items(*)
        `)
        .eq('id', pageId)
        .single();

      if (error) throw error;
      
      // Sort items by sort_order
      if (data?.agenda_items) {
        data.agenda_items.sort((a: any, b: any) => a.sort_order - b.sort_order);
      }
      if (data?.materials) {
        data.materials.sort((a: any, b: any) => a.sort_order - b.sort_order);
      }
      if (data?.recap_items) {
        data.recap_items.sort((a: any, b: any) => a.sort_order - b.sort_order);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching meeting page:', error);
      return null;
    }
  },

  // Create new meeting page
  async createMeetingPage(podId: string, meetingDate: string, title?: string): Promise<MeetingPage | null> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('pod_meeting_pages')
        .insert({
          pod_id: podId,
          meeting_date: meetingDate,
          title: title || null,
          created_by: userData?.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Create empty notes record
      await supabase
        .from('pod_meeting_notes')
        .insert({ meeting_page_id: data.id });
      
      return data;
    } catch (error) {
      console.error('Error creating meeting page:', error);
      return null;
    }
  },

  // Delete meeting page
  async deleteMeetingPage(pageId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pod_meeting_pages')
        .delete()
        .eq('id', pageId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting meeting page:', error);
      return false;
    }
  },

  // Update meeting page title
  async updateMeetingPageTitle(pageId: string, title: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pod_meeting_pages')
        .update({ title })
        .eq('id', pageId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating meeting page:', error);
      return false;
    }
  },
};

// =============================================================================
// AGENDA ITEMS SERVICE
// =============================================================================

export const agendaService = {
  async addItem(meetingPageId: string, title: string, description?: string, owner?: string, role?: string): Promise<AgendaItem | null> {
    try {
      // Get max sort order
      const { data: existing } = await supabase
        .from('pod_meeting_agenda_items')
        .select('sort_order')
        .eq('meeting_page_id', meetingPageId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

      const { data, error } = await supabase
        .from('pod_meeting_agenda_items')
        .insert({
          meeting_page_id: meetingPageId,
          title,
          description_rich: description || null,
          owner_label: owner || null,
          role_label: role || null,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding agenda item:', error);
      return null;
    }
  },

  async updateItem(itemId: string, updates: Partial<AgendaItem>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pod_meeting_agenda_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating agenda item:', error);
      return false;
    }
  },

  async deleteItem(itemId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pod_meeting_agenda_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting agenda item:', error);
      return false;
    }
  },

  async reorderItems(meetingPageId: string, itemIds: string[]): Promise<boolean> {
    try {
      const updates = itemIds.map((id, index) => ({
        id,
        sort_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('pod_meeting_agenda_items')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      return true;
    } catch (error) {
      console.error('Error reordering agenda items:', error);
      return false;
    }
  },
};

// =============================================================================
// MATERIALS SERVICE
// =============================================================================

export const materialsService = {
  async addMaterial(meetingPageId: string, title: string, url?: string): Promise<Material | null> {
    try {
      const { data: existing } = await supabase
        .from('pod_meeting_materials')
        .select('sort_order')
        .eq('meeting_page_id', meetingPageId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

      const { data, error } = await supabase
        .from('pod_meeting_materials')
        .insert({
          meeting_page_id: meetingPageId,
          title,
          url: url || null,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding material:', error);
      return null;
    }
  },

  async deleteMaterial(materialId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pod_meeting_materials')
        .delete()
        .eq('id', materialId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting material:', error);
      return false;
    }
  },
};

// =============================================================================
// MEETING NOTES SERVICE
// =============================================================================

export const meetingNotesRichService = {
  async saveNotes(meetingPageId: string, notesRich: string, fontFamily?: string, fontSize?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pod_meeting_notes')
        .upsert({
          meeting_page_id: meetingPageId,
          notes_rich: notesRich,
          font_family: fontFamily || 'System',
          font_size: fontSize || 'normal',
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving meeting notes:', error);
      return false;
    }
  },
};

// =============================================================================
// RECAP ITEMS SERVICE
// =============================================================================

export const recapService = {
  async addItem(meetingPageId: string, category: 'accomplished' | 'metrics', title: string, detail?: string): Promise<RecapItem | null> {
    try {
      const { data: existing } = await supabase
        .from('pod_meeting_recap_items')
        .select('sort_order')
        .eq('meeting_page_id', meetingPageId)
        .eq('category', category)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

      const { data, error } = await supabase
        .from('pod_meeting_recap_items')
        .insert({
          meeting_page_id: meetingPageId,
          category,
          title,
          detail: detail || null,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding recap item:', error);
      return null;
    }
  },

  async updateItem(itemId: string, updates: Partial<RecapItem>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pod_meeting_recap_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating recap item:', error);
      return false;
    }
  },

  async deleteItem(itemId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pod_meeting_recap_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting recap item:', error);
      return false;
    }
  },
};

// =============================================================================
// POD DOC SERVICE
// =============================================================================

export const podDocService = {
  async getDoc(podId: string): Promise<PodDoc | null> {
    try {
      const { data, error } = await supabase
        .from('pod_docs')
        .select('*')
        .eq('pod_id', podId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error fetching pod doc:', error);
      return null;
    }
  },

  async saveDoc(podId: string, updates: Partial<PodDoc>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pod_docs')
        .upsert({
          pod_id: podId,
          ...updates,
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving pod doc:', error);
      return false;
    }
  },
};

// =============================================================================
// POD RULES SERVICE
// =============================================================================

export const podRulesService = {
  async getRules(podId: string): Promise<PodRules | null> {
    try {
      const { data, error } = await supabase
        .from('pod_rules')
        .select('*')
        .eq('pod_id', podId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error fetching pod rules:', error);
      return null;
    }
  },

  async saveRules(podId: string, rulesRich: string, fontFamily?: string, fontSize?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pod_rules')
        .upsert({
          pod_id: podId,
          rules_rich: rulesRich,
          font_family: fontFamily || 'System',
          font_size: fontSize || 'normal',
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving pod rules:', error);
      return false;
    }
  },
};

// Default rules template
export const DEFAULT_RULES_TEMPLATE = `**Pod Guidelines**

1. Be respectful and supportive of all team members
2. Communicate schedule changes as early as possible
3. Come prepared to meetings
4. Keep discussions focused and productive
5. Celebrate wins together
6. Provide constructive feedback

*Feel free to customize these rules for your pod!*`;

