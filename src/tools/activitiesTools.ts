/**
 * MCP tools for Activities management
 * Provides time tracking data with automatic aggregation and summation,
 * as well as create, update, delete, and timer operations
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MocoApiService } from '../services/mocoApi.js';
import { validateDateRange, isValidDateFormat } from '../utils/dateUtils.js';
import { createTimeFormat, sumHours } from '../utils/timeUtils.js';
import { createValidationErrorMessage, createEmptyResultMessage } from '../utils/errorHandler.js';
import type {
  Activity,
  ActivityRangeSummary,
  DailyActivitySummary,
  ProjectActivitySummary,
  TaskActivitySummary
} from '../types/mocoTypes.js';

// Schema for get_activities tool parameters
const GetActivitiesSchema = z.object({
  startDate: z.string().describe('Start date in ISO 8601 format (YYYY-MM-DD)'),
  endDate: z.string().describe('End date in ISO 8601 format (YYYY-MM-DD)'),
  projectId: z.number().positive().optional().describe('Optional project ID to filter activities for a specific project'),
  userId: z.number().positive().optional().describe('Optional user ID to filter activities for a specific user (requires visibility)')
});

// Remote service enum for external integrations
const RemoteServiceEnum = z.enum(['trello', 'jira', 'asana', 'basecamp', 'wunderlist', 'toggl', 'mite', 'github', 'youtrack']);

// Schema for create_activity tool parameters
const CreateActivitySchema = z.object({
  date: z.string().describe('Activity date in ISO 8601 format (YYYY-MM-DD)'),
  projectId: z.number().positive().describe('Project ID for the activity'),
  taskId: z.number().positive().describe('Task ID for the activity'),
  seconds: z.number().int().nonnegative().optional().describe('Duration in seconds (e.g., 3600 = 1 hour)'),
  hours: z.number().nonnegative().optional().describe('Duration in hours (e.g., 1.5 = 1:30). Alternative to seconds.'),
  description: z.string().optional().describe('Activity description/details'),
  billable: z.boolean().optional().describe('Whether the activity is billable (defaults to project configuration)'),
  tag: z.string().optional().describe('Tag identifier (e.g., "RMT-123")'),
  remoteService: RemoteServiceEnum.optional().describe('External system type for linking'),
  remoteId: z.string().optional().describe('External ticket identifier'),
  remoteUrl: z.string().url().optional().describe('Link to external ticket'),
  impersonateUserId: z.number().positive().optional().describe('User ID to create activity for (impersonation; requires Staff permissions)')
});

// Schema for update_activity tool parameters
const UpdateActivitySchema = z.object({
  activityId: z.number().positive().describe('ID of the activity to update'),
  date: z.string().optional().describe('New activity date in ISO 8601 format (YYYY-MM-DD)'),
  projectId: z.number().positive().optional().describe('New project ID'),
  taskId: z.number().positive().optional().describe('New task ID'),
  seconds: z.number().int().nonnegative().optional().describe('New duration in seconds'),
  hours: z.number().nonnegative().optional().describe('New duration in hours. Alternative to seconds.'),
  description: z.string().optional().describe('New activity description'),
  billable: z.boolean().optional().describe('New billable status'),
  tag: z.string().optional().describe('New tag identifier'),
  remoteService: RemoteServiceEnum.optional().describe('New external system type'),
  remoteId: z.string().optional().describe('New external ticket identifier'),
  remoteUrl: z.string().url().optional().describe('New link to external ticket'),
  impersonateUserId: z.number().positive().optional().describe('User ID to act as when updating (impersonation; requires Staff permissions)')
});

// Schema for delete_activity tool parameters
const DeleteActivitySchema = z.object({
  activityId: z.number().positive().describe('ID of the activity to delete'),
  impersonateUserId: z.number().positive().optional().describe('User ID to act as when deleting (impersonation; requires Staff permissions)')
});

// Schema for timer tools
const ActivityTimerSchema = z.object({
  activityId: z.number().positive().describe('ID of the activity to start/stop timer for')
});

/**
 * Tool: get_activities
 * Retrieves activities within a date range with comprehensive aggregation
 */
export const getActivitiesTool = {
  name: 'get_activities',
  description: 'Get all activities within a date range with automatic summation by date, project, and task. Optionally filter by project ID or user ID.',
  inputSchema: zodToJsonSchema(GetActivitiesSchema),
  handler: async (params: z.infer<typeof GetActivitiesSchema>): Promise<string> => {
    const { startDate, endDate, projectId, userId } = params;

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
      // Use MOCO_USER_ID from config as default filter if no userId provided
      const effectiveUserId = userId ?? apiService['config'].userId;
      const activities = await apiService.getActivities(startDate, endDate, projectId, effectiveUserId);

      if (activities.length === 0) {
        return createEmptyResultMessage({
          type: 'activities',
          startDate,
          endDate,
          projectId
        });
      }

      const summary = aggregateActivities(activities, startDate, endDate);
      return formatActivitiesSummary(summary, projectId, userId);

    } catch (error) {
      return `Error retrieving activities: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Aggregates activities into a comprehensive summary structure
 * Groups by date -> project -> task with all necessary totals
 */
function aggregateActivities(activities: Activity[], startDate: string, endDate: string): ActivityRangeSummary {
  // Group activities by date
  const activitiesByDate = new Map<string, Activity[]>();
  
  activities.forEach(activity => {
    if (!activitiesByDate.has(activity.date)) {
      activitiesByDate.set(activity.date, []);
    }
    activitiesByDate.get(activity.date)!.push(activity);
  });

  // Create daily summaries
  const dailySummaries: DailyActivitySummary[] = [];
  const projectTotalsMap = new Map<number, {
    projectName: string;
    totalHours: number;
    tasks: Map<number, { taskName: string; totalHours: number }>;
  }>();

  // Sort dates for consistent output
  const sortedDates = Array.from(activitiesByDate.keys()).sort();
  
  sortedDates.forEach(date => {
    const dayActivities = activitiesByDate.get(date)!;
    const dailySummary = createDailySummary(date, dayActivities);
    dailySummaries.push(dailySummary);

    // Accumulate project totals across all days
    dailySummary.projects.forEach(project => {
      if (!projectTotalsMap.has(project.projectId)) {
        projectTotalsMap.set(project.projectId, {
          projectName: project.projectName,
          totalHours: 0,
          tasks: new Map()
        });
      }

      const projectTotal = projectTotalsMap.get(project.projectId)!;
      projectTotal.totalHours += project.projectTotal.hours;

      project.tasks.forEach(task => {
        if (!projectTotal.tasks.has(task.taskId)) {
          projectTotal.tasks.set(task.taskId, {
            taskName: task.taskName,
            totalHours: 0
          });
        }
        projectTotal.tasks.get(task.taskId)!.totalHours += task.hours;
      });
    });
  });

  // Convert project totals map to array format
  const projectTotals = Array.from(projectTotalsMap.entries()).map(([projectId, data]) => ({
    projectId,
    projectName: data.projectName,
    total: createTimeFormat(data.totalHours),
    tasks: Array.from(data.tasks.entries()).map(([taskId, taskData]) => ({
      taskId,
      taskName: taskData.taskName,
      total: createTimeFormat(taskData.totalHours)
    }))
  }));

  // Calculate grand total
  const grandTotalHours = sumHours(dailySummaries.map(day => day.dailyTotal.hours));

  return {
    startDate,
    endDate,
    dailySummaries,
    projectTotals,
    grandTotal: createTimeFormat(grandTotalHours)
  };
}

/**
 * Creates a daily summary from activities for a single date
 */
function createDailySummary(date: string, activities: Activity[]): DailyActivitySummary {
  // Group by project
  const projectsMap = new Map<number, {
    projectName: string;
    tasks: Map<number, { taskName: string; hours: number }>;
  }>();

  activities.forEach(activity => {
    if (!projectsMap.has(activity.project.id)) {
      projectsMap.set(activity.project.id, {
        projectName: activity.project.name,
        tasks: new Map()
      });
    }

    const project = projectsMap.get(activity.project.id)!;
    if (!project.tasks.has(activity.task.id)) {
      project.tasks.set(activity.task.id, {
        taskName: activity.task.name,
        hours: 0
      });
    }

    project.tasks.get(activity.task.id)!.hours += activity.hours;
  });

  // Convert to structured format
  const projects: ProjectActivitySummary[] = Array.from(projectsMap.entries()).map(([projectId, projectData]) => {
    const tasks: TaskActivitySummary[] = Array.from(projectData.tasks.entries()).map(([taskId, taskData]) => ({
      taskId,
      taskName: taskData.taskName,
      hours: taskData.hours,
      hoursFormatted: createTimeFormat(taskData.hours).hoursFormatted
    }));

    const projectTotalHours = sumHours(tasks.map(task => task.hours));

    return {
      projectId,
      projectName: projectData.projectName,
      tasks,
      projectTotal: createTimeFormat(projectTotalHours)
    };
  });

  const dailyTotalHours = sumHours(projects.map(project => project.projectTotal.hours));

  return {
    date,
    projects,
    dailyTotal: createTimeFormat(dailyTotalHours)
  };
}

/**
 * Formats the activities summary into a readable string
 */
function formatActivitiesSummary(summary: ActivityRangeSummary, projectId?: number, userId?: number): string {
  const lines: string[] = [];

  const filters: string[] = [];
  if (projectId) filters.push(`project ID: ${projectId}`);
  if (userId) filters.push(`user ID: ${userId}`);
  const titleSuffix = filters.length > 0 ? ` (filtered by ${filters.join(', ')})` : '';
  lines.push(`Activities from ${summary.startDate} to ${summary.endDate}${titleSuffix}:`);
  lines.push('');

  // Daily summaries
  summary.dailySummaries.forEach(day => {
    lines.push(`${day.date}:`);

    day.projects.forEach(project => {
      lines.push(`  Project ${project.projectId} (${project.projectName}):`);

      project.tasks.forEach(task => {
        lines.push(`    Task ${task.taskId} (${task.taskName}): ${task.hours}h (${task.hoursFormatted})`);
      });

      lines.push(`    Project total: ${project.projectTotal.hours}h (${project.projectTotal.hoursFormatted})`);
    });

    lines.push(`  Daily total: ${day.dailyTotal.hours}h (${day.dailyTotal.hoursFormatted})`);
    lines.push('');
  });

  // Project totals (across all days)
  if (summary.projectTotals.length > 0) {
    lines.push('Project totals (overall):');
    summary.projectTotals.forEach(project => {
      lines.push(`- Project ${project.projectId} (${project.projectName}): ${project.total.hours}h (${project.total.hoursFormatted})`);

      project.tasks.forEach(task => {
        lines.push(`  - Task ${task.taskId} (${task.taskName}): ${task.total.hours}h (${task.total.hoursFormatted})`);
      });
    });
    lines.push('');
  }

  // Grand total
  lines.push(`Grand total: ${summary.grandTotal.hours}h (${summary.grandTotal.hoursFormatted})`);

  return lines.join('\n');
}

/**
 * Formats a single activity into a readable string
 */
function formatActivity(activity: Activity): string {
  const lines: string[] = [];
  lines.push(`Activity ID: ${activity.id}`);
  lines.push(`Date: ${activity.date}`);
  lines.push(`Project: ${activity.project.name} (ID: ${activity.project.id})`);
  lines.push(`Task: ${activity.task.name} (ID: ${activity.task.id})`);
  lines.push(`Duration: ${activity.hours}h (${createTimeFormat(activity.hours).hoursFormatted})`);
  if (activity.description) {
    lines.push(`Description: ${activity.description}`);
  }
  lines.push(`Billable: ${activity.billable ? 'Yes' : 'No'}`);
  lines.push(`Locked: ${activity.locked ? 'Yes' : 'No'}`);
  return lines.join('\n');
}

/**
 * Converts hours to seconds
 */
function hoursToSeconds(hours: number): number {
  return Math.round(hours * 3600);
}

/**
 * Tool: create_activity
 * Creates a new time tracking activity
 */
export const createActivityTool = {
  name: 'create_activity',
  description: 'Create a new time tracking activity (time entry). Requires date, project ID, and task ID. Duration can be specified in seconds or hours.',
  inputSchema: zodToJsonSchema(CreateActivitySchema),
  handler: async (params: z.infer<typeof CreateActivitySchema>): Promise<string> => {
    const { date, projectId, taskId, seconds, hours, description, billable, tag, remoteService, remoteId, remoteUrl, impersonateUserId } = params;

    // Validate date format
    if (!isValidDateFormat(date)) {
      return createValidationErrorMessage({
        field: 'date',
        value: date,
        reason: 'invalid_date_format'
      });
    }

    // Build API parameters
    const apiParams: Record<string, unknown> = {
      date,
      project_id: projectId,
      task_id: taskId
    };

    // Handle duration - prefer seconds, convert hours if provided
    if (seconds !== undefined) {
      apiParams.seconds = seconds;
    } else if (hours !== undefined) {
      apiParams.seconds = hoursToSeconds(hours);
    }

    if (description !== undefined) apiParams.description = description;
    if (billable !== undefined) apiParams.billable = billable;
    if (tag !== undefined) apiParams.tag = tag;
    if (remoteService !== undefined) apiParams.remote_service = remoteService;
    if (remoteId !== undefined) apiParams.remote_id = remoteId;
    if (remoteUrl !== undefined) apiParams.remote_url = remoteUrl;

    try {
      const apiService = new MocoApiService();
      const activity = await apiService.createActivity(apiParams as any, impersonateUserId);

      return `Activity created successfully!\n\n${formatActivity(activity)}`;

    } catch (error) {
      return `Error creating activity: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: update_activity
 * Updates an existing time tracking activity
 */
export const updateActivityTool = {
  name: 'update_activity',
  description: 'Update an existing time tracking activity. Only provide the fields you want to change.',
  inputSchema: zodToJsonSchema(UpdateActivitySchema),
  handler: async (params: z.infer<typeof UpdateActivitySchema>): Promise<string> => {
    const { activityId, date, projectId, taskId, seconds, hours, description, billable, tag, remoteService, remoteId, remoteUrl, impersonateUserId } = params;

    // Validate date format if provided
    if (date !== undefined && !isValidDateFormat(date)) {
      return createValidationErrorMessage({
        field: 'date',
        value: date,
        reason: 'invalid_date_format'
      });
    }

    // Build API parameters (only include provided fields)
    const apiParams: Record<string, unknown> = {};

    if (date !== undefined) apiParams.date = date;
    if (projectId !== undefined) apiParams.project_id = projectId;
    if (taskId !== undefined) apiParams.task_id = taskId;

    // Handle duration - prefer seconds, convert hours if provided
    if (seconds !== undefined) {
      apiParams.seconds = seconds;
    } else if (hours !== undefined) {
      apiParams.seconds = hoursToSeconds(hours);
    }

    if (description !== undefined) apiParams.description = description;
    if (billable !== undefined) apiParams.billable = billable;
    if (tag !== undefined) apiParams.tag = tag;
    if (remoteService !== undefined) apiParams.remote_service = remoteService;
    if (remoteId !== undefined) apiParams.remote_id = remoteId;
    if (remoteUrl !== undefined) apiParams.remote_url = remoteUrl;

    // Check if any fields to update
    if (Object.keys(apiParams).length === 0) {
      return 'No fields provided to update. Please specify at least one field to change.';
    }

    try {
      const apiService = new MocoApiService();
      const activity = await apiService.updateActivity(activityId, apiParams as any, impersonateUserId);

      return `Activity updated successfully!\n\n${formatActivity(activity)}`;

    } catch (error) {
      return `Error updating activity ${activityId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: delete_activity
 * Deletes an existing time tracking activity
 */
export const deleteActivityTool = {
  name: 'delete_activity',
  description: 'Delete a time tracking activity. Only possible if the activity has not been billed or locked.',
  inputSchema: zodToJsonSchema(DeleteActivitySchema),
  handler: async (params: z.infer<typeof DeleteActivitySchema>): Promise<string> => {
    const { activityId, impersonateUserId } = params;

    try {
      const apiService = new MocoApiService();
      await apiService.deleteActivity(activityId, impersonateUserId);

      return `Activity ${activityId} deleted successfully.`;

    } catch (error) {
      return `Error deleting activity ${activityId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: start_activity_timer
 * Starts or resumes a timer on an activity
 */
export const startActivityTimerTool = {
  name: 'start_activity_timer',
  description: 'Start or resume a timer on an activity. Only works for activities on the current day.',
  inputSchema: zodToJsonSchema(ActivityTimerSchema),
  handler: async (params: z.infer<typeof ActivityTimerSchema>): Promise<string> => {
    const { activityId } = params;

    try {
      const apiService = new MocoApiService();
      const activity = await apiService.startActivityTimer(activityId);

      return `Timer started for activity ${activityId}!\n\n${formatActivity(activity)}`;

    } catch (error) {
      return `Error starting timer for activity ${activityId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: stop_activity_timer
 * Stops the timer on an activity
 */
export const stopActivityTimerTool = {
  name: 'stop_activity_timer',
  description: 'Stop the timer on an activity.',
  inputSchema: zodToJsonSchema(ActivityTimerSchema),
  handler: async (params: z.infer<typeof ActivityTimerSchema>): Promise<string> => {
    const { activityId } = params;

    try {
      const apiService = new MocoApiService();
      const activity = await apiService.stopActivityTimer(activityId);

      return `Timer stopped for activity ${activityId}!\n\n${formatActivity(activity)}`;

    } catch (error) {
      return `Error stopping timer for activity ${activityId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};