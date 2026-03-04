#!/usr/bin/env node

/**
 * MoCo MCP Server
 * Provides Model Context Protocol access to MoCo API for time tracking,
 * project management, holiday tracking, and presence monitoring
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import all MCP tools
import {
  getActivitiesTool,
  createActivityTool,
  updateActivityTool,
  deleteActivityTool,
  startActivityTimerTool,
  stopActivityTimerTool
} from './tools/activitiesTools.js';
import {
  getUserProjectsTool,
  getUserProjectTasksTool,
  updateProjectTool
} from './tools/userProjectsTools.js';
import {
  getCompaniesTool,
  getCompanyTool,
  createCompanyTool,
  updateCompanyTool,
  deleteCompanyTool
} from './tools/companiesTools.js';
import { getCurrentUserTool, getUsersTool, getUserTool } from './tools/usersTools.js';
import {
  getContactsTool,
  getContactTool,
  createContactTool,
  updateContactTool,
  deleteContactTool
} from './tools/contactsTools.js';
import {
  getInvoicesTool,
  getInvoiceTool,
  createInvoiceTool,
  updateInvoiceStatusTool,
  sendInvoiceEmailTool,
  deleteInvoiceTool
} from './tools/invoicesTools.js';
import { getUserHolidaysTool } from './tools/userHolidaysTools.js';
import { 
  getUserPresencesTool,
  createPresenceTool,
  updatePresenceTool,
  deletePresenceTool,
  touchPresenceTool
} from './tools/userPresencesTools.js';
import { getUserSickDaysTool } from './tools/userSickDaysTools.js';
import { getPublicHolidaysTool } from './tools/publicHolidaysTools.js';

// Import MCP prompts
import { MOCO_PROMPTS, getMocoPromptByName } from './prompts/mocoPrompts.js';

/**
 * Available MCP tools for MoCo API access
 */
const AVAILABLE_TOOLS = [
  // Activities - Read
  getActivitiesTool,
  // Activities - Write
  createActivityTool,
  updateActivityTool,
  deleteActivityTool,
  // Activities - Timer
  startActivityTimerTool,
  stopActivityTimerTool,
  // Projects - Read
  getUserProjectsTool,
  getUserProjectTasksTool,
  // Projects - Write
  updateProjectTool,
  // Companies - CRUD
  getCompaniesTool,
  getCompanyTool,
  createCompanyTool,
  updateCompanyTool,
  deleteCompanyTool,
  // Users - Read
  getCurrentUserTool,
  getUsersTool,
  getUserTool,
  // Contacts - CRUD
  getContactsTool,
  getContactTool,
  createContactTool,
  updateContactTool,
  deleteContactTool,
  // Invoices - CRUD
  getInvoicesTool,
  getInvoiceTool,
  createInvoiceTool,
  updateInvoiceStatusTool,
  sendInvoiceEmailTool,
  deleteInvoiceTool,
  // Holidays & Presences
  getUserHolidaysTool,
  getUserPresencesTool,
  createPresenceTool,
  updatePresenceTool,
  deletePresenceTool,
  touchPresenceTool,
  getUserSickDaysTool,
  getPublicHolidaysTool
];

const server = new Server(
  {
    name: "moco-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {}, // We support tools
      resources: {}, // No resources currently
      prompts: {}, // We support prompts
    },
  }
);

/**
 * Handle resource listing - currently no resources provided
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [],
  };
});

/**
 * Handle resource reading - currently no resources provided
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  throw new Error(`Resource not found: ${request.params.uri}`);
});

/**
 * Handle prompt listing - return all available MoCo prompts
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: MOCO_PROMPTS.map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments
    }))
  };
});

/**
 * Handle prompt retrieval - return specific prompt template
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const prompt = getMocoPromptByName(name);
  if (!prompt) {
    throw new Error(`Prompt not found: ${name}`);
  }

  // Generate prompt template based on the specific prompt type
  let template = '';
  
  switch (name) {
    case 'weekly_time_report':
      template = generateWeeklyTimeReportPrompt(args);
      break;
    case 'vacation_planning_assistant':
      template = generateVacationPlanningPrompt(args);
      break;
    case 'personal_productivity_insights':
      template = generateProductivityInsightsPrompt(args);
      break;
    case 'monthly_business_review':
      template = generateMonthlyBusinessReviewPrompt(args);
      break;
    case 'smart_work_life_balance_advisor':
      template = generateWorkLifeBalancePrompt(args);
      break;
    case 'project_time_analysis':
      template = generateProjectTimeAnalysisPrompt(args);
      break;
    case 'team_capacity_overview':
      template = generateTeamCapacityPrompt(args);
      break;
    case 'work_hours_compliance_check':
      template = generateComplianceCheckPrompt(args);
      break;
    default:
      throw new Error(`Prompt template not implemented: ${name}`);
  }

  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: template
        }
      }
    ]
  };
});

/**
 * Handle tool listing - return all available MoCo tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: AVAILABLE_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
});

/**
 * Handle tool execution - dispatch to appropriate tool handler
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Find the requested tool
  const tool = AVAILABLE_TOOLS.find(t => t.name === name);
  
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  try {
    // Execute the tool with provided arguments
    const result = await tool.handler(args as any || {});
    
    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  } catch (error) {
    // Return error as text response rather than throwing
    return {
      content: [
        {
          type: "text", 
          text: `Error executing tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

// Prompt template generation functions
function generateWeeklyTimeReportPrompt(args: any): string {
  const weekStart = args?.week_start || 'current Monday';
  const includeBillable = args?.include_billable_analysis !== false;
  
  return `Please generate a comprehensive weekly time tracking report for the week starting ${weekStart}.

Use the following MoCo tools to gather the necessary data:
1. get_activities - to retrieve all time entries for the specified week
2. get_user_projects - to get project details and names
3. get_user_presences - to check actual working hours vs recorded time

The report should include:
- Total hours worked during the week
- Breakdown by project with project names and descriptions
- Daily time distribution
- ${includeBillable ? 'Analysis of billable vs non-billable hours' : ''}
- Productivity insights and recommendations
- Any gaps or discrepancies between presence and recorded activities

Format the output as a well-structured report with clear sections and actionable insights.`;
}

function generateVacationPlanningPrompt(args: any): string {
  const startDate = args?.planned_start_date;
  const endDate = args?.planned_end_date;
  const year = args?.year || new Date().getFullYear();
  
  if (!startDate || !endDate) {
    return 'Error: planned_start_date and planned_end_date are required for vacation planning.';
  }
  
  return `Please help me plan my vacation from ${startDate} to ${endDate}.

Use the following MoCo tools to analyze my vacation planning:
1. get_user_holidays - to check my available vacation days for ${year}
2. get_public_holidays - to identify public holidays during the planned period
3. get_user_presences - to review my recent work patterns

Please provide:
- Analysis of available vacation days vs planned vacation length
- Identification of public holidays that fall within the vacation period
- Recommendations for optimal vacation timing
- Impact on my annual vacation budget
- Suggestions for extending or adjusting the vacation period if beneficial

Consider both personal work-life balance and business considerations in your recommendations.`;
}

function generateProductivityInsightsPrompt(args: any): string {
  const period = args?.analysis_period || 'last_month';
  const focusArea = args?.focus_area || 'general_productivity';
  
  return `Please analyze my personal productivity patterns for the period: ${period}, with focus on: ${focusArea}.

Use these MoCo tools for comprehensive analysis:
1. get_activities - to analyze time tracking patterns and project distribution
2. get_user_presences - to understand actual working hours and schedule consistency
3. get_user_projects - to get context about project types and priorities
4. get_user_project_tasks - to analyze task-level productivity

Provide insights on:
- Time allocation efficiency across different projects/tasks
- Work pattern consistency and optimal productive hours
- Project switching frequency and impact on productivity
- Comparison of planned vs actual time spent on activities
- Identification of productivity bottlenecks or inefficiencies
- Personalized recommendations for productivity improvement
- Suggested workflow optimizations based on observed patterns

Include specific metrics and actionable recommendations tailored to my work style.`;
}

function generateMonthlyBusinessReviewPrompt(args: any): string {
  const month = args?.month || new Date().getMonth() + 1;
  const year = args?.year || new Date().getFullYear();
  const includeComparisons = args?.include_comparisons !== false;
  
  return `Please create a comprehensive monthly business review for ${month}/${year}.

Use these MoCo tools to gather business intelligence:
1. get_activities - for detailed time tracking analysis across all projects
2. get_user_projects - to understand project portfolio and status
3. get_user_presences - to analyze actual working time vs planned capacity
4. get_user_holidays - to account for vacation time in capacity planning
5. get_public_holidays - to consider holiday impact on productivity

The review should cover:
- Overall time utilization and capacity analysis
- Project-wise performance metrics and progress
- Resource allocation effectiveness
- Billable vs non-billable time distribution
- Productivity trends and patterns
- ${includeComparisons ? 'Month-over-month and year-over-year comparisons' : ''}
- Key performance indicators and business metrics
- Strategic recommendations for the upcoming month
- Risk identification and mitigation strategies

Present findings in an executive summary format suitable for stakeholder review.`;
}

function generateWorkLifeBalancePrompt(args: any): string {
  const analysisWeeks = args?.analysis_weeks || 4;
  const targetHours = args?.target_hours_per_week || 40;
  
  return `Please evaluate my work-life balance over the last ${analysisWeeks} weeks, using ${targetHours} hours as the target weekly hours.

Use these MoCo tools for work-life balance analysis:
1. get_user_presences - to analyze actual working hours and patterns
2. get_activities - to understand time intensity and project demands
3. get_user_holidays - to check recent vacation usage
4. get_user_sick_days - to monitor health-related absences

Analyze and provide insights on:
- Average weekly working hours vs target (${targetHours} hours)
- Daily work pattern consistency and overtime frequency
- Work intensity distribution across days and weeks
- Break patterns and time between work sessions
- Recent vacation usage and upcoming vacation needs
- Health indicators based on sick day patterns
- Work schedule sustainability and stress indicators
- Personalized recommendations for better work-life balance
- Suggested schedule adjustments and boundary improvements
- Early warning signs of burnout or overwork

Include specific, actionable advice for maintaining healthy work habits while meeting professional commitments.`;
}

function generateProjectTimeAnalysisPrompt(args: any): string {
  const projectIds = args?.project_ids || '';
  const timePeriod = args?.time_period || 'last_month';
  const projectFilter = projectIds ? `projects with IDs: ${projectIds}` : 'all active projects';
  
  return `Please conduct a detailed time analysis for ${projectFilter} over the ${timePeriod} period.

Use these MoCo tools for comprehensive project analysis:
1. get_activities - to get detailed time entries for project analysis
2. get_user_projects - to understand project context, budgets, and billing rates
3. get_user_project_tasks - to analyze task-level time distribution
4. get_user_presences - to correlate actual working time with project time

Provide detailed analysis including:
- Total time invested per project with task breakdown
- Project efficiency metrics and time utilization rates
- Billable hours analysis and revenue implications
- Task-level time distribution and completion patterns
- Project profitability analysis (if billing rates available)
- Time estimation accuracy vs actual time spent
- Resource allocation effectiveness across projects
- Identification of time-consuming activities or bottlenecks
- Project timeline adherence and milestone progress
- Recommendations for improved project time management
- Suggestions for better task estimation and planning

Include visual summaries and actionable insights for optimizing project delivery and profitability.`;
}

function generateTeamCapacityPrompt(args: any): string {
  const planningHorizon = args?.planning_horizon || 8;
  const includeHolidays = args?.include_holidays !== false;
  
  return `Please provide a team capacity overview for the next ${planningHorizon} weeks${includeHolidays ? ', including holiday considerations' : ''}.

Use these MoCo tools for capacity planning:
1. get_user_presences - to understand current team work patterns
2. get_user_holidays - to identify planned vacation periods
3. get_user_projects - to understand current project commitments
4. ${includeHolidays ? 'get_public_holidays - to factor in public holidays' : ''}

Provide comprehensive capacity analysis:
- Current team utilization rates and availability
- Planned absences and vacation schedules impact
- ${includeHolidays ? 'Public holiday impact on available working days' : ''}
- Project resource allocation and commitment levels
- Capacity bottlenecks and resource constraints identification
- Recommendations for optimal resource distribution
- Risk assessment for upcoming project deadlines
- Suggestions for capacity optimization and load balancing
- Early warning indicators for resource conflicts
- Strategic recommendations for resource planning

Present findings in a format suitable for project managers and team leads to make informed staffing decisions.`;
}

function generateComplianceCheckPrompt(args: any): string {
  const checkPeriod = args?.check_period || 'last_month';
  const maxWeeklyHours = args?.max_weekly_hours || 48;
  const maxDailyHours = args?.max_daily_hours || 10;
  
  return `Please conduct a comprehensive work hours compliance check for the ${checkPeriod} period.

Legal limits to check against:
- Maximum weekly hours: ${maxWeeklyHours}
- Maximum daily hours: ${maxDailyHours}

Use these MoCo tools for compliance analysis:
1. get_user_presences - to analyze actual working hours and patterns
2. get_activities - to cross-reference recorded work time
3. get_user_holidays - to properly account for vacation time
4. get_public_holidays - to exclude holidays from working time calculations

Compliance analysis should include:
- Daily working hours review against ${maxDailyHours}-hour limit
- Weekly working hours assessment against ${maxWeeklyHours}-hour limit
- Identification of any compliance violations or near-violations
- Analysis of overtime patterns and frequency
- Rest period compliance between work sessions
- Weekend work frequency and patterns
- Holiday and vacation time proper accounting
- Recommendations for compliance improvement
- Risk assessment for labor law violations
- Suggested policy adjustments for better compliance
- Documentation recommendations for audit purposes

Provide a clear compliance status report with specific violations identified and corrective action recommendations.`;
}

/**
 * Main server initialization and startup
 */
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MoCo MCP Server running on stdio");
    console.error(`Available tools: ${AVAILABLE_TOOLS.map(t => t.name).join(', ')}`);
    console.error(`Available prompts: ${MOCO_PROMPTS.map(p => p.name).join(', ')}`);
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});