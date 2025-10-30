import { supabase } from '../config/supabase';

export const pursuitService = {
  // Create a pursuit
  async createPursuit(data: any) {
    const { data: pursuit, error } = await supabase
      .from('pursuits')
      .insert([data])
      .select()
      .single();
    
    if (error) throw error;
    return pursuit;
  },

  // Get all pursuits
  async getPursuits() {
    const { data, error } = await supabase
      .from('pursuits')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Delete a pursuit
  async deletePursuit(id: string) {
    const { error } = await supabase
      .from('pursuits')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};
