/**
 * MCP tools for Users management
 * Provides list and get operations for staff users
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MocoApiService } from '../services/mocoApi.js';
import { createEmptyResultMessage } from '../utils/errorHandler.js';
import type { StaffUser } from '../types/mocoTypes.js';

// Schema for get_users tool
const GetUsersSchema = z.object({
  email: z.string().email().optional().describe('Filter by email address'),
  tags: z.string().optional().describe('Filter by tags (comma-separated, e.g., "Designer, Developer")'),
  includeArchived: z.boolean().optional().describe('Include deactivated users (default: false)')
});

// Schema for get_user tool
const GetUserSchema = z.object({
  userId: z.number().positive().describe('ID of the user to retrieve')
});

/**
 * Formats a staff user into a readable string
 */
function formatUser(user: StaffUser): string {
  const lines: string[] = [];
  lines.push(`User ID: ${user.id}`);
  lines.push(`Name: ${user.firstname} ${user.lastname}`);
  lines.push(`Email: ${user.email}`);
  lines.push(`Active: ${user.active ? 'Yes' : 'No'}`);
  if (user.extern !== undefined) lines.push(`External: ${user.extern ? 'Yes' : 'No'}`);
  if (user.unit) lines.push(`Unit: ${user.unit.name} (ID: ${user.unit.id})`);
  if (user.role) lines.push(`Role: ${user.role.name} (ID: ${user.role.id})`);
  if (user.mobile_phone) lines.push(`Mobile: ${user.mobile_phone}`);
  if (user.work_phone) lines.push(`Work: ${user.work_phone}`);
  if (user.tags && user.tags.length > 0) lines.push(`Tags: ${user.tags.join(', ')}`);
  return lines.join('\n');
}

/**
 * Formats a list of users
 */
function formatUserList(users: StaffUser[]): string {
  const lines: string[] = [];
  lines.push(`Users (${users.length} found):\n`);

  users.forEach(user => {
    lines.push(`ID: ${user.id}`);
    lines.push(`Name: ${user.firstname} ${user.lastname}`);
    lines.push(`Email: ${user.email}`);
    lines.push(`Active: ${user.active ? 'Yes' : 'No'}`);
    if (user.unit) lines.push(`Unit: ${user.unit.name}`);
    if (user.role) lines.push(`Role: ${user.role.name}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Tool: get_users
 * Retrieves all staff users with optional filtering
 */
export const getUsersTool = {
  name: 'get_users',
  description: 'Get all staff users with optional filtering by email, tags, or include archived/deactivated users.',
  inputSchema: zodToJsonSchema(GetUsersSchema),
  handler: async (params: z.infer<typeof GetUsersSchema>): Promise<string> => {
    const { email, tags, includeArchived } = params;

    try {
      const apiService = new MocoApiService();
      const users = await apiService.getUsers({ email, tags, includeArchived });

      if (users.length === 0) {
        return createEmptyResultMessage({ type: 'users' });
      }

      return formatUserList(users);

    } catch (error) {
      return `Error retrieving users: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: get_user
 * Retrieves a single user by ID
 */
export const getUserTool = {
  name: 'get_user',
  description: 'Get a single staff user by ID with full details.',
  inputSchema: zodToJsonSchema(GetUserSchema),
  handler: async (params: z.infer<typeof GetUserSchema>): Promise<string> => {
    const { userId } = params;

    try {
      const apiService = new MocoApiService();
      const user = await apiService.getUser(userId);
      return formatUser(user);

    } catch (error) {
      return `Error retrieving user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};
