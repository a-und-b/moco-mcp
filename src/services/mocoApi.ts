/**
 * MoCo API service client
 * Handles all HTTP communication with the MoCo API including authentication,
 * pagination, and error handling
 */

import { getMocoConfig } from '../config/environment.js';
import { handleMocoApiError } from '../utils/errorHandler.js';
import type {
  Activity,
  Project,
  Task,
  UserHoliday,
  UserPresence,
  Company,
  Contact,
  Invoice,
  InvoiceItem,
  StaffUser
} from '../types/mocoTypes.js';

/**
 * HTTP client for MoCo API with automatic pagination and error handling
 */
export class MocoApiService {
  private readonly config = getMocoConfig();
  
  /**
   * Default request headers for MoCo API
   */
  private get defaultHeaders(): Record<string, string> {
    return {
      'Authorization': `Token token=${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Makes an HTTP request to the MoCo API with error handling
   * @param endpoint - API endpoint path (without base URL)
   * @param params - Query parameters
   * @returns Promise with parsed JSON response
   */
  private async makeRequest<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.defaultHeaders
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      throw new Error(handleMocoApiError(error));
    }
  }

  /**
   * Makes a POST request to the MoCo API
   * @param endpoint - API endpoint path (without base URL)
   * @param body - Request body
   * @param extraHeaders - Optional additional headers (e.g. X-IMPERSONATE-USER-ID)
   * @returns Promise with parsed JSON response
   */
  private async makePostRequest<T>(endpoint: string, body: Record<string, unknown>, extraHeaders?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    const headers = { ...this.defaultHeaders, ...extraHeaders };

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      return await response.json() as T;
    } catch (error) {
      throw new Error(handleMocoApiError(error));
    }
  }

  /**
   * Makes a PUT request to the MoCo API
   * @param endpoint - API endpoint path (without base URL)
   * @param body - Request body
   * @param extraHeaders - Optional additional headers (e.g. X-IMPERSONATE-USER-ID)
   * @returns Promise with parsed JSON response
   */
  private async makePutRequest<T>(endpoint: string, body: Record<string, unknown>, extraHeaders?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    const headers = { ...this.defaultHeaders, ...extraHeaders };

    try {
      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      return await response.json() as T;
    } catch (error) {
      throw new Error(handleMocoApiError(error));
    }
  }

  /**
   * Makes a PATCH request to the MoCo API
   * @param endpoint - API endpoint path (without base URL)
   * @returns Promise with parsed JSON response
   */
  private async makePatchRequest<T>(endpoint: string): Promise<T> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'PATCH',
        headers: this.defaultHeaders
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      return await response.json() as T;
    } catch (error) {
      throw new Error(handleMocoApiError(error));
    }
  }

  /**
   * Makes a DELETE request to the MoCo API
   * @param endpoint - API endpoint path (without base URL)
   * @param extraHeaders - Optional additional headers (e.g. X-IMPERSONATE-USER-ID)
   * @returns Promise with success status
   */
  private async makeDeleteRequest(endpoint: string, extraHeaders?: Record<string, string>): Promise<void> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    const headers = { ...this.defaultHeaders, ...extraHeaders };

    try {
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(handleMocoApiError(error));
    }
  }

  /**
   * Makes an HTTP request to the MoCo API with headers for pagination
   * @param endpoint - API endpoint path (without base URL)
   * @param params - Query parameters
   * @returns Promise with parsed JSON response and headers
   */
  private async makeRequestWithHeaders<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<{ data: T; headers: Headers }> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.defaultHeaders
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as T;
      return { data, headers: response.headers };
    } catch (error) {
      throw new Error(handleMocoApiError(error));
    }
  }

  /**
   * Fetches all pages of a paginated endpoint automatically using header-based pagination
   * @param endpoint - API endpoint path
   * @param params - Query parameters
   * @returns Promise with all items from all pages
   */
  private async fetchAllPages<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T[]> {
    const allItems: T[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const { data, headers } = await this.makeRequestWithHeaders<T[]>(endpoint, {
        ...params,
        page: currentPage
      });

      // MoCo API returns direct arrays, not nested in data property
      allItems.push(...data);
      
      // Check pagination info from headers
      const xPage = headers.get('X-Page');
      const xTotal = headers.get('X-Total');
      const xPerPage = headers.get('X-Per-Page');
      
      if (xPage && xTotal && xPerPage) {
        const totalItems = parseInt(xTotal, 10);
        const itemsPerPage = parseInt(xPerPage, 10);
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        hasMorePages = currentPage < totalPages;
      } else {
        // No pagination headers found, assume single page
        hasMorePages = false;
      }
      
      currentPage++;
    }

    return allItems;
  }

  /**
   * Retrieves activities within a date range
   * @param startDate - Start date in ISO 8601 format (YYYY-MM-DD)
   * @param endDate - End date in ISO 8601 format (YYYY-MM-DD)
   * @param projectId - Optional project ID to filter activities
   * @param userId - Optional user ID to filter activities for a specific user
   * @returns Promise with array of activities
   */
  async getActivities(startDate: string, endDate: string, projectId?: number, userId?: number): Promise<Activity[]> {
    const params: Record<string, string | number> = {
      from: startDate,
      to: endDate
    };
    
    if (projectId) {
      params.project_id = projectId;
    }
    if (userId) {
      params.user_id = userId;
    }
    
    return this.fetchAllPages<Activity>('/activities', params);
  }

  /**
   * Retrieves the currently authenticated user via /session endpoint
   * @returns Promise with current user
   */
  async getCurrentUser(): Promise<StaffUser> {
    return this.makeRequest<StaffUser>('/session');
  }

  /**
   * Retrieves all staff users
   * @param params - Optional filters: email, tags, includeArchived
   * @returns Promise with array of staff users
   */
  async getUsers(params?: { email?: string; tags?: string; includeArchived?: boolean }): Promise<StaffUser[]> {
    const apiParams: Record<string, string | number> = {};
    if (params?.email) apiParams.email = params.email;
    if (params?.tags) apiParams.tags = params.tags;
    if (params?.includeArchived !== undefined) apiParams.include_archived = params.includeArchived ? 'true' : 'false';
    return this.fetchAllPages<StaffUser>('/users', apiParams);
  }

  /**
   * Retrieves a single staff user by ID
   * @param userId - User ID
   * @returns Promise with staff user
   */
  async getUser(userId: number): Promise<StaffUser> {
    return this.makeRequest<StaffUser>(`/users/${userId}`, {});
  }

  /**
   * Retrieves all projects assigned to the current user
   * @returns Promise with array of assigned projects
   */
  async getProjects(): Promise<Project[]> {
    return this.fetchAllPages<Project>('/projects/assigned');
  }

  /**
   * Searches for projects by name or description
   * @param query - Search query string
   * @returns Promise with array of matching projects
   */
  async searchProjects(query: string): Promise<Project[]> {
    // Get all projects and filter client-side since MoCo API doesn't have text search
    const allProjects = await this.getProjects();
    
    const lowerQuery = query.toLowerCase();
    return allProjects.filter(project => 
      project.name.toLowerCase().includes(lowerQuery) ||
      (project.description && project.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Retrieves all tasks for a specific assigned project
   * @param projectId - Project ID (must be assigned to current user)
   * @returns Promise with array of tasks
   */
  async getProjectTasks(projectId: number): Promise<Task[]> {
    // Get all assigned projects
    const assignedProjects = await this.getProjects();
    
    // Find the specific project
    const project = assignedProjects.find(p => p.id === projectId);
    
    if (!project) {
      throw new Error(`Project ${projectId} is not assigned to the current user or does not exist.`);
    }
    
    // Extract tasks from the project and convert to full Task interface
    return project.tasks.map(task => ({
      id: task.id,
      name: task.name,
      active: task.active,
      billable: task.billable,
      project: {
        id: project.id,
        name: project.name
      },
      created_at: project.created_at,
      updated_at: project.updated_at
    }));
  }

  /**
   * Retrieves user holidays for a specific year
   * @param year - Year (e.g., 2024)
   * @returns Promise with array of user holidays
   */
  async getUserHolidays(year: number): Promise<UserHoliday[]> {
    try {
      return await this.makeRequest<UserHoliday[]>('/users/holidays', {
        year: year
      });
    } catch (error) {
      // If 404 error (Resource not found), return empty array instead of throwing error
      // This happens when no holiday data exists for the year yet
      if (error instanceof Error && error.message.includes('Resource not found')) {
        return [];
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Retrieves actual taken holidays (absences) for a specific year using schedules endpoint
   * @param year - Year (e.g., 2024)
   * @returns Promise with array of taken holiday schedules
   */
  async getTakenHolidays(year: number): Promise<any[]> {
    // Calculate year date range
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    console.error(`DEBUG API: Trying to fetch schedules for ${startDate} to ${endDate}`);
    
    try {
      // Schedules endpoint has different response structure, use direct request
      // Based on previous success with makeRequest showing 63 schedules
      const allSchedules = await this.makeRequest<any[]>('/schedules', {
        from: startDate,
        to: endDate
      });
      
      console.error(`DEBUG API: Found ${allSchedules.length} total schedules for ${year}`);
      if (allSchedules.length > 0) {
        console.error('DEBUG API: First few schedules:', JSON.stringify(allSchedules.slice(0, 3), null, 2));
      }
      
      // Filter for absences (schedules with assignment type "Absence")
      const absences = allSchedules.filter(schedule => 
        schedule.assignment && 
        schedule.assignment.type === 'Absence'
      );
      console.error(`DEBUG API: Found ${absences.length} absences with assignment codes:`, absences.map(a => a.assignment?.code + ' (' + a.assignment?.name + ')'));
      
      // Look specifically for vacation/holiday codes (we need to figure out which code is for vacation)
      const vacationCodes = ['3', '4', '5']; // Common vacation codes to try
      const holidays = absences.filter(schedule => 
        vacationCodes.includes(schedule.assignment?.code)
      );
      console.error(`DEBUG API: Found ${holidays.length} potential holidays with codes:`, holidays.map(a => a.assignment?.code + ' (' + a.assignment?.name + ')'));
      
      // Filter for only vacation days (assignment code "4")
      const vacationDays = absences.filter(schedule => 
        schedule.assignment?.code === '4' && schedule.assignment?.name === 'Urlaub'
      );
      console.error(`DEBUG API: Found ${vacationDays.length} actual vacation days (code 4)`);
      
      return vacationDays;
    } catch (error) {
      console.error('DEBUG API: Error fetching schedules:', error);
      console.error('DEBUG API: Error details:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Retrieves actual taken sick days for a specific year using schedules endpoint
   * @param year - Year (e.g., 2024)
   * @returns Promise with array of taken sick day schedules
   */
  async getTakenSickDays(year: number): Promise<any[]> {
    // Calculate year date range
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    console.error(`DEBUG API: Trying to fetch sick days for ${startDate} to ${endDate}`);
    
    try {
      // Get ALL schedules using direct request (schedules has different response structure)
      const allSchedules = await this.makeRequest<any[]>('/schedules', {
        from: startDate,
        to: endDate
      });
      
      console.error(`DEBUG API: Found ${allSchedules.length} total schedules for sick days query`);
      
      // Filter for sick days (assignment code "3" and name "Krankheit")
      const sickDays = allSchedules.filter(schedule => 
        schedule.assignment && 
        schedule.assignment.type === 'Absence' &&
        schedule.assignment.code === '3' && 
        schedule.assignment.name === 'Krankheit'
      );
      console.error(`DEBUG API: Found ${sickDays.length} actual sick days (code 3)`);
      
      return sickDays;
    } catch (error) {
      console.error('DEBUG API: Error fetching sick days:', error);
      console.error('DEBUG API: Error details:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Retrieves public holidays for a specific year using schedules endpoint
   * @param year - Year (e.g., 2024)
   * @returns Promise with array of public holiday schedules
   */
  async getPublicHolidays(year: number): Promise<any[]> {
    // Calculate year date range
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    try {
      // Get ALL schedules using direct request
      const allSchedules = await this.makeRequest<any[]>('/schedules', {
        from: startDate,
        to: endDate
      });
      
      // Filter for public holidays (assignment code "2" and type "Absence")
      const publicHolidays = allSchedules.filter(schedule => 
        schedule.assignment && 
        schedule.assignment.type === 'Absence' &&
        schedule.assignment.code === '2'
      );
      
      return publicHolidays;
    } catch (error) {
      console.error('DEBUG API: Error fetching public holidays:', error);
      return [];
    }
  }

  /**
   * Retrieves user presences within a date range
   * @param startDate - Start date in ISO 8601 format (YYYY-MM-DD)
   * @param endDate - End date in ISO 8601 format (YYYY-MM-DD)
   * @returns Promise with array of user presences
   */
  async getUserPresences(startDate: string, endDate: string): Promise<UserPresence[]> {
    return this.fetchAllPages<UserPresence>('/users/presences', {
      from: startDate,
      to: endDate
    });
  }

  // ============================================
  // USER PRESENCES - Write Operations
  // ============================================

  /**
   * Creates a new user presence (work time entry)
   * @param params - Presence creation parameters
   * @returns Promise with created presence
   */
  async createPresence(params: {
    date: string;      // YYYY-MM-DD
    from: string;      // HH:MM
    to?: string;       // HH:MM (optional, omit for open presence)
  }): Promise<UserPresence> {
    return this.makePostRequest<UserPresence>('/users/presences', params);
  }

  /**
   * Updates an existing user presence
   * @param presenceId - ID of the presence to update
   * @param params - Fields to update
   * @returns Promise with updated presence
   */
  async updatePresence(presenceId: number, params: {
    date?: string;
    from?: string;
    to?: string;
  }): Promise<UserPresence> {
    return this.makePutRequest<UserPresence>(`/users/presences/${presenceId}`, params);
  }

  /**
   * Deletes a user presence
   * @param presenceId - ID of the presence to delete
   */
  async deletePresence(presenceId: number): Promise<void> {
    return this.makeDeleteRequest(`/users/presences/${presenceId}`);
  }

  /**
   * Touch: Start or stop presence (clock in/out)
   * Creates a new presence starting now, or closes an open presence
   * @returns Promise with created/updated presence
   */
  async touchPresence(): Promise<UserPresence> {
    return this.makePostRequest<UserPresence>('/users/presences/touch', {});
  }

  // ============================================
  // ACTIVITIES - Write Operations
  // ============================================

  /**
   * Creates a new activity (time entry)
   * @param params - Activity creation parameters
   * @param impersonateUserId - Optional user ID to create activity for (requires Staff permissions)
   * @returns Promise with created activity
   */
  async createActivity(params: {
    date: string;
    project_id: number;
    task_id: number;
    seconds?: number;
    description?: string;
    billable?: boolean;
    tag?: string;
    remote_service?: 'trello' | 'jira' | 'asana' | 'basecamp' | 'wunderlist' | 'toggl' | 'mite' | 'github' | 'youtrack';
    remote_id?: string;
    remote_url?: string;
  }, impersonateUserId?: number): Promise<Activity> {
    const extraHeaders = impersonateUserId ? { 'X-IMPERSONATE-USER-ID': String(impersonateUserId) } : undefined;
    return this.makePostRequest<Activity>('/activities', params, extraHeaders);
  }

  /**
   * Updates an existing activity
   * @param activityId - ID of the activity to update
   * @param params - Fields to update
   * @param impersonateUserId - Optional user ID to act as (requires Staff permissions)
   * @returns Promise with updated activity
   */
  async updateActivity(activityId: number, params: {
    date?: string;
    project_id?: number;
    task_id?: number;
    seconds?: number;
    description?: string;
    billable?: boolean;
    tag?: string;
    remote_service?: 'trello' | 'jira' | 'asana' | 'basecamp' | 'wunderlist' | 'toggl' | 'mite' | 'github' | 'youtrack';
    remote_id?: string;
    remote_url?: string;
  }, impersonateUserId?: number): Promise<Activity> {
    const extraHeaders = impersonateUserId ? { 'X-IMPERSONATE-USER-ID': String(impersonateUserId) } : undefined;
    return this.makePutRequest<Activity>(`/activities/${activityId}`, params, extraHeaders);
  }

  /**
   * Deletes an activity
   * Note: Only possible if the activity has not been billed or locked
   * @param activityId - ID of the activity to delete
   * @param impersonateUserId - Optional user ID to act as (requires Staff permissions)
   */
  async deleteActivity(activityId: number, impersonateUserId?: number): Promise<void> {
    const extraHeaders = impersonateUserId ? { 'X-IMPERSONATE-USER-ID': String(impersonateUserId) } : undefined;
    return this.makeDeleteRequest(`/activities/${activityId}`, extraHeaders);
  }

  /**
   * Starts or resumes a timer on an activity
   * Note: Only works for activities on the current day
   * @param activityId - ID of the activity to start timer for
   * @returns Promise with updated activity
   */
  async startActivityTimer(activityId: number): Promise<Activity> {
    return this.makePatchRequest<Activity>(`/activities/${activityId}/start_timer`);
  }

  /**
   * Stops the timer on an activity
   * @param activityId - ID of the activity to stop timer for
   * @returns Promise with updated activity
   */
  async stopActivityTimer(activityId: number): Promise<Activity> {
    return this.makePatchRequest<Activity>(`/activities/${activityId}/stop_timer`);
  }

  // ============================================
  // PROJECTS - Write Operations
  // ============================================

  /**
   * Updates an existing project
   * Note: Currency cannot be modified after creation
   * @param projectId - ID of the project to update
   * @param params - Fields to update
   * @returns Promise with updated project
   */
  async updateProject(projectId: number, params: {
    name?: string;
    start_date?: string;
    finish_date?: string;
    fixed_price?: boolean;
    retainer?: boolean;
    leader_id?: number;
    co_leader_id?: number;
    customer_id?: number;
    deal_id?: number;
    project_group_id?: number;
    contact_id?: number;
    secondary_contact_id?: number;
    billing_contact_id?: number;
    identifier?: string;
    billing_address?: string;
    billing_email_to?: string;
    billing_email_cc?: string;
    billing_notes?: string;
    setting_include_time_report?: boolean;
    billing_variant?: 'project' | 'task' | 'user';
    hourly_rate?: number;
    budget?: number;
    budget_monthly?: number;
    budget_expenses?: number;
    tags?: string[];
    custom_properties?: Record<string, string>;
    info?: string;
  }): Promise<Project> {
    return this.makePutRequest<Project>(`/projects/${projectId}`, params);
  }

  // ============================================
  // COMPANIES - CRUD Operations
  // ============================================

  /**
   * Retrieves all companies with optional filtering
   * @param params - Filter parameters
   * @returns Promise with array of companies
   */
  async getCompanies(params?: {
    type?: 'customer' | 'supplier' | 'organization';
    tags?: string;
    identifier?: string;
    term?: string;
  }): Promise<Company[]> {
    const queryParams: Record<string, string | number> = {};
    if (params?.type) queryParams.type = params.type;
    if (params?.tags) queryParams.tags = params.tags;
    if (params?.identifier) queryParams.identifier = params.identifier;
    if (params?.term) queryParams.term = params.term;
    return this.fetchAllPages<Company>('/companies', queryParams);
  }

  /**
   * Retrieves a single company by ID
   * @param companyId - Company ID
   * @returns Promise with company
   */
  async getCompany(companyId: number): Promise<Company> {
    return this.makeRequest<Company>(`/companies/${companyId}`);
  }

  /**
   * Creates a new company
   * @param params - Company creation parameters
   * @returns Promise with created company
   */
  async createCompany(params: {
    name: string;
    type: 'customer' | 'supplier' | 'organization';
    currency?: string;
    country_code?: string;
    vat_identifier?: string;
    website?: string;
    phone?: string;
    fax?: string;
    email?: string;
    billing_email_cc?: string;
    billing_notes?: string;
    address?: string;
    info?: string;
    tags?: string[];
    user_id?: number;
    footer?: string;
    custom_properties?: Record<string, string>;
    identifier?: string;
    customer_tax?: number;
    default_invoice_due_days?: number;
    debit_number?: string;
    iban?: string;
    credit_number?: string;
  }): Promise<Company> {
    return this.makePostRequest<Company>('/companies', params);
  }

  /**
   * Updates an existing company
   * @param companyId - ID of the company to update
   * @param params - Fields to update
   * @returns Promise with updated company
   */
  async updateCompany(companyId: number, params: {
    name?: string;
    type?: 'customer' | 'supplier' | 'organization';
    country_code?: string;
    vat_identifier?: string;
    website?: string;
    phone?: string;
    fax?: string;
    email?: string;
    billing_email_cc?: string;
    billing_notes?: string;
    address?: string;
    info?: string;
    tags?: string[];
    user_id?: number;
    footer?: string;
    custom_properties?: Record<string, string>;
    identifier?: string;
    customer_tax?: number;
    default_invoice_due_days?: number;
    debit_number?: string;
    iban?: string;
    credit_number?: string;
  }): Promise<Company> {
    return this.makePutRequest<Company>(`/companies/${companyId}`, params);
  }

  /**
   * Deletes a company
   * @param companyId - ID of the company to delete
   */
  async deleteCompany(companyId: number): Promise<void> {
    return this.makeDeleteRequest(`/companies/${companyId}`);
  }

  // ============================================
  // CONTACTS - CRUD Operations
  // ============================================

  /**
   * Retrieves all contacts with optional filtering
   * @param params - Filter parameters
   * @returns Promise with array of contacts
   */
  async getContacts(params?: {
    tags?: string;
    term?: string;
    phone?: string;
  }): Promise<Contact[]> {
    const queryParams: Record<string, string | number> = {};
    if (params?.tags) queryParams.tags = params.tags;
    if (params?.term) queryParams.term = params.term;
    if (params?.phone) queryParams.phone = params.phone;
    return this.fetchAllPages<Contact>('/contacts/people', queryParams);
  }

  /**
   * Retrieves a single contact by ID
   * @param contactId - Contact ID
   * @returns Promise with contact
   */
  async getContact(contactId: number): Promise<Contact> {
    return this.makeRequest<Contact>(`/contacts/people/${contactId}`);
  }

  /**
   * Creates a new contact
   * @param params - Contact creation parameters
   * @returns Promise with created contact
   */
  async createContact(params: {
    lastname: string;
    gender: 'F' | 'M' | 'U';
    firstname?: string;
    company_id?: number;
    user_id?: number;
    title?: string;
    job_position?: string;
    mobile_phone?: string;
    work_phone?: string;
    work_fax?: string;
    work_email?: string;
    home_email?: string;
    work_address?: string;
    home_address?: string;
    birthday?: string;
    info?: string;
    tags?: string[];
  }): Promise<Contact> {
    return this.makePostRequest<Contact>('/contacts/people', params);
  }

  /**
   * Updates an existing contact
   * @param contactId - ID of the contact to update
   * @param params - Fields to update
   * @returns Promise with updated contact
   */
  async updateContact(contactId: number, params: {
    lastname?: string;
    gender?: 'F' | 'M' | 'U';
    firstname?: string;
    company_id?: number;
    user_id?: number;
    title?: string;
    job_position?: string;
    mobile_phone?: string;
    work_phone?: string;
    work_fax?: string;
    work_email?: string;
    home_email?: string;
    work_address?: string;
    home_address?: string;
    birthday?: string;
    info?: string;
    tags?: string[];
  }): Promise<Contact> {
    return this.makePutRequest<Contact>(`/contacts/people/${contactId}`, params);
  }

  /**
   * Deletes a contact
   * @param contactId - ID of the contact to delete
   */
  async deleteContact(contactId: number): Promise<void> {
    return this.makeDeleteRequest(`/contacts/people/${contactId}`);
  }

  // ============================================
  // INVOICES - CRUD Operations
  // ============================================

  /**
   * Retrieves all invoices with optional filtering
   * @param params - Filter parameters
   * @returns Promise with array of invoices
   */
  async getInvoices(params?: {
    status?: string;
    date_from?: string;
    date_to?: string;
    company_id?: number;
    project_id?: number;
    identifier?: string;
    term?: string;
    tags?: string;
  }): Promise<Invoice[]> {
    const queryParams: Record<string, string | number> = {};
    if (params?.status) queryParams.status = params.status;
    if (params?.date_from) queryParams.date_from = params.date_from;
    if (params?.date_to) queryParams.date_to = params.date_to;
    if (params?.company_id) queryParams.company_id = params.company_id;
    if (params?.project_id) queryParams.project_id = params.project_id;
    if (params?.identifier) queryParams.identifier = params.identifier;
    if (params?.term) queryParams.term = params.term;
    if (params?.tags) queryParams.tags = params.tags;
    return this.fetchAllPages<Invoice>('/invoices', queryParams);
  }

  /**
   * Retrieves a single invoice by ID
   * @param invoiceId - Invoice ID
   * @returns Promise with invoice including items, payments, and reminders
   */
  async getInvoice(invoiceId: number): Promise<Invoice> {
    return this.makeRequest<Invoice>(`/invoices/${invoiceId}`);
  }

  /**
   * Creates a new invoice
   * @param params - Invoice creation parameters
   * @returns Promise with created invoice
   */
  async createInvoice(params: {
    customer_id: number;
    recipient_address: string;
    date: string;
    due_date: string;
    title: string;
    tax: number;
    currency: string;
    items: InvoiceItem[];
    project_id?: number;
    status?: 'created' | 'draft';
    salutation?: string;
    footer?: string;
    discount?: number;
    cash_discount?: number;
    cash_discount_days?: number;
    service_period_from?: string;
    service_period_to?: string;
    tags?: string[];
    custom_properties?: Record<string, string>;
  }): Promise<Invoice> {
    return this.makePostRequest<Invoice>('/invoices', params);
  }

  /**
   * Updates invoice status
   * @param invoiceId - ID of the invoice to update
   * @param status - New status
   * @returns Promise with updated invoice
   */
  async updateInvoiceStatus(invoiceId: number, status: 'created' | 'sent' | 'overdue' | 'ignored'): Promise<Invoice> {
    return this.makePutRequest<Invoice>(`/invoices/${invoiceId}/update_status`, { status });
  }

  /**
   * Sends an invoice via email
   * @param invoiceId - ID of the invoice to send
   * @param params - Email parameters
   * @returns Promise with result
   */
  async sendInvoiceEmail(invoiceId: number, params: {
    subject: string;
    text: string;
    emails_to?: string;
    emails_cc?: string;
    emails_bcc?: string;
  }): Promise<void> {
    await this.makePostRequest<unknown>(`/invoices/${invoiceId}/send_email`, params);
  }

  /**
   * Deletes an invoice
   * @param invoiceId - ID of the invoice to delete
   * @param reason - Reason for deletion (required for non-draft invoices)
   */
  async deleteInvoice(invoiceId: number, reason?: string): Promise<void> {
    if (reason) {
      const url = new URL(`${this.config.baseUrl}/invoices/${invoiceId}`);
      url.searchParams.append('reason', reason);
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: this.defaultHeaders
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
    } else {
      return this.makeDeleteRequest(`/invoices/${invoiceId}`);
    }
  }

}