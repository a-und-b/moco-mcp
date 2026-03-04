/**
 * MCP tools for User Presences management
 * Provides attendance tracking with daily aggregation and summation
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MocoApiService } from '../services/mocoApi.js';
import { validateDateRange } from '../utils/dateUtils.js';
import { createTimeFormat, sumHours, roundHours } from '../utils/timeUtils.js';
import { createValidationErrorMessage, createEmptyResultMessage } from '../utils/errorHandler.js';
import type { UserPresence, PresenceRangeSummary, DailyPresenceSummary } from '../types/mocoTypes.js';

// Schema for get_user_presences tool
const GetUserPresencesSchema = z.object({
  startDate: z.string().describe('Start date in ISO 8601 format (YYYY-MM-DD)'),
  endDate: z.string().describe('End date in ISO 8601 format (YYYY-MM-DD)')
});

/**
 * Tool: get_user_presences
 * Retrieves user presences within a date range with daily aggregation
 */
export const getUserPresencesTool = {
  name: 'get_user_presences',
  description: 'Get user presences within a date range with daily aggregation and total calculations',
  inputSchema: zodToJsonSchema(GetUserPresencesSchema),
  handler: async (params: z.infer<typeof GetUserPresencesSchema>): Promise<string> => {
    const { startDate, endDate } = params;

    // Validate date format and range
    if (!validateDateRange(startDate, endDate)) {
      return createValidationErrorMessage({
        field: 'dateRange',
        value: `${startDate} to ${endDate}`,
        reason: 'invalid_date_range'
      });
    }

    try {
      const apiService = new MocoApiService();
      const presences = await apiService.getUserPresences(startDate, endDate);

      if (presences.length === 0) {
        return createEmptyResultMessage({
          type: 'presences',
          startDate,
          endDate
        });
      }

      const summary = aggregatePresences(presences, startDate, endDate);
      return formatPresencesSummary(summary);

    } catch (error) {
      return `Error retrieving presences: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

// Schema for create_presence tool
const CreatePresenceSchema = z.object({
  date: z.string().describe('Date in ISO 8601 format (YYYY-MM-DD)'),
  from: z.string().describe('Start time in HH:MM format (e.g., "08:30")'),
  to: z.string().optional().describe('End time in HH:MM format (e.g., "17:00"). Omit for open/running presence.')
});

/**
 * Tool: create_presence
 * Creates a new user presence (work time entry)
 */
export const createPresenceTool = {
  name: 'create_presence',
  description: 'Create a new user presence (work time entry) with date, start time, and optional end time',
  inputSchema: zodToJsonSchema(CreatePresenceSchema),
  handler: async (params: z.infer<typeof CreatePresenceSchema>): Promise<string> => {
    const { date, from, to } = params;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return createValidationErrorMessage({
        field: 'date',
        value: date,
        reason: 'invalid_format'
      });
    }

    // Validate time format
    if (!/^\d{2}:\d{2}$/.test(from)) {
      return createValidationErrorMessage({
        field: 'from',
        value: from,
        reason: 'invalid_time_format'
      });
    }

    if (to && !/^\d{2}:\d{2}$/.test(to)) {
      return createValidationErrorMessage({
        field: 'to',
        value: to,
        reason: 'invalid_time_format'
      });
    }

    try {
      const apiService = new MocoApiService();
      const presence = await apiService.createPresence({ date, from, to });
      
      const hours = presence.to ? calculateHoursFromTimes(presence.from, presence.to) : null;
      const hoursInfo = hours ? ` (${roundHours(hours)}h)` : ' (running)';
      
      return `✅ Presence created successfully:
- ID: ${presence.id}
- Date: ${presence.date}
- From: ${presence.from}
- To: ${presence.to || 'open'}${hoursInfo}`;

    } catch (error) {
      return `Error creating presence: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

// Schema for update_presence tool
const UpdatePresenceSchema = z.object({
  presenceId: z.number().describe('ID of the presence to update'),
  date: z.string().optional().describe('New date in ISO 8601 format (YYYY-MM-DD)'),
  from: z.string().optional().describe('New start time in HH:MM format'),
  to: z.string().optional().describe('New end time in HH:MM format')
});

/**
 * Tool: update_presence
 * Updates an existing user presence
 */
export const updatePresenceTool = {
  name: 'update_presence',
  description: 'Update an existing user presence. Only provide the fields you want to change.',
  inputSchema: zodToJsonSchema(UpdatePresenceSchema),
  handler: async (params: z.infer<typeof UpdatePresenceSchema>): Promise<string> => {
    const { presenceId, date, from, to } = params;

    // Build update object with only provided fields
    const updateData: { date?: string; from?: string; to?: string } = {};
    if (date) updateData.date = date;
    if (from) updateData.from = from;
    if (to) updateData.to = to;

    if (Object.keys(updateData).length === 0) {
      return 'No fields to update provided.';
    }

    try {
      const apiService = new MocoApiService();
      const presence = await apiService.updatePresence(presenceId, updateData);
      
      const hours = presence.to ? calculateHoursFromTimes(presence.from, presence.to) : null;
      const hoursInfo = hours ? ` (${roundHours(hours)}h)` : ' (running)';
      
      return `✅ Presence updated successfully:
- ID: ${presence.id}
- Date: ${presence.date}
- From: ${presence.from}
- To: ${presence.to || 'open'}${hoursInfo}`;

    } catch (error) {
      return `Error updating presence: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

// Schema for delete_presence tool
const DeletePresenceSchema = z.object({
  presenceId: z.number().describe('ID of the presence to delete')
});

/**
 * Tool: delete_presence
 * Deletes a user presence
 */
export const deletePresenceTool = {
  name: 'delete_presence',
  description: 'Delete a user presence by ID',
  inputSchema: zodToJsonSchema(DeletePresenceSchema),
  handler: async (params: z.infer<typeof DeletePresenceSchema>): Promise<string> => {
    const { presenceId } = params;

    try {
      const apiService = new MocoApiService();
      await apiService.deletePresence(presenceId);
      
      return `✅ Presence ${presenceId} deleted successfully.`;

    } catch (error) {
      return `Error deleting presence: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

// Schema for touch_presence tool (no parameters needed)
const TouchPresenceSchema = z.object({});

/**
 * Tool: touch_presence
 * Clock in/out - starts or stops a presence
 */
export const touchPresenceTool = {
  name: 'touch_presence',
  description: 'Clock in/out: Creates a new presence starting now, or closes an open presence at current time. Useful for real-time time tracking.',
  inputSchema: zodToJsonSchema(TouchPresenceSchema),
  handler: async (): Promise<string> => {
    try {
      const apiService = new MocoApiService();
      const presence = await apiService.touchPresence();
      
      const action = presence.to ? 'clocked out' : 'clocked in';
      const hours = presence.to ? calculateHoursFromTimes(presence.from, presence.to) : null;
      const hoursInfo = hours ? ` (Total: ${roundHours(hours)}h)` : '';
      
      return `✅ Successfully ${action}:
- ID: ${presence.id}
- Date: ${presence.date}
- From: ${presence.from}
- To: ${presence.to || 'running'}${hoursInfo}`;

    } catch (error) {
      return `Error with touch presence: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Aggregates presence data by date with comprehensive summation
 */
function aggregatePresences(presences: UserPresence[], startDate: string, endDate: string): PresenceRangeSummary {
  // Group presences by date and calculate daily totals
  const presencesByDate = new Map<string, UserPresence[]>();
  
  presences.forEach(presence => {
    if (!presencesByDate.has(presence.date)) {
      presencesByDate.set(presence.date, []);
    }
    presencesByDate.get(presence.date)!.push(presence);
  });

  // Create daily summaries
  const dailySummaries: DailyPresenceSummary[] = [];
  
  // Sort dates for consistent output
  const sortedDates = Array.from(presencesByDate.keys()).sort();
  
  sortedDates.forEach(date => {
    const dayPresences = presencesByDate.get(date)!;
    const dailySummary = createDailyPresenceSummary(date, dayPresences);
    dailySummaries.push(dailySummary);
  });

  // Calculate grand total
  const grandTotalHours = sumHours(dailySummaries.map(day => day.totalHours));

  return {
    startDate,
    endDate,
    dailySummaries,
    grandTotal: createTimeFormat(grandTotalHours)
  };
}

/**
 * Creates a daily presence summary from presence records for a single date
 */
function createDailyPresenceSummary(date: string, presences: UserPresence[]): DailyPresenceSummary {
  // Calculate total hours for the day
  // Only count presences that have both 'from' and 'to' times (completed presences)
  const completedPresences = presences.filter(presence => presence.from && presence.to);
  
  const totalHours = completedPresences.reduce((total, presence) => {
    const hours = calculateHoursFromTimes(presence.from!, presence.to!);
    return total + hours;
  }, 0);

  return {
    date,
    totalHours: roundHours(totalHours),
    totalHoursFormatted: createTimeFormat(totalHours).hoursFormatted
  };
}

/**
 * Calculate hours between two time strings (HH:MM format)
 */
function calculateHoursFromTimes(fromTime: string, toTime: string): number {
  try {
    const [fromHours, fromMinutes] = fromTime.split(':').map(Number);
    const [toHours, toMinutes] = toTime.split(':').map(Number);
    
    const fromTotalMinutes = fromHours * 60 + fromMinutes;
    const toTotalMinutes = toHours * 60 + toMinutes;
    
    // Handle case where 'to' time is next day (crosses midnight)
    const diffMinutes = toTotalMinutes >= fromTotalMinutes 
      ? toTotalMinutes - fromTotalMinutes
      : (24 * 60) - fromTotalMinutes + toTotalMinutes;
    
    return diffMinutes / 60; // Convert minutes to hours
    
  } catch (error) {
    console.error(`Error calculating hours from ${fromTime} to ${toTime}:`, error);
    return 0;
  }
}

/**
 * Formats the presence summary into a readable string
 */
function formatPresencesSummary(summary: PresenceRangeSummary): string {
  const lines: string[] = [];
  
  lines.push(`Presences from ${summary.startDate} to ${summary.endDate}:`);
  lines.push('');

  // Daily summaries
  if (summary.dailySummaries.length > 0) {
    lines.push('Daily presences:');
    summary.dailySummaries.forEach(day => {
      lines.push(`- ${day.date}: ${day.totalHours}h (${day.totalHoursFormatted})`);
    });
    lines.push('');
  }

  // Grand total
  lines.push(`Grand total: ${summary.grandTotal.hours}h (${summary.grandTotal.hoursFormatted})`);

  // Additional statistics
  if (summary.dailySummaries.length > 0) {
    const workingDays = summary.dailySummaries.length;
    const averageHoursPerDay = roundHours(summary.grandTotal.hours / workingDays);
    
    lines.push('');
    lines.push('Statistics:');
    lines.push(`- Working days: ${workingDays}`);
    lines.push(`- Average per day: ${averageHoursPerDay}h (${createTimeFormat(averageHoursPerDay).hoursFormatted})`);
  }

  return lines.join('\\n');
}