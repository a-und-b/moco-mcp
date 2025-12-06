/**
 * MCP tools for Invoices management
 * Provides CRUD operations for invoices
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MocoApiService } from '../services/mocoApi.js';
import { isValidDateFormat } from '../utils/dateUtils.js';
import { createEmptyResultMessage, createValidationErrorMessage } from '../utils/errorHandler.js';
import type { Invoice, InvoiceItem } from '../types/mocoTypes.js';

// Invoice status enum
const InvoiceStatusEnum = z.enum(['draft', 'created', 'sent', 'partially_paid', 'paid', 'overdue', 'ignored']);
const InvoiceUpdateStatusEnum = z.enum(['created', 'sent', 'overdue', 'ignored']);

// Invoice item type enum
const InvoiceItemTypeEnum = z.enum(['title', 'description', 'item', 'subtotal', 'page-break', 'separator']);

// Schema for invoice item
const InvoiceItemSchema = z.object({
  type: InvoiceItemTypeEnum.describe('Item type: title, description, item, subtotal, page-break, or separator'),
  title: z.string().optional().describe('Item title'),
  description: z.string().optional().describe('Item description'),
  quantity: z.number().optional().describe('Quantity (for type "item")'),
  unit: z.string().optional().describe('Unit (e.g., "hours", "pieces")'),
  unitPrice: z.number().optional().describe('Unit price'),
  netTotal: z.number().optional().describe('Net total (calculated if not provided)'),
  optional: z.boolean().optional().describe('Whether the item is optional')
});

// Schema for get_invoices tool
const GetInvoicesSchema = z.object({
  status: z.string().optional().describe('Filter by status (comma-separated: draft, created, sent, partially_paid, paid, overdue, ignored)'),
  dateFrom: z.string().optional().describe('Filter by invoice date from (YYYY-MM-DD)'),
  dateTo: z.string().optional().describe('Filter by invoice date to (YYYY-MM-DD)'),
  companyId: z.number().positive().optional().describe('Filter by company ID'),
  projectId: z.number().positive().optional().describe('Filter by project ID'),
  identifier: z.string().optional().describe('Filter by invoice number'),
  term: z.string().optional().describe('Search term for title or identifier'),
  tags: z.string().optional().describe('Filter by tags (comma-separated)')
});

// Schema for get_invoice tool
const GetInvoiceSchema = z.object({
  invoiceId: z.number().positive().describe('ID of the invoice to retrieve')
});

// Schema for create_invoice tool
const CreateInvoiceSchema = z.object({
  customerId: z.number().positive().describe('Customer company ID'),
  recipientAddress: z.string().describe('Recipient address'),
  date: z.string().describe('Invoice date (YYYY-MM-DD)'),
  dueDate: z.string().describe('Due date (YYYY-MM-DD)'),
  title: z.string().describe('Invoice title/description'),
  tax: z.number().describe('Tax percentage (e.g., 19 for 19%)'),
  currency: z.string().describe('Currency code (e.g., "EUR")'),
  items: z.array(InvoiceItemSchema).describe('Invoice line items'),
  projectId: z.number().positive().optional().describe('Associated project ID'),
  status: z.enum(['created', 'draft']).optional().describe('Invoice status (default: created)'),
  salutation: z.string().optional().describe('Salutation text'),
  footer: z.string().optional().describe('Footer text'),
  discount: z.number().optional().describe('Discount percentage'),
  cashDiscount: z.number().optional().describe('Cash discount percentage'),
  cashDiscountDays: z.number().int().positive().optional().describe('Days for cash discount'),
  servicePeriodFrom: z.string().optional().describe('Service period start (YYYY-MM-DD)'),
  servicePeriodTo: z.string().optional().describe('Service period end (YYYY-MM-DD)'),
  tags: z.array(z.string()).optional().describe('Tags for the invoice')
});

// Schema for update_invoice_status tool
const UpdateInvoiceStatusSchema = z.object({
  invoiceId: z.number().positive().describe('ID of the invoice to update'),
  status: InvoiceUpdateStatusEnum.describe('New status: created, sent, overdue, or ignored')
});

// Schema for send_invoice_email tool
const SendInvoiceEmailSchema = z.object({
  invoiceId: z.number().positive().describe('ID of the invoice to send'),
  subject: z.string().describe('Email subject'),
  text: z.string().describe('Email body text'),
  emailsTo: z.string().optional().describe('Recipient email addresses (semicolon-separated)'),
  emailsCc: z.string().optional().describe('CC email addresses (semicolon-separated)'),
  emailsBcc: z.string().optional().describe('BCC email addresses (semicolon-separated)')
});

// Schema for delete_invoice tool
const DeleteInvoiceSchema = z.object({
  invoiceId: z.number().positive().describe('ID of the invoice to delete'),
  reason: z.string().optional().describe('Reason for deletion (required for non-draft invoices)')
});

/**
 * Formats an invoice into a readable string
 */
function formatInvoice(invoice: Invoice): string {
  const lines: string[] = [];
  lines.push(`Invoice ID: ${invoice.id}`);
  lines.push(`Identifier: ${invoice.identifier}`);
  lines.push(`Title: ${invoice.title}`);
  lines.push(`Status: ${invoice.status}`);
  lines.push(`Date: ${invoice.date}`);
  lines.push(`Due Date: ${invoice.due_date}`);
  if (invoice.company) lines.push(`Customer: ${invoice.company.name} (ID: ${invoice.company.id})`);
  if (invoice.project) lines.push(`Project: ${invoice.project.name} (ID: ${invoice.project.id})`);
  lines.push(`Net Total: ${invoice.net_total} ${invoice.currency}`);
  lines.push(`Tax: ${invoice.tax}%`);
  lines.push(`Gross Total: ${invoice.gross_total} ${invoice.currency}`);
  if (invoice.discount) lines.push(`Discount: ${invoice.discount}%`);
  if (invoice.service_period_from && invoice.service_period_to) {
    lines.push(`Service Period: ${invoice.service_period_from} to ${invoice.service_period_to}`);
  }
  if (invoice.tags && invoice.tags.length > 0) lines.push(`Tags: ${invoice.tags.join(', ')}`);
  if (invoice.payments && invoice.payments.length > 0) {
    lines.push(`Payments: ${invoice.payments.length} payment(s)`);
  }
  return lines.join('\n');
}

/**
 * Formats a list of invoices
 */
function formatInvoiceList(invoices: Invoice[]): string {
  const lines: string[] = [];
  lines.push(`Invoices (${invoices.length} found):\n`);

  invoices.forEach(invoice => {
    lines.push(`ID: ${invoice.id}`);
    lines.push(`Identifier: ${invoice.identifier}`);
    lines.push(`Title: ${invoice.title}`);
    lines.push(`Status: ${invoice.status}`);
    lines.push(`Date: ${invoice.date}`);
    lines.push(`Gross Total: ${invoice.gross_total} ${invoice.currency}`);
    if (invoice.company) lines.push(`Customer: ${invoice.company.name}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Converts tool item format to API format
 */
function convertItemToApiFormat(item: z.infer<typeof InvoiceItemSchema>): InvoiceItem {
  const apiItem: InvoiceItem = { type: item.type };
  if (item.title !== undefined) apiItem.title = item.title;
  if (item.description !== undefined) apiItem.description = item.description;
  if (item.quantity !== undefined) apiItem.quantity = item.quantity;
  if (item.unit !== undefined) apiItem.unit = item.unit;
  if (item.unitPrice !== undefined) apiItem.unit_price = item.unitPrice;
  if (item.netTotal !== undefined) apiItem.net_total = item.netTotal;
  if (item.optional !== undefined) apiItem.optional = item.optional;
  return apiItem;
}

/**
 * Tool: get_invoices
 * Retrieves all invoices with optional filtering
 */
export const getInvoicesTool = {
  name: 'get_invoices',
  description: 'Get all invoices with optional filtering by status, date range, company, project, or search term.',
  inputSchema: zodToJsonSchema(GetInvoicesSchema),
  handler: async (params: z.infer<typeof GetInvoicesSchema>): Promise<string> => {
    const { status, dateFrom, dateTo, companyId, projectId, identifier, term, tags } = params;

    // Validate date formats if provided
    if (dateFrom !== undefined && !isValidDateFormat(dateFrom)) {
      return createValidationErrorMessage({ field: 'dateFrom', value: dateFrom, reason: 'invalid_date_format' });
    }
    if (dateTo !== undefined && !isValidDateFormat(dateTo)) {
      return createValidationErrorMessage({ field: 'dateTo', value: dateTo, reason: 'invalid_date_format' });
    }

    try {
      const apiService = new MocoApiService();
      const invoices = await apiService.getInvoices({
        status,
        date_from: dateFrom,
        date_to: dateTo,
        company_id: companyId,
        project_id: projectId,
        identifier,
        term,
        tags
      });

      if (invoices.length === 0) {
        return createEmptyResultMessage({ type: 'invoices' });
      }

      return formatInvoiceList(invoices);

    } catch (error) {
      return `Error retrieving invoices: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: get_invoice
 * Retrieves a single invoice by ID
 */
export const getInvoiceTool = {
  name: 'get_invoice',
  description: 'Get a single invoice by ID with full details including items, payments, and reminders.',
  inputSchema: zodToJsonSchema(GetInvoiceSchema),
  handler: async (params: z.infer<typeof GetInvoiceSchema>): Promise<string> => {
    const { invoiceId } = params;

    try {
      const apiService = new MocoApiService();
      const invoice = await apiService.getInvoice(invoiceId);

      return formatInvoice(invoice);

    } catch (error) {
      return `Error retrieving invoice ${invoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: create_invoice
 * Creates a new invoice
 */
export const createInvoiceTool = {
  name: 'create_invoice',
  description: 'Create a new invoice. Requires customer ID, recipient address, dates, title, tax, currency, and items.',
  inputSchema: zodToJsonSchema(CreateInvoiceSchema),
  handler: async (params: z.infer<typeof CreateInvoiceSchema>): Promise<string> => {
    const {
      customerId, recipientAddress, date, dueDate, title, tax, currency, items,
      projectId, status, salutation, footer, discount, cashDiscount, cashDiscountDays,
      servicePeriodFrom, servicePeriodTo, tags
    } = params;

    // Validate date formats
    if (!isValidDateFormat(date)) {
      return createValidationErrorMessage({ field: 'date', value: date, reason: 'invalid_date_format' });
    }
    if (!isValidDateFormat(dueDate)) {
      return createValidationErrorMessage({ field: 'dueDate', value: dueDate, reason: 'invalid_date_format' });
    }
    if (servicePeriodFrom !== undefined && !isValidDateFormat(servicePeriodFrom)) {
      return createValidationErrorMessage({ field: 'servicePeriodFrom', value: servicePeriodFrom, reason: 'invalid_date_format' });
    }
    if (servicePeriodTo !== undefined && !isValidDateFormat(servicePeriodTo)) {
      return createValidationErrorMessage({ field: 'servicePeriodTo', value: servicePeriodTo, reason: 'invalid_date_format' });
    }

    // Convert items to API format
    const apiItems = items.map(convertItemToApiFormat);

    // Build API parameters
    const apiParams: Record<string, unknown> = {
      customer_id: customerId,
      recipient_address: recipientAddress,
      date,
      due_date: dueDate,
      title,
      tax,
      currency,
      items: apiItems
    };

    if (projectId !== undefined) apiParams.project_id = projectId;
    if (status !== undefined) apiParams.status = status;
    if (salutation !== undefined) apiParams.salutation = salutation;
    if (footer !== undefined) apiParams.footer = footer;
    if (discount !== undefined) apiParams.discount = discount;
    if (cashDiscount !== undefined) apiParams.cash_discount = cashDiscount;
    if (cashDiscountDays !== undefined) apiParams.cash_discount_days = cashDiscountDays;
    if (servicePeriodFrom !== undefined) apiParams.service_period_from = servicePeriodFrom;
    if (servicePeriodTo !== undefined) apiParams.service_period_to = servicePeriodTo;
    if (tags !== undefined) apiParams.tags = tags;

    try {
      const apiService = new MocoApiService();
      const invoice = await apiService.createInvoice(apiParams as any);

      return `Invoice created successfully!\n\n${formatInvoice(invoice)}`;

    } catch (error) {
      return `Error creating invoice: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: update_invoice_status
 * Updates the status of an invoice
 */
export const updateInvoiceStatusTool = {
  name: 'update_invoice_status',
  description: 'Update the status of an invoice. Status changes automatically upon payment creation.',
  inputSchema: zodToJsonSchema(UpdateInvoiceStatusSchema),
  handler: async (params: z.infer<typeof UpdateInvoiceStatusSchema>): Promise<string> => {
    const { invoiceId, status } = params;

    try {
      const apiService = new MocoApiService();
      const invoice = await apiService.updateInvoiceStatus(invoiceId, status);

      return `Invoice status updated successfully!\n\n${formatInvoice(invoice)}`;

    } catch (error) {
      return `Error updating invoice ${invoiceId} status: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: send_invoice_email
 * Sends an invoice via email
 */
export const sendInvoiceEmailTool = {
  name: 'send_invoice_email',
  description: 'Send an invoice via email. Subject and text are required. Leave email addresses empty to use default customer/contact recipients.',
  inputSchema: zodToJsonSchema(SendInvoiceEmailSchema),
  handler: async (params: z.infer<typeof SendInvoiceEmailSchema>): Promise<string> => {
    const { invoiceId, subject, text, emailsTo, emailsCc, emailsBcc } = params;

    try {
      const apiService = new MocoApiService();
      await apiService.sendInvoiceEmail(invoiceId, {
        subject,
        text,
        emails_to: emailsTo,
        emails_cc: emailsCc,
        emails_bcc: emailsBcc
      });

      return `Invoice ${invoiceId} sent via email successfully!`;

    } catch (error) {
      return `Error sending invoice ${invoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: delete_invoice
 * Deletes an invoice
 */
export const deleteInvoiceTool = {
  name: 'delete_invoice',
  description: 'Delete an invoice. Reason is required for non-draft invoices.',
  inputSchema: zodToJsonSchema(DeleteInvoiceSchema),
  handler: async (params: z.infer<typeof DeleteInvoiceSchema>): Promise<string> => {
    const { invoiceId, reason } = params;

    try {
      const apiService = new MocoApiService();
      await apiService.deleteInvoice(invoiceId, reason);

      return `Invoice ${invoiceId} deleted successfully.`;

    } catch (error) {
      return `Error deleting invoice ${invoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};
