/**
 * MCP tools for Projects management
 * Provides project listing, searching, task retrieval, and project update functionality
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MocoApiService } from '../services/mocoApi.js';
import { createValidationErrorMessage, createEmptyResultMessage } from '../utils/errorHandler.js';
import { isValidDateFormat } from '../utils/dateUtils.js';
import type { Project, Task } from '../types/mocoTypes.js';

// Schema for get_projects tool with optional search query
const GetProjectsSchema = z.object({
  query: z.string().optional().describe('Optional search query to find projects by name or description (case-insensitive)')
});

// Schema for get_project_tasks tool
const GetProjectTasksSchema = z.object({
  projectId: z.number().positive().describe('Project ID to retrieve tasks for')
});

// Billing variant enum
const BillingVariantEnum = z.enum(['project', 'task', 'user']);

// Schema for update_project tool
const UpdateProjectSchema = z.object({
  projectId: z.number().positive().describe('ID of the project to update'),
  name: z.string().optional().describe('Project name'),
  startDate: z.string().optional().describe('Project start date (YYYY-MM-DD)'),
  finishDate: z.string().optional().describe('Project finish date (YYYY-MM-DD)'),
  fixedPrice: z.boolean().optional().describe('Whether project is fixed price'),
  retainer: z.boolean().optional().describe('Whether project is a retainer'),
  leaderId: z.number().positive().optional().describe('User ID of the project leader'),
  coLeaderId: z.number().positive().optional().describe('User ID of the co-leader'),
  customerId: z.number().positive().optional().describe('Customer ID'),
  dealId: z.number().positive().optional().describe('Deal ID'),
  projectGroupId: z.number().positive().optional().describe('Project group ID'),
  contactId: z.number().positive().optional().describe('Contact ID'),
  secondaryContactId: z.number().positive().optional().describe('Secondary contact ID'),
  billingContactId: z.number().positive().optional().describe('Billing contact ID'),
  identifier: z.string().optional().describe('Project identifier/code (e.g., "P-123")'),
  billingAddress: z.string().optional().describe('Billing address'),
  billingEmailTo: z.string().email().optional().describe('Billing email recipient'),
  billingEmailCc: z.string().email().optional().describe('Billing email CC'),
  billingNotes: z.string().optional().describe('Billing notes'),
  settingIncludeTimeReport: z.boolean().optional().describe('Include time report in billing'),
  billingVariant: BillingVariantEnum.optional().describe('Billing variant: project, task, or user'),
  hourlyRate: z.number().nonnegative().optional().describe('Hourly rate'),
  budget: z.number().nonnegative().optional().describe('Project budget'),
  budgetMonthly: z.number().nonnegative().optional().describe('Monthly budget'),
  budgetExpenses: z.number().nonnegative().optional().describe('Expenses budget'),
  tags: z.array(z.string()).optional().describe('Project tags (e.g., ["Print", "Digital"])'),
  customProperties: z.record(z.string()).optional().describe('Custom properties as key-value pairs'),
  info: z.string().optional().describe('Project information text')
});

/**
 * Tool: get_user_projects
 * Retrieves all assigned projects or searches for assigned projects by name/description
 */
export const getUserProjectsTool = {
  name: 'get_user_projects',
  description: 'Get all projects assigned to the current user or search within assigned projects by name/description. If no query is provided, returns all assigned projects.',
  inputSchema: zodToJsonSchema(GetProjectsSchema),
  handler: async (params: z.infer<typeof GetProjectsSchema>): Promise<string> => {
    const { query } = params;

    try {
      const apiService = new MocoApiService();
      
      // If query is provided and not empty, search; otherwise list all
      if (query && query.trim()) {
        const projects = await apiService.searchProjects(query.trim());

        if (projects.length === 0) {
          return createEmptyResultMessage({ 
            type: 'projects',
            query: query.trim()
          });
        }

        return formatProjectsSearchResults(projects, query.trim());
      } else {
        const projects = await apiService.getProjects();

        if (projects.length === 0) {
          return createEmptyResultMessage({ type: 'projects' });
        }

        return formatProjectsList(projects);
      }

    } catch (error) {
      return `Error retrieving projects: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: get_user_project_tasks
 * Retrieves all tasks for a specific assigned project
 */
export const getUserProjectTasksTool = {
  name: 'get_user_project_tasks',
  description: 'Get all tasks for a specific assigned project by project ID. Only works for projects assigned to the current user.',
  inputSchema: zodToJsonSchema(GetProjectTasksSchema),
  handler: async (params: z.infer<typeof GetProjectTasksSchema>): Promise<string> => {
    const { projectId } = params;

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return createValidationErrorMessage({
        field: 'projectId',
        value: projectId,
        reason: 'invalid_project_id'
      });
    }

    try {
      const apiService = new MocoApiService();
      const tasks = await apiService.getProjectTasks(projectId);

      if (tasks.length === 0) {
        return createEmptyResultMessage({ 
          type: 'tasks',
          projectId 
        });
      }

      return formatProjectTasks(tasks, projectId);

    } catch (error) {
      return `Error retrieving tasks for project ${projectId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Formats a list of projects into a readable string
 */
function formatProjectsList(projects: Project[]): string {
  const lines: string[] = [];
  
  lines.push(`Assigned projects (${projects.length}):\n`);

  projects.forEach(project => {
    lines.push(`ID: ${project.id}`);
    lines.push(`Name: ${project.name}`);
    
    if (project.description) {
      lines.push(`Description: ${project.description}`);
    }
    
    lines.push(`Status: ${project.active ? 'Active' : 'Inactive'}`);
    
    if (project.customer) {
      lines.push(`Customer: ${project.customer.name}`);
    }
    
    if (project.leader) {
      lines.push(`Leader: ${project.leader.firstname} ${project.leader.lastname}`);
    }
    
    if (project.budget) {
      lines.push(`Budget: ${project.budget} ${project.currency}`);
    }
    
    lines.push(''); // Empty line between projects
  });

  return lines.join('\\n');
}

/**
 * Formats search results with highlighting of the search term
 */
function formatProjectsSearchResults(projects: Project[], query: string): string {
  const lines: string[] = [];
  
  lines.push(`Search results for "${query}" (${projects.length} found):\n`);

  projects.forEach(project => {
    lines.push(`ID: ${project.id}`);
    lines.push(`Name: ${highlightSearchTerm(project.name, query)}`);
    
    if (project.description) {
      lines.push(`Description: ${highlightSearchTerm(project.description, query)}`);
    }
    
    lines.push(`Status: ${project.active ? 'Active' : 'Inactive'}`);
    
    if (project.customer) {
      lines.push(`Customer: ${project.customer.name}`);
    }
    
    lines.push(''); // Empty line between projects
  });

  return lines.join('\\n');
}

/**
 * Formats project tasks into a readable string
 */
function formatProjectTasks(tasks: Task[], projectId: number): string {
  const lines: string[] = [];
  
  lines.push(`Tasks for project ${projectId} (${tasks.length} found):\n`);

  tasks.forEach(task => {
    lines.push(`ID: ${task.id}`);
    lines.push(`Name: ${task.name}`);
    lines.push(`Status: ${task.active ? 'Active' : 'Inactive'}`);
    lines.push(`Billable: ${task.billable ? 'Yes' : 'No'}`);
    lines.push(''); // Empty line between tasks
  });

  return lines.join('\\n');
}

/**
 * Highlights search terms in text (simple text-based highlighting)
 * @param text - Text to highlight in
 * @param searchTerm - Term to highlight
 * @returns Text with highlighted search terms
 */
function highlightSearchTerm(text: string, searchTerm: string): string {
  if (!searchTerm.trim()) {
    return text;
  }

  // Case-insensitive replacement with markers
  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
  return text.replace(regex, '**$1**'); // Using markdown-style bold for highlighting
}

/**
 * Escapes special regex characters in a string
 * @param string - String to escape
 * @returns Escaped string safe for regex
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
}

/**
 * Formats a project into a readable string for update responses
 */
function formatProjectDetails(project: Project): string {
  const lines: string[] = [];
  lines.push(`Project ID: ${project.id}`);
  lines.push(`Name: ${project.name}`);
  if (project.description) {
    lines.push(`Description: ${project.description}`);
  }
  lines.push(`Status: ${project.active ? 'Active' : 'Inactive'}`);
  if (project.customer) {
    lines.push(`Customer: ${project.customer.name}`);
  }
  if (project.leader) {
    lines.push(`Leader: ${project.leader.firstname} ${project.leader.lastname}`);
  }
  if (project.budget) {
    lines.push(`Budget: ${project.budget} ${project.currency}`);
  }
  if (project.budget_monthly) {
    lines.push(`Monthly Budget: ${project.budget_monthly} ${project.currency}`);
  }
  return lines.join('\n');
}

/**
 * Tool: update_project
 * Updates an existing project
 */
export const updateProjectTool = {
  name: 'update_project',
  description: 'Update an existing project. Only provide the fields you want to change. Note: Currency cannot be modified after creation.',
  inputSchema: zodToJsonSchema(UpdateProjectSchema),
  handler: async (params: z.infer<typeof UpdateProjectSchema>): Promise<string> => {
    const {
      projectId,
      name,
      startDate,
      finishDate,
      fixedPrice,
      retainer,
      leaderId,
      coLeaderId,
      customerId,
      dealId,
      projectGroupId,
      contactId,
      secondaryContactId,
      billingContactId,
      identifier,
      billingAddress,
      billingEmailTo,
      billingEmailCc,
      billingNotes,
      settingIncludeTimeReport,
      billingVariant,
      hourlyRate,
      budget,
      budgetMonthly,
      budgetExpenses,
      tags,
      customProperties,
      info
    } = params;

    // Validate date formats if provided
    if (startDate !== undefined && !isValidDateFormat(startDate)) {
      return createValidationErrorMessage({
        field: 'startDate',
        value: startDate,
        reason: 'invalid_date_format'
      });
    }
    if (finishDate !== undefined && !isValidDateFormat(finishDate)) {
      return createValidationErrorMessage({
        field: 'finishDate',
        value: finishDate,
        reason: 'invalid_date_format'
      });
    }

    // Build API parameters (only include provided fields)
    const apiParams: Record<string, unknown> = {};

    if (name !== undefined) apiParams.name = name;
    if (startDate !== undefined) apiParams.start_date = startDate;
    if (finishDate !== undefined) apiParams.finish_date = finishDate;
    if (fixedPrice !== undefined) apiParams.fixed_price = fixedPrice;
    if (retainer !== undefined) apiParams.retainer = retainer;
    if (leaderId !== undefined) apiParams.leader_id = leaderId;
    if (coLeaderId !== undefined) apiParams.co_leader_id = coLeaderId;
    if (customerId !== undefined) apiParams.customer_id = customerId;
    if (dealId !== undefined) apiParams.deal_id = dealId;
    if (projectGroupId !== undefined) apiParams.project_group_id = projectGroupId;
    if (contactId !== undefined) apiParams.contact_id = contactId;
    if (secondaryContactId !== undefined) apiParams.secondary_contact_id = secondaryContactId;
    if (billingContactId !== undefined) apiParams.billing_contact_id = billingContactId;
    if (identifier !== undefined) apiParams.identifier = identifier;
    if (billingAddress !== undefined) apiParams.billing_address = billingAddress;
    if (billingEmailTo !== undefined) apiParams.billing_email_to = billingEmailTo;
    if (billingEmailCc !== undefined) apiParams.billing_email_cc = billingEmailCc;
    if (billingNotes !== undefined) apiParams.billing_notes = billingNotes;
    if (settingIncludeTimeReport !== undefined) apiParams.setting_include_time_report = settingIncludeTimeReport;
    if (billingVariant !== undefined) apiParams.billing_variant = billingVariant;
    if (hourlyRate !== undefined) apiParams.hourly_rate = hourlyRate;
    if (budget !== undefined) apiParams.budget = budget;
    if (budgetMonthly !== undefined) apiParams.budget_monthly = budgetMonthly;
    if (budgetExpenses !== undefined) apiParams.budget_expenses = budgetExpenses;
    if (tags !== undefined) apiParams.tags = tags;
    if (customProperties !== undefined) apiParams.custom_properties = customProperties;
    if (info !== undefined) apiParams.info = info;

    // Check if any fields to update
    if (Object.keys(apiParams).length === 0) {
      return 'No fields provided to update. Please specify at least one field to change.';
    }

    try {
      const apiService = new MocoApiService();
      const project = await apiService.updateProject(projectId, apiParams as any);

      return `Project updated successfully!\n\n${formatProjectDetails(project)}`;

    } catch (error) {
      return `Error updating project ${projectId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};