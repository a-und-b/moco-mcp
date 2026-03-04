/**
 * Type definitions for MoCo API data structures
 * Based on MoCo API v1 documentation
 */

// Raw API response types - mirror the exact API structure

/**
 * Activity record from MoCo API
 * Represents time tracking entries
 */
export interface Activity {
  id: number;
  date: string; // ISO 8601 format (YYYY-MM-DD)
  hours: number; // Decimal hours (e.g., 2.5 for 2:30)
  description: string;
  project: {
    id: number;
    name: string;
  };
  task: {
    id: number;
    name: string;
  };
  user: {
    id: number;
    firstname: string;
    lastname: string;
  };
  billable: boolean;
  locked: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Project record from MoCo API
 */
export interface Project {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  currency: string;
  budget?: number;
  budget_monthly?: number;
  created_at: string;
  updated_at: string;
  customer?: {
    id: number;
    name: string;
  };
  leader?: {
    id: number;
    firstname: string;
    lastname: string;
  };
  tasks: {
    id: number;
    name: string;
    active: boolean;
    billable: boolean;
  }[];
}

/**
 * Task record from MoCo API
 */
export interface Task {
  id: number;
  name: string;
  active: boolean;
  billable: boolean;
  project: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * User Holiday record from MoCo API
 */
export interface UserHoliday {
  id: number;
  date: string; // ISO 8601 format (YYYY-MM-DD)
  hours: number; // Hours as decimal (8.0 for full day, 4.0 for half day)
  status: 'approved' | 'pending' | 'rejected';
  note?: string;
  user: {
    id: number;
    firstname: string;
    lastname: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * User Presence record from MoCo API
 */
export interface UserPresence {
  id: number;
  date: string; // ISO 8601 format (YYYY-MM-DD)
  from: string; // Time format HH:MM
  to?: string; // Time format HH:MM, null if still active
  hours?: number; // Calculated hours, only present if 'to' is set
  user: {
    id: number;
    firstname: string;
    lastname: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * User information including holiday entitlement
 */
export interface User {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  active: boolean;
  holiday_entitlement?: number; // Annual holiday entitlement in hours
  created_at: string;
  updated_at: string;
}

/**
 * Staff user from MoCo API (GET /users)
 * Full user record with unit, role, and additional fields
 */
export interface StaffUser {
  id: number;
  firstname: string;
  lastname: string;
  active: boolean;
  extern: boolean;
  email: string;
  mobile_phone?: string;
  work_phone?: string;
  unit?: { id: number; name: string };
  role?: { id: number; name: string };
  tags?: string[];
  avatar_url?: string;
  custom_properties?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// Aggregated data structures for processed responses

/**
 * Time formatting helper - provides both decimal and HH:MM formats
 */
export interface TimeFormat {
  /** Hours as decimal number (e.g., 2.5) */
  hours: number;
  /** Hours in HH:MM format (e.g., "2:30") */
  hoursFormatted: string;
}

/**
 * Activity summary for a single task within a project
 */
export interface TaskActivitySummary {
  taskId: number;
  taskName: string;
  hours: number;
  hoursFormatted: string;
}

/**
 * Activity summary for a single project on a specific day
 */
export interface ProjectActivitySummary {
  projectId: number;
  projectName: string;
  tasks: TaskActivitySummary[];
  projectTotal: TimeFormat;
}

/**
 * Activity summary for a single day
 */
export interface DailyActivitySummary {
  date: string; // ISO 8601 format
  projects: ProjectActivitySummary[];
  dailyTotal: TimeFormat;
}

/**
 * Complete activity summary for a date range
 */
export interface ActivityRangeSummary {
  startDate: string;
  endDate: string;
  dailySummaries: DailyActivitySummary[];
  projectTotals: Array<{
    projectId: number;
    projectName: string;
    total: TimeFormat;
    tasks: Array<{
      taskId: number;
      taskName: string;
      total: TimeFormat;
    }>;
  }>;
  grandTotal: TimeFormat;
}

/**
 * Daily presence summary (aggregated from multiple presence records)
 */
export interface DailyPresenceSummary {
  date: string; // ISO 8601 format
  totalHours: number;
  totalHoursFormatted: string;
}

/**
 * Complete presence summary for a date range
 */
export interface PresenceRangeSummary {
  startDate: string;
  endDate: string;
  dailySummaries: DailyPresenceSummary[];
  grandTotal: TimeFormat;
}

/**
 * Holiday summary for a single year
 */
export interface HolidaySummary {
  year: number;
  holidays: Array<{
    date: string;
    days: number; // Convert hours to days (assuming 8h = 1 day)
    status: string;
    note?: string;
  }>;
  totalTakenDays: number;
  annualEntitlementDays: number;
  utilizationPercentage: number;
  remainingDays: number;
}

/**
 * API pagination metadata
 */
export interface PaginationMeta {
  total: number;
  count: number;
  per_page: number;
  current_page: number;
  total_pages: number;
}

/**
 * Generic paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Company record from MoCo API
 */
export interface Company {
  id: number;
  name: string;
  type: 'customer' | 'supplier' | 'organization';
  website?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: string;
  info?: string;
  country_code?: string;
  vat_identifier?: string;
  currency?: string;
  identifier?: string;
  billing_email_cc?: string;
  billing_notes?: string;
  footer?: string;
  tags?: string[];
  custom_properties?: Record<string, string>;
  user?: {
    id: number;
    firstname: string;
    lastname: string;
  };
  debit_number?: string;
  credit_number?: string;
  iban?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Contact record from MoCo API
 */
export interface Contact {
  id: number;
  firstname?: string;
  lastname: string;
  gender: 'F' | 'M' | 'U';
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
  company?: {
    id: number;
    name: string;
  };
  user?: {
    id: number;
    firstname: string;
    lastname: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Invoice item for creating invoices
 */
export interface InvoiceItem {
  type: 'title' | 'description' | 'item' | 'subtotal' | 'page-break' | 'separator';
  title?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  net_total?: number;
  optional?: boolean;
  service_type?: 'service' | 'expense';
}

/**
 * Invoice record from MoCo API
 */
export interface Invoice {
  id: number;
  identifier: string;
  date: string;
  due_date: string;
  title: string;
  recipient_address: string;
  currency: string;
  net_total: number;
  tax: number;
  gross_total: number;
  status: 'draft' | 'created' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'ignored';
  discount?: number;
  cash_discount?: number;
  cash_discount_days?: number;
  service_period_from?: string;
  service_period_to?: string;
  salutation?: string;
  footer?: string;
  tags?: string[];
  custom_properties?: Record<string, string>;
  company?: {
    id: number;
    name: string;
  };
  project?: {
    id: number;
    name: string;
  };
  items?: InvoiceItem[];
  payments?: {
    id: number;
    date: string;
    amount: number;
    description?: string;
  }[];
  created_at: string;
  updated_at: string;
}