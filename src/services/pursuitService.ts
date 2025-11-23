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

  // Get all pursuits with optional filters
  async getPursuits(filters: any = {}) {
    console.log('🔍 getPursuits called with filters:', JSON.stringify(filters, null, 2));

    let query = supabase
      .from('pursuits')
      .select('*');

    // Apply filters if provided
    if (filters.status && filters.status.length > 0) {
      // Convert display names to database values
      const statusValues = filters.status.map((s: string) => {
        if (s === 'Awaiting Kickoff') return 'awaiting_kickoff';
        if (s === 'Active') return 'active';
        return s.toLowerCase().replace(/\s+/g, '_');
      });
      query = query.in('status', statusValues);
    }

    if (filters.pursuit_type && filters.pursuit_type.length > 0) {
      // Use overlap operator for array column
      query = query.overlaps('pursuit_types', filters.pursuit_type);
    }

    if (filters.category && filters.category.length > 0) {
      // Use overlap operator for array column
      query = query.overlaps('pursuit_categories', filters.category);
    }

    if (filters.subcategory && filters.subcategory.length > 0) {
      query = query.in('subcategory', filters.subcategory);
    }

    if (filters.location && filters.location.length > 0) {
      query = query.in('location', filters.location);
    }

    if (filters.team_size && filters.team_size.length > 0) {
      query = query.in('team_size_max', filters.team_size);
    }

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error} = await query;

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    console.log(`✅ Query returned ${data?.length || 0} pursuits`);
    if (data && data.length > 0) {
      console.log('First pursuit sample:', {
        title: data[0].title,
        pursuit_types: data[0].pursuit_types,
        pursuit_categories: data[0].pursuit_categories,
      });
    }

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
