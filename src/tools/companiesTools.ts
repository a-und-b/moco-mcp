/**
 * MCP tools for Companies management
 * Provides CRUD operations for customers, suppliers, and organizations
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MocoApiService } from '../services/mocoApi.js';
import { createEmptyResultMessage } from '../utils/errorHandler.js';
import type { Company } from '../types/mocoTypes.js';

// Company type enum
const CompanyTypeEnum = z.enum(['customer', 'supplier', 'organization']);

// Schema for get_companies tool
const GetCompaniesSchema = z.object({
  type: CompanyTypeEnum.optional().describe('Filter by company type: customer, supplier, or organization'),
  tags: z.string().optional().describe('Filter by tags (comma-separated, e.g., "Automotive, Pharma")'),
  identifier: z.string().optional().describe('Filter by company identifier/code'),
  term: z.string().optional().describe('Search term for company name/details')
});

// Schema for get_company tool
const GetCompanySchema = z.object({
  companyId: z.number().positive().describe('ID of the company to retrieve')
});

// Schema for create_company tool
const CreateCompanySchema = z.object({
  name: z.string().describe('Company name'),
  type: CompanyTypeEnum.describe('Company type: customer, supplier, or organization'),
  currency: z.string().optional().describe('ISO currency code (e.g., "EUR", "CHF") - required for customers'),
  countryCode: z.string().optional().describe('Country code (e.g., "DE", "CH")'),
  vatIdentifier: z.string().optional().describe('VAT identifier'),
  website: z.string().url().optional().describe('Company website URL'),
  phone: z.string().optional().describe('Phone number'),
  fax: z.string().optional().describe('Fax number'),
  email: z.string().email().optional().describe('Email address'),
  billingEmailCc: z.string().email().optional().describe('Billing email CC'),
  billingNotes: z.string().optional().describe('Billing notes'),
  address: z.string().optional().describe('Company address'),
  info: z.string().optional().describe('Additional information'),
  tags: z.array(z.string()).optional().describe('Tags for the company'),
  userId: z.number().positive().optional().describe('Responsible user ID'),
  identifier: z.string().optional().describe('Company identifier/code'),
  defaultInvoiceDueDays: z.number().int().positive().optional().describe('Default invoice due days')
});

// Schema for update_company tool
const UpdateCompanySchema = z.object({
  companyId: z.number().positive().describe('ID of the company to update'),
  name: z.string().optional().describe('Company name'),
  type: CompanyTypeEnum.optional().describe('Company type'),
  countryCode: z.string().optional().describe('Country code'),
  vatIdentifier: z.string().optional().describe('VAT identifier'),
  website: z.string().url().optional().describe('Company website URL'),
  phone: z.string().optional().describe('Phone number'),
  fax: z.string().optional().describe('Fax number'),
  email: z.string().email().optional().describe('Email address'),
  billingEmailCc: z.string().email().optional().describe('Billing email CC'),
  billingNotes: z.string().optional().describe('Billing notes'),
  address: z.string().optional().describe('Company address'),
  info: z.string().optional().describe('Additional information'),
  tags: z.array(z.string()).optional().describe('Tags for the company'),
  userId: z.number().positive().optional().describe('Responsible user ID'),
  identifier: z.string().optional().describe('Company identifier/code'),
  defaultInvoiceDueDays: z.number().int().positive().optional().describe('Default invoice due days')
});

// Schema for delete_company tool
const DeleteCompanySchema = z.object({
  companyId: z.number().positive().describe('ID of the company to delete')
});

/**
 * Formats a company into a readable string
 */
function formatCompany(company: Company): string {
  const lines: string[] = [];
  lines.push(`Company ID: ${company.id}`);
  lines.push(`Name: ${company.name}`);
  lines.push(`Type: ${company.type}`);
  if (company.identifier) lines.push(`Identifier: ${company.identifier}`);
  if (company.email) lines.push(`Email: ${company.email}`);
  if (company.phone) lines.push(`Phone: ${company.phone}`);
  if (company.website) lines.push(`Website: ${company.website}`);
  if (company.address) lines.push(`Address: ${company.address}`);
  if (company.country_code) lines.push(`Country: ${company.country_code}`);
  if (company.currency) lines.push(`Currency: ${company.currency}`);
  if (company.tags && company.tags.length > 0) lines.push(`Tags: ${company.tags.join(', ')}`);
  if (company.user) lines.push(`Responsible: ${company.user.firstname} ${company.user.lastname}`);
  return lines.join('\n');
}

/**
 * Formats a list of companies
 */
function formatCompanyList(companies: Company[]): string {
  const lines: string[] = [];
  lines.push(`Companies (${companies.length} found):\n`);

  companies.forEach(company => {
    lines.push(`ID: ${company.id}`);
    lines.push(`Name: ${company.name}`);
    lines.push(`Type: ${company.type}`);
    if (company.email) lines.push(`Email: ${company.email}`);
    if (company.phone) lines.push(`Phone: ${company.phone}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Tool: get_companies
 * Retrieves all companies with optional filtering
 */
export const getCompaniesTool = {
  name: 'get_companies',
  description: 'Get all companies (customers, suppliers, organizations) with optional filtering by type, tags, identifier, or search term.',
  inputSchema: zodToJsonSchema(GetCompaniesSchema),
  handler: async (params: z.infer<typeof GetCompaniesSchema>): Promise<string> => {
    const { type, tags, identifier, term } = params;

    try {
      const apiService = new MocoApiService();
      const companies = await apiService.getCompanies({ type, tags, identifier, term });

      if (companies.length === 0) {
        return createEmptyResultMessage({ type: 'companies' });
      }

      return formatCompanyList(companies);

    } catch (error) {
      return `Error retrieving companies: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: get_company
 * Retrieves a single company by ID
 */
export const getCompanyTool = {
  name: 'get_company',
  description: 'Get a single company by ID with full details.',
  inputSchema: zodToJsonSchema(GetCompanySchema),
  handler: async (params: z.infer<typeof GetCompanySchema>): Promise<string> => {
    const { companyId } = params;

    try {
      const apiService = new MocoApiService();
      const company = await apiService.getCompany(companyId);

      return formatCompany(company);

    } catch (error) {
      return `Error retrieving company ${companyId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: create_company
 * Creates a new company
 */
export const createCompanyTool = {
  name: 'create_company',
  description: 'Create a new company (customer, supplier, or organization). Currency is required for customers.',
  inputSchema: zodToJsonSchema(CreateCompanySchema),
  handler: async (params: z.infer<typeof CreateCompanySchema>): Promise<string> => {
    const {
      name, type, currency, countryCode, vatIdentifier, website, phone, fax,
      email, billingEmailCc, billingNotes, address, info, tags, userId,
      identifier, defaultInvoiceDueDays
    } = params;

    // Build API parameters
    const apiParams: Record<string, unknown> = { name, type };

    if (currency !== undefined) apiParams.currency = currency;
    if (countryCode !== undefined) apiParams.country_code = countryCode;
    if (vatIdentifier !== undefined) apiParams.vat_identifier = vatIdentifier;
    if (website !== undefined) apiParams.website = website;
    if (phone !== undefined) apiParams.phone = phone;
    if (fax !== undefined) apiParams.fax = fax;
    if (email !== undefined) apiParams.email = email;
    if (billingEmailCc !== undefined) apiParams.billing_email_cc = billingEmailCc;
    if (billingNotes !== undefined) apiParams.billing_notes = billingNotes;
    if (address !== undefined) apiParams.address = address;
    if (info !== undefined) apiParams.info = info;
    if (tags !== undefined) apiParams.tags = tags;
    if (userId !== undefined) apiParams.user_id = userId;
    if (identifier !== undefined) apiParams.identifier = identifier;
    if (defaultInvoiceDueDays !== undefined) apiParams.default_invoice_due_days = defaultInvoiceDueDays;

    try {
      const apiService = new MocoApiService();
      const company = await apiService.createCompany(apiParams as any);

      return `Company created successfully!\n\n${formatCompany(company)}`;

    } catch (error) {
      return `Error creating company: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: update_company
 * Updates an existing company
 */
export const updateCompanyTool = {
  name: 'update_company',
  description: 'Update an existing company. Only provide the fields you want to change.',
  inputSchema: zodToJsonSchema(UpdateCompanySchema),
  handler: async (params: z.infer<typeof UpdateCompanySchema>): Promise<string> => {
    const {
      companyId, name, type, countryCode, vatIdentifier, website, phone, fax,
      email, billingEmailCc, billingNotes, address, info, tags, userId,
      identifier, defaultInvoiceDueDays
    } = params;

    // Build API parameters (only include provided fields)
    const apiParams: Record<string, unknown> = {};

    if (name !== undefined) apiParams.name = name;
    if (type !== undefined) apiParams.type = type;
    if (countryCode !== undefined) apiParams.country_code = countryCode;
    if (vatIdentifier !== undefined) apiParams.vat_identifier = vatIdentifier;
    if (website !== undefined) apiParams.website = website;
    if (phone !== undefined) apiParams.phone = phone;
    if (fax !== undefined) apiParams.fax = fax;
    if (email !== undefined) apiParams.email = email;
    if (billingEmailCc !== undefined) apiParams.billing_email_cc = billingEmailCc;
    if (billingNotes !== undefined) apiParams.billing_notes = billingNotes;
    if (address !== undefined) apiParams.address = address;
    if (info !== undefined) apiParams.info = info;
    if (tags !== undefined) apiParams.tags = tags;
    if (userId !== undefined) apiParams.user_id = userId;
    if (identifier !== undefined) apiParams.identifier = identifier;
    if (defaultInvoiceDueDays !== undefined) apiParams.default_invoice_due_days = defaultInvoiceDueDays;

    if (Object.keys(apiParams).length === 0) {
      return 'No fields provided to update. Please specify at least one field to change.';
    }

    try {
      const apiService = new MocoApiService();
      const company = await apiService.updateCompany(companyId, apiParams as any);

      return `Company updated successfully!\n\n${formatCompany(company)}`;

    } catch (error) {
      return `Error updating company ${companyId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: delete_company
 * Deletes a company
 */
export const deleteCompanyTool = {
  name: 'delete_company',
  description: 'Delete a company permanently.',
  inputSchema: zodToJsonSchema(DeleteCompanySchema),
  handler: async (params: z.infer<typeof DeleteCompanySchema>): Promise<string> => {
    const { companyId } = params;

    try {
      const apiService = new MocoApiService();
      await apiService.deleteCompany(companyId);

      return `Company ${companyId} deleted successfully.`;

    } catch (error) {
      return `Error deleting company ${companyId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};
