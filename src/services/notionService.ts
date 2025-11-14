import { Client } from '@notionhq/client';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

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
  assignedTo?: string;
  description?: string;
}

class NotionService {
  /**
   * Create a new Notion database for a pod/pursuit
   */
  async createPodDatabase(podTitle: string, podId: string): Promise<NotionDatabase> {
    try {
      // Note: To create a database, we need a parent page
      // For now, we'll create it in the integration's workspace
      // You'll need to share a parent page with the integration first

      // This is a placeholder - you'll need to provide a parent page ID
      const parentPageId = process.env.NOTION_PARENT_PAGE_ID || '';

      if (!parentPageId) {
        throw new Error('NOTION_PARENT_PAGE_ID not set in .env file');
      }

      const response = await notion.databases.create({
        parent: {
          type: 'page_id',
          page_id: parentPageId,
        },
        title: [
          {
            type: 'text',
            text: {
              content: `${podTitle} - Team Board`,
            },
          },
        ],
        properties: {
          Name: {
            title: {},
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

      return {
        id: response.id,
        url: response.url,
        title: podTitle,
      };
    } catch (error) {
      console.error('Error creating Notion database:', error);
      throw error;
    }
  }

  /**
   * Get database by ID
   */
  async getDatabase(databaseId: string) {
    try {
      const response = await notion.databases.retrieve({
        database_id: databaseId,
      });
      return response;
    } catch (error) {
      console.error('Error retrieving database:', error);
      throw error;
    }
  }

  /**
   * Query all pages/tasks in a database
   */
  async getTasks(databaseId: string): Promise<NotionPage[]> {
    try {
      const response = await notion.databases.query({
        database_id: databaseId,
      });

      return response.results.map((page: any) => {
        const properties = page.properties;

        return {
          id: page.id,
          url: page.url,
          title: properties.Name?.title?.[0]?.text?.content || 'Untitled',
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
   * Create a new task/page in a database
   */
  async createTask(
    databaseId: string,
    title: string,
    options?: {
      status?: 'To Do' | 'In Progress' | 'Done';
      priority?: 'Low' | 'Medium' | 'High';
      assignedTo?: string;
      description?: string;
    }
  ) {
    try {
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
   * Update a task/page
   */
  async updateTask(
    pageId: string,
    updates: {
      title?: string;
      status?: 'To Do' | 'In Progress' | 'Done';
      priority?: 'Low' | 'Medium' | 'High';
      assignedTo?: string;
      description?: string;
    }
  ) {
    try {
      const properties: any = {};

      if (updates.title) {
        properties.Name = {
          title: [{ text: { content: updates.title } }],
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
   * Delete a task/page (archive it)
   */
  async deleteTask(pageId: string) {
    try {
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
   * Get the embed URL for a database (to display in iframe)
   */
  getDatabaseEmbedUrl(databaseId: string): string {
    return `https://www.notion.so/${databaseId.replace(/-/g, '')}`;
  }
}

export const notionService = new NotionService();
