/**
 * MCP tools for Offers management
 * Provides CRUD operations for offers
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MocoApiService } from '../services/mocoApi.js';
import { isValidDateFormat } from '../utils/dateUtils.js';
import { createEmptyResultMessage, createValidationErrorMessage } from '../utils/errorHandler.js';
import type { Offer, OfferItem } from '../types/mocoTypes.js';

// Offer item type enum
const OfferItemTypeEnum = z.enum(['title', 'description', 'item', 'subtotal', 'page-break', 'separator']);

// Schema for offer item
const OfferItemSchema = z.object({
  type: OfferItemTypeEnum.describe('Item type: title, description, item, subtotal, page-break, or separator'),
  title: z.string().optional().describe('Item title'),
  description: z.string().optional().describe('Item description'),
  quantity: z.number().optional().describe('Quantity (for type "item")'),
  unit: z.string().optional().describe('Unit (e.g., "hours", "pieces")'),
  unitPrice: z.number().optional().describe('Unit price'),
  netTotal: z.number().optional().describe('Net total'),
  optional: z.boolean().optional().describe('Whether the item is optional')
});

// Schema for get_offers tool
const GetOffersSchema = z.object({
  status: z.string().optional().describe('Filter by status (comma-separated: created, sent, accepted, rejected, expired)'),
  dateFrom: z.string().optional().describe('Filter by offer date from (YYYY-MM-DD)'),
  dateTo: z.string().optional().describe('Filter by offer date to (YYYY-MM-DD)'),
  companyId: z.number().positive().optional().describe('Filter by company ID'),
  projectId: z.number().positive().optional().describe('Filter by project ID'),
  identifier: z.string().optional().describe('Filter by offer number'),
  term: z.string().optional().describe('Search term for title or identifier'),
  tags: z.string().optional().describe('Filter by tags (comma-separated)')
});

// Schema for get_offer tool
const GetOfferSchema = z.object({
  offerId: z.number().positive().describe('ID of the offer to retrieve')
});

// Schema for create_offer tool
const CreateOfferSchema = z.object({
  customerId: z.number().positive().describe('Customer company ID'),
  recipientAddress: z.string().describe('Recipient address'),
  date: z.string().describe('Offer date (YYYY-MM-DD)'),
  title: z.string().describe('Offer title'),
  tax: z.number().describe('Tax percentage (e.g., 19 for 19%)'),
  currency: z.string().describe('Currency code (e.g., "EUR")'),
  items: z.array(OfferItemSchema).describe('Offer line items'),
  projectId: z.number().positive().optional().describe('Associated project ID'),
  dueDate: z.string().optional().describe('Valid until / due date (YYYY-MM-DD)'),
  salutation: z.string().optional().describe('Salutation text'),
  footer: z.string().optional().describe('Footer text'),
  discount: z.number().optional().describe('Discount percentage'),
  tags: z.array(z.string()).optional().describe('Tags for the offer')
});

// Schema for update_offer_status tool
const UpdateOfferStatusSchema = z.object({
  offerId: z.number().positive().describe('ID of the offer to update'),
  status: z.enum(['sent', 'accepted', 'rejected', 'expired']).describe('New status: sent, accepted, rejected, or expired')
});

// Schema for send_offer_email tool
const SendOfferEmailSchema = z.object({
  offerId: z.number().positive().describe('ID of the offer to send'),
  subject: z.string().describe('Email subject'),
  text: z.string().describe('Email body text'),
  emailsTo: z.string().optional().describe('Recipient email addresses (semicolon-separated)'),
  emailsCc: z.string().optional().describe('CC email addresses (semicolon-separated)'),
  emailsBcc: z.string().optional().describe('BCC email addresses (semicolon-separated)')
});

// Schema for delete_offer tool
const DeleteOfferSchema = z.object({
  offerId: z.number().positive().describe('ID of the offer to delete')
});

/**
 * Formats an offer into a readable string
 */
function formatOffer(offer: Offer): string {
  const lines: string[] = [];
  lines.push(`Offer ID: ${offer.id}`);
  lines.push(`Identifier: ${offer.identifier}`);
  lines.push(`Title: ${offer.title}`);
  lines.push(`Status: ${offer.status}`);
  lines.push(`Date: ${offer.date}`);
  if (offer.valid_until) lines.push(`Valid Until: ${offer.valid_until}`);
  if (offer.company) lines.push(`Customer: ${offer.company.name} (ID: ${offer.company.id})`);
  if (offer.project) lines.push(`Project: ${offer.project.name} (ID: ${offer.project.id})`);
  lines.push(`Net Total: ${offer.net_total} ${offer.currency}`);
  lines.push(`Tax: ${offer.tax}%`);
  lines.push(`Gross Total: ${offer.gross_total} ${offer.currency}`);
  if (offer.discount) lines.push(`Discount: ${offer.discount}%`);
  if (offer.salutation) lines.push(`Salutation: ${offer.salutation}`);
  if (offer.footer) lines.push(`Footer: ${offer.footer}`);
  if (offer.tags && offer.tags.length > 0) lines.push(`Tags: ${offer.tags.join(', ')}`);

  if (offer.items && offer.items.length > 0) {
    lines.push('');
    lines.push('--- Positions ---');
    offer.items.forEach((item, index) => {
      if (item.type === 'title') {
        lines.push(`\n  [${index + 1}] TITLE: ${item.title || ''}`);
      } else if (item.type === 'description') {
        lines.push(`  [${index + 1}] DESC: ${item.description || ''}`);
      } else if (item.type === 'subtotal') {
        lines.push(`  [${index + 1}] SUBTOTAL: ${item.net_total ?? ''} ${offer.currency}`);
      } else if (item.type === 'page-break') {
        lines.push(`  [${index + 1}] --- page break ---`);
      } else if (item.type === 'separator') {
        lines.push(`  [${index + 1}] --- separator ---`);
      } else if (item.type === 'item') {
        const qty = item.quantity ?? '';
        const unit = item.unit ?? '';
        const price = item.unit_price ?? '';
        const total = item.net_total ?? '';
        const opt = item.optional ? ' [OPTIONAL]' : '';
        lines.push(`  [${index + 1}] ${item.title || ''}${opt}`);
        lines.push(`       ${qty} ${unit} × ${price} = ${total} ${offer.currency}`);
        if (item.description) lines.push(`       ${item.description}`);
      }
    });
  }

  return lines.join('\n');
}

/**
 * Formats a list of offers
 */
function formatOfferList(offers: Offer[]): string {
  const lines: string[] = [];
  lines.push(`Offers (${offers.length} found):\n`);

  offers.forEach(offer => {
    lines.push(`ID: ${offer.id}`);
    lines.push(`Identifier: ${offer.identifier}`);
    lines.push(`Title: ${offer.title}`);
    lines.push(`Status: ${offer.status}`);
    lines.push(`Date: ${offer.date}`);
    lines.push(`Gross Total: ${offer.gross_total} ${offer.currency}`);
    if (offer.company) lines.push(`Customer: ${offer.company.name}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Converts tool item format to API format
 */
function convertItemToApiFormat(item: z.infer<typeof OfferItemSchema>): OfferItem {
  const apiItem: OfferItem = { type: item.type };
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
 * Tool: get_offers
 * Retrieves all offers with optional filtering
 */
export const getOffersTool = {
  name: 'get_offers',
  description: 'Get all offers with optional filtering by status, date range, company, project, or search term.',
  inputSchema: zodToJsonSchema(GetOffersSchema),
  handler: async (params: z.infer<typeof GetOffersSchema>): Promise<string> => {
    const { status, dateFrom, dateTo, companyId, projectId, identifier, term, tags } = params;

    if (dateFrom !== undefined && !isValidDateFormat(dateFrom)) {
      return createValidationErrorMessage({ field: 'dateFrom', value: dateFrom, reason: 'invalid_date_format' });
    }
    if (dateTo !== undefined && !isValidDateFormat(dateTo)) {
      return createValidationErrorMessage({ field: 'dateTo', value: dateTo, reason: 'invalid_date_format' });
    }

    try {
      const apiService = new MocoApiService();
      const offers = await apiService.getOffers({
        status,
        date_from: dateFrom,
        date_to: dateTo,
        company_id: companyId,
        project_id: projectId,
        identifier,
        term,
        tags
      });

      if (offers.length === 0) {
        return createEmptyResultMessage({ type: 'offers' });
      }

      return formatOfferList(offers);

    } catch (error) {
      return `Error retrieving offers: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: get_offer
 * Retrieves a single offer by ID
 */
export const getOfferTool = {
  name: 'get_offer',
  description: 'Get a single offer by ID with full details including items.',
  inputSchema: zodToJsonSchema(GetOfferSchema),
  handler: async (params: z.infer<typeof GetOfferSchema>): Promise<string> => {
    const { offerId } = params;

    try {
      const apiService = new MocoApiService();
      const offer = await apiService.getOffer(offerId);

      return formatOffer(offer);

    } catch (error) {
      return `Error retrieving offer ${offerId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: create_offer
 * Creates a new offer
 */
export const createOfferTool = {
  name: 'create_offer',
  description: 'Create a new offer. Requires company ID, recipient address, date, title, tax, currency, and items.',
  inputSchema: zodToJsonSchema(CreateOfferSchema),
  handler: async (params: z.infer<typeof CreateOfferSchema>): Promise<string> => {
    const {
      customerId, recipientAddress, date, title, tax, currency, items,
      projectId, dueDate, salutation, footer, discount, tags
    } = params;

    if (!isValidDateFormat(date)) {
      return createValidationErrorMessage({ field: 'date', value: date, reason: 'invalid_date_format' });
    }
    if (dueDate !== undefined && !isValidDateFormat(dueDate)) {
      return createValidationErrorMessage({ field: 'dueDate', value: dueDate, reason: 'invalid_date_format' });
    }

    const apiItems = items.map(convertItemToApiFormat);

    const apiParams: Record<string, unknown> = {
      customer_id: customerId,
      recipient_address: recipientAddress,
      date,
      title,
      tax,
      currency,
      items: apiItems
    };

    if (projectId !== undefined) apiParams.project_id = projectId;
    if (dueDate !== undefined) apiParams.due_date = dueDate;
    if (salutation !== undefined) apiParams.salutation = salutation;
    if (footer !== undefined) apiParams.footer = footer;
    if (discount !== undefined) apiParams.discount = discount;
    if (tags !== undefined) apiParams.tags = tags;

    try {
      const apiService = new MocoApiService();
      const offer = await apiService.createOffer(apiParams as any);

      return `Offer created successfully!\n\n${formatOffer(offer)}`;

    } catch (error) {
      return `Error creating offer: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: update_offer_status
 * Updates the status of an offer
 */
export const updateOfferStatusTool = {
  name: 'update_offer_status',
  description: 'Update the status of an offer (sent, accepted, rejected, or expired).',
  inputSchema: zodToJsonSchema(UpdateOfferStatusSchema),
  handler: async (params: z.infer<typeof UpdateOfferStatusSchema>): Promise<string> => {
    const { offerId, status } = params;

    try {
      const apiService = new MocoApiService();
      const offer = await apiService.updateOfferStatus(offerId, status);

      return `Offer status updated successfully!\n\n${formatOffer(offer)}`;

    } catch (error) {
      return `Error updating offer ${offerId} status: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: send_offer_email
 * Sends an offer via email
 */
export const sendOfferEmailTool = {
  name: 'send_offer_email',
  description: 'Send an offer via email. Subject and text are required. Leave email addresses empty to use default customer/contact recipients.',
  inputSchema: zodToJsonSchema(SendOfferEmailSchema),
  handler: async (params: z.infer<typeof SendOfferEmailSchema>): Promise<string> => {
    const { offerId, subject, text, emailsTo, emailsCc, emailsBcc } = params;

    try {
      const apiService = new MocoApiService();
      await apiService.sendOfferEmail(offerId, {
        subject,
        text,
        emails_to: emailsTo,
        emails_cc: emailsCc,
        emails_bcc: emailsBcc
      });

      return `Offer ${offerId} sent via email successfully!`;

    } catch (error) {
      return `Error sending offer ${offerId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: delete_offer
 * Deletes an offer
 */
export const deleteOfferTool = {
  name: 'delete_offer',
  description: 'Delete an offer.',
  inputSchema: zodToJsonSchema(DeleteOfferSchema),
  handler: async (params: z.infer<typeof DeleteOfferSchema>): Promise<string> => {
    const { offerId } = params;

    try {
      const apiService = new MocoApiService();
      await apiService.deleteOffer(offerId);

      return `Offer ${offerId} deleted successfully.`;

    } catch (error) {
      return `Error deleting offer ${offerId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};
