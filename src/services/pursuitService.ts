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
      .select(`
        *,
        team_members!team_members_pursuit_id_fkey (
          user_id,
          status,
          user:profiles!team_members_user_id_fkey (
            id,
            name,
            profile_picture
          )
        )
      `);

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
      // Use PostgreSQL overlap operator (&&) for arrays
      // Convert JS array to PostgreSQL array literal format: {value1,value2}
      const pgArray = `{${filters.pursuit_type.join(',')}}`;
      query = query.filter('pursuit_types', 'ov', pgArray);
    }

    if (filters.category && filters.category.length > 0) {
      // Filter by BOTH pursuit_categories array AND subcategory column
      // Convert JS array to PostgreSQL array literal format: {value1,value2}
      const pgArray = `{${filters.category.join(',')}}`;

      // Use OR to check both pursuit_categories (array) and subcategory (single value)
      query = query.or(`pursuit_categories.ov.${pgArray},subcategory.in.(${filters.category.join(',')})`);
    }

    if (filters.locationSearch && filters.locationSearch.length > 0) {
      // Multiple locations with OR logic (case-insensitive search)
      const locationConditions = filters.locationSearch
        .map((loc: string) => `location.ilike.%${loc}%`)
        .join(',');
      query = query.or(locationConditions);
    }

    if (filters.team_size && filters.team_size.length > 0) {
      // Parse team size ranges and build OR conditions
      // Check BOTH current_members_count AND team_size_max
      const rangeConditions = filters.team_size.map((range: string) => {
        if (range === '20+') {
          return 'or(current_members_count.gte.20,team_size_max.gte.20)';
        }
        // Parse ranges like "1-2", "3-5", "6-10", "11-20"
        const [min, max] = range.split('-').map(Number);
        return `or(and(current_members_count.gte.${min},current_members_count.lte.${max}),and(team_size_max.gte.${min},team_size_max.lte.${max}))`;
      }).join(',');

      query = query.or(rangeConditions);
    }

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.keyword) {
      // Search across title, description, and subcategory
      query = query.or(`title.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%,subcategory.ilike.%${filters.keyword}%`);
    }

    // Apply sorting
    if (filters.sortBy) {
      const ascending = filters.sortOrder === 'asc';
      if (filters.sortBy === 'kickoff_date') {
        // Sort by kickoff_date, with nulls at the end
        query = query.order('kickoff_date', { ascending, nullsFirst: false });
      } else if (filters.sortBy === 'created_at') {
        query = query.order('created_at', { ascending });
      }
    } else {
      // Default sort: newest first
      query = query.order('created_at', { ascending: false });
    }

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
