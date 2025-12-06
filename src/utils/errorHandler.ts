/**
 * Error handling utilities for MoCo API interactions
 */

/**
 * Handles MoCo API errors and converts them to user-friendly messages
 * @param error - Error object from API call
 * @returns User-friendly error message in English
 */
export function handleMocoApiError(error: any): string {
  // Handle fetch errors (network, timeout, etc.)
  if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Network error'))) {
    return 'Network error accessing MoCo API. Please check your internet connection.';
  }

  // Handle HTTP error responses
  if (error.message && error.message.includes('HTTP')) {
    const httpMatch = error.message.match(/HTTP (\d+):/);
    if (httpMatch) {
      const statusCode = parseInt(httpMatch[1]);
      return createHttpErrorMessage(statusCode);
    }
  }

  // Handle generic errors
  if (error.message) {
    return `MoCo API error: ${error.message}`;
  }

  return 'Unknown error accessing MoCo API.';
}

/**
 * Creates appropriate error messages for HTTP status codes
 * @param statusCode - HTTP status code
 * @returns User-friendly error message in English
 */
function createHttpErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Invalid parameters. Please check your inputs.';
    
    case 401:
      return 'API authentication failed. Please check MOCO_API_KEY.';
    
    case 403:
      return 'Access denied. Please check your API permissions.';
    
    case 404:
      return 'Resource not found. Please check the provided IDs.';
    
    case 422:
      return 'Invalid data. Please check date formats and value ranges.';
    
    case 429:
      return 'API limit reached. Please try again in a few seconds.';
    
    case 500:
    case 502:
    case 503:
    case 504:
      return 'MoCo server error. Please try again later.';
    
    default:
      return `HTTP error ${statusCode}. Please contact support.`;
  }
}

/**
 * Creates user-friendly error messages for validation errors
 * @param error - Validation error details
 * @returns User-friendly error message in English
 */
export function createValidationErrorMessage(error: {
  field: string;
  value: any;
  reason: string;
}): string {
  const { field, value, reason } = error;
  
  switch (reason) {
    case 'invalid_date_format':
      return `Invalid date format for ${field}: "${value}". Expected: YYYY-MM-DD (e.g. 2024-01-15)`;
    
    case 'invalid_date_range':
      return `Invalid date range: Start date must be before or equal to end date.`;
    
    case 'invalid_year':
      return `Invalid year: "${value}". Years between 2000 and ${new Date().getFullYear() + 1} are allowed.`;
    
    case 'missing_parameter':
      return `Required parameter missing: ${field}`;
    
    case 'invalid_project_id':
      return `Invalid project ID: "${value}". Project ID must be a positive number.`;
    
    case 'empty_search_query':
      return `Search query cannot be empty.`;
    
    default:
      return `Validation error for ${field}: ${reason}`;
  }
}

/**
 * Creates user-friendly messages for empty result sets
 * @param context - Context information about the empty result
 * @returns User-friendly message in English
 */
export function createEmptyResultMessage(context: {
  type: 'activities' | 'projects' | 'tasks' | 'holidays' | 'presences' | 'public_holidays' | 'companies' | 'contacts' | 'invoices';
  startDate?: string;
  endDate?: string;
  year?: number;
  projectId?: number;
  query?: string;
}): string {
  const { type, startDate, endDate, year, projectId, query } = context;

  switch (type) {
    case 'activities':
      return `No activities found in the period ${startDate} to ${endDate}.`;

    case 'projects':
      return query
        ? `No projects found for search term "${query}".`
        : 'No projects found.';

    case 'tasks':
      return `No tasks found for project ${projectId}.`;

    case 'holidays':
      return `No holidays found for year ${year}.`;

    case 'presences':
      return `No presences found in the period ${startDate} to ${endDate}.`;

    case 'companies':
      return 'No companies found.';

    case 'contacts':
      return 'No contacts found.';

    case 'invoices':
      return 'No invoices found.';

    default:
      return 'No results found.';
  }
}