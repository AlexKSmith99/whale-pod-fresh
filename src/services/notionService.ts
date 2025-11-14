import { Client } from '@notionhq/client';
import { supabase } from '../config/supabase';

/**
 * Get Notion client for a specific user using their OAuth token
 */
async function getNotionClient(userId: string): Promise<Client | null> {
  try {
    const { data, error } = await supabase
      .from('user_notion_connections')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.error('No Notion connection found for user:', error);
      return null;
    }

    return new Client({
      auth: data.access_token,
    });
  } catch (error) {
    console.error('Error getting Notion client:', error);
    return null;
  }
}

interface NotionDatabase {
  id: string;
  url: string;
  title: string;
}

interface NotionPage {
  id: string;
  url: string;
  title: string;
  status: string;
  priority: string;
  pod: string;
  assignedTo?: string;
  description?: string;
}

class NotionService {
  /**
   * Exchange OAuth code for access token and save to database
   */
  async exchangeCodeForToken(code: string, userId: string): Promise<any> {
    try {
      const clientId = process.env.EXPO_PUBLIC_NOTION_CLIENT_ID;
      const clientSecret = process.env.NOTION_CLIENT_SECRET;
      const redirectUri = process.env.EXPO_PUBLIC_NOTION_REDIRECT_URI;

      const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${encoded}`,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to exchange code for token');
      }

      // Save to database
      const { error } = await supabase
        .from('user_notion_connections')
        .upsert({
          user_id: userId,
          access_token: data.access_token,
          workspace_id: data.workspace_id,
          workspace_name: data.workspace_name,
          bot_id: data.bot_id,
        });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  /**
   * Check if user has connected Notion
   */
  async isConnected(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_notion_connections')
        .select('id')
        .eq('user_id', userId)
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user's Notion database ID
   */
  async getUserDatabaseId(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('user_notion_connections')
        .select('database_id')
        .eq('user_id', userId)
        .single();

      if (error || !data) return null;
      return data.database_id;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a Notion database for the user (one database for all their pods)
   */
  async createUserDatabase(userId: string): Promise<NotionDatabase> {
    try {
      const notion = await getNotionClient(userId);
      if (!notion) {
        throw new Error('User not connected to Notion');
      }

      // With OAuth, we need to search for pages we have access to first
      // Then create database as child of an existing page
      // For simplicity, we'll create a standalone page first

      const response = await notion.databases.create({
        parent: {
          type: 'page_id',
          page_id: 'workspace', // Special value for workspace root with OAuth
        },
        title: [
          {
            type: 'text',
            text: {
              content: 'Whale Pod - Team Tasks',
            },
          },
        ],
        properties: {
          Name: {
            title: {},
          },
          Pod: {
            select: {
              options: [],
            },
          },
          Status: {
            select: {
              options: [
                { name: 'To Do', color: 'gray' },
                { name: 'In Progress', color: 'blue' },
                { name: 'Done', color: 'green' },
              ],
            },
          },
          Priority: {
            select: {
              options: [
                { name: 'Low', color: 'green' },
                { name: 'Medium', color: 'yellow' },
                { name: 'High', color: 'red' },
              ],
            },
          },
          'Assigned To': {
            rich_text: {},
          },
          Description: {
            rich_text: {},
          },
        },
      });

      // Save database ID to user's connection
      await supabase
        .from('user_notion_connections')
        .update({ database_id: response.id })
        .eq('user_id', userId);

      return {
        id: response.id,
        url: response.url,
        title: 'Whale Pod - Team Tasks',
      };
    } catch (error) {
      console.error('Error creating user database:', error);
      throw error;
    }
  }

  /**
   * Query all tasks from user's database
   */
  async getTasks(userId: string, podId?: string): Promise<NotionPage[]> {
    try {
      const databaseId = await this.getUserDatabaseId(userId);
      if (!databaseId) {
        throw new Error('No Notion database found for user');
      }

      const notion = await getNotionClient(userId);
      if (!notion) {
        throw new Error('User not connected to Notion');
      }

      const filter: any = {};
      if (podId) {
        filter.property = 'Pod';
        filter.select = { equals: podId };
      }

      const response = await notion.databases.query({
        database_id: databaseId,
        filter: podId ? filter : undefined,
      });

      return response.results.map((page: any) => {
        const properties = page.properties;

        return {
          id: page.id,
          url: page.url,
          title: properties.Name?.title?.[0]?.text?.content || 'Untitled',
          pod: properties.Pod?.select?.name || '',
          status: properties.Status?.select?.name || 'To Do',
          priority: properties.Priority?.select?.name || 'Medium',
          assignedTo: properties['Assigned To']?.rich_text?.[0]?.text?.content || undefined,
          description: properties.Description?.rich_text?.[0]?.text?.content || undefined,
        };
      });
    } catch (error) {
      console.error('Error querying database:', error);
      throw error;
    }
  }

  /**
   * Create a new task in user's database
   */
  async createTask(
    userId: string,
    title: string,
    podName: string,
    options?: {
      status?: 'To Do' | 'In Progress' | 'Done';
      priority?: 'Low' | 'Medium' | 'High';
      assignedTo?: string;
      description?: string;
    }
  ) {
    try {
      const databaseId = await this.getUserDatabaseId(userId);
      if (!databaseId) {
        throw new Error('No Notion database found for user');
      }

      const notion = await getNotionClient(userId);
      if (!notion) {
        throw new Error('User not connected to Notion');
      }

      const response = await notion.pages.create({
        parent: {
          type: 'database_id',
          database_id: databaseId,
        },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: title,
                },
              },
            ],
          },
          Pod: {
            select: {
              name: podName,
            },
          },
          Status: {
            select: {
              name: options?.status || 'To Do',
            },
          },
          Priority: {
            select: {
              name: options?.priority || 'Medium',
            },
          },
          ...(options?.assignedTo && {
            'Assigned To': {
              rich_text: [
                {
                  text: {
                    content: options.assignedTo,
                  },
                },
              ],
            },
          }),
          ...(options?.description && {
            Description: {
              rich_text: [
                {
                  text: {
                    content: options.description,
                  },
                },
              ],
            },
          }),
        },
      });

      return response;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  /**
   * Update a task
   */
  async updateTask(
    userId: string,
    pageId: string,
    updates: {
      title?: string;
      pod?: string;
      status?: 'To Do' | 'In Progress' | 'Done';
      priority?: 'Low' | 'Medium' | 'High';
      assignedTo?: string;
      description?: string;
    }
  ) {
    try {
      const notion = await getNotionClient(userId);
      if (!notion) {
        throw new Error('User not connected to Notion');
      }

      const properties: any = {};

      if (updates.title) {
        properties.Name = {
          title: [{ text: { content: updates.title } }],
        };
      }

      if (updates.pod) {
        properties.Pod = {
          select: { name: updates.pod },
        };
      }

      if (updates.status) {
        properties.Status = {
          select: { name: updates.status },
        };
      }

      if (updates.priority) {
        properties.Priority = {
          select: { name: updates.priority },
        };
      }

      if (updates.assignedTo !== undefined) {
        properties['Assigned To'] = {
          rich_text: updates.assignedTo
            ? [{ text: { content: updates.assignedTo } }]
            : [],
        };
      }

      if (updates.description !== undefined) {
        properties.Description = {
          rich_text: updates.description
            ? [{ text: { content: updates.description } }]
            : [],
        };
      }

      const response = await notion.pages.update({
        page_id: pageId,
        properties,
      });

      return response;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  /**
   * Delete a task (archive it)
   */
  async deleteTask(userId: string, pageId: string) {
    try {
      const notion = await getNotionClient(userId);
      if (!notion) {
        throw new Error('User not connected to Notion');
      }

      const response = await notion.pages.update({
        page_id: pageId,
        archived: true,
      });

      return response;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  /**
   * Disconnect user's Notion account
   */
  async disconnect(userId: string) {
    try {
      const { error } = await supabase
        .from('user_notion_connections')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error disconnecting Notion:', error);
      throw error;
    }
  }

  /**
   * Get the database URL for opening in browser
   */
  async getDatabaseUrl(userId: string): Promise<string | null> {
    try {
      const databaseId = await this.getUserDatabaseId(userId);
      if (!databaseId) return null;

      return `https://www.notion.so/${databaseId.replace(/-/g, '')}`;
    } catch (error) {
      return null;
    }
  }
}

export const notionService = new NotionService();
