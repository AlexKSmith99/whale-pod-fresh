import { supabase } from '../config/supabase';

export interface Task {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  pursuit_id: string;
  created_at: string;
  updated_at: string;
}

// Get or create board for a pursuit
export async function getOrCreateBoard(pursuitId: string): Promise<Board | null> {
  try {
    // First, try to get existing board
    const { data: existingBoard, error: fetchError } = await supabase
      .from('team_boards')
      .select('*')
      .eq('pursuit_id', pursuitId)
      .single();

    if (existingBoard) {
      return existingBoard;
    }

    // If no board exists, create one
    const { data: newBoard, error: createError } = await supabase
      .from('team_boards')
      .insert([{ pursuit_id: pursuitId }])
      .select()
      .single();

    if (createError) {
      console.error('Error creating board:', createError);
      return null;
    }

    return newBoard;
  } catch (error) {
    console.error('Error in getOrCreateBoard:', error);
    return null;
  }
}

// Get all tasks for a board
export async function getTasks(boardId: string): Promise<Task[]> {
  try {
    const { data, error } = await supabase
      .from('board_tasks')
      .select('*')
      .eq('board_id', boardId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getTasks:', error);
    return [];
  }
}

// Create a new task
export async function createTask(
  boardId: string,
  title: string,
  description?: string,
  assignedTo?: string,
  priority: 'low' | 'medium' | 'high' = 'medium',
  dueDate?: string
): Promise<Task | null> {
  try {
    // Get the max order_index for this board and status
    const { data: existingTasks } = await supabase
      .from('board_tasks')
      .select('order_index')
      .eq('board_id', boardId)
      .eq('status', 'todo')
      .order('order_index', { ascending: false })
      .limit(1);

    const maxOrderIndex = existingTasks && existingTasks.length > 0 
      ? existingTasks[0].order_index 
      : -1;

    const { data, error } = await supabase
      .from('board_tasks')
      .insert([{
        board_id: boardId,
        title,
        description: description || null,
        assigned_to: assignedTo || null,
        status: 'todo',
        priority,
        due_date: dueDate || null,
        order_index: maxOrderIndex + 1
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createTask:', error);
    return null;
  }
}

// Update task (for moving between columns or editing)
export async function updateTask(
  taskId: string,
  updates: {
    title?: string;
    description?: string;
    assigned_to?: string;
    status?: 'todo' | 'in_progress' | 'done';
    priority?: 'low' | 'medium' | 'high';
    due_date?: string;
    order_index?: number;
  }
): Promise<Task | null> {
  try {
    const { data, error } = await supabase
      .from('board_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateTask:', error);
    return null;
  }
}

// Delete task
export async function deleteTask(taskId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('board_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Error deleting task:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteTask:', error);
    return false;
  }
}

// Move task to different column
export async function moveTask(
  taskId: string,
  newStatus: 'todo' | 'in_progress' | 'done'
): Promise<boolean> {
  try {
    const result = await updateTask(taskId, { status: newStatus });
    return result !== null;
  } catch (error) {
    console.error('Error in moveTask:', error);
    return false;
  }
}
