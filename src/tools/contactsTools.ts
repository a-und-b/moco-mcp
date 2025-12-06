/**
 * MCP tools for Contacts management
 * Provides CRUD operations for contact persons
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MocoApiService } from '../services/mocoApi.js';
import { isValidDateFormat } from '../utils/dateUtils.js';
import { createEmptyResultMessage, createValidationErrorMessage } from '../utils/errorHandler.js';
import type { Contact } from '../types/mocoTypes.js';

// Gender enum
const GenderEnum = z.enum(['F', 'M', 'U']);

// Schema for get_contacts tool
const GetContactsSchema = z.object({
  tags: z.string().optional().describe('Filter by tags (comma-separated, e.g., "Influencer, Early Adopter")'),
  term: z.string().optional().describe('Search term for name, firstname, work_email, or company'),
  phone: z.string().optional().describe('Reverse lookup by work_phone or mobile_phone')
});

// Schema for get_contact tool
const GetContactSchema = z.object({
  contactId: z.number().positive().describe('ID of the contact to retrieve')
});

// Schema for create_contact tool
const CreateContactSchema = z.object({
  lastname: z.string().describe('Contact\'s surname (required)'),
  gender: GenderEnum.describe('Gender: F (female), M (male), or U (unknown)'),
  firstname: z.string().optional().describe('Contact\'s first name'),
  companyId: z.number().positive().optional().describe('Associated company ID'),
  userId: z.number().positive().optional().describe('Responsible user ID'),
  title: z.string().optional().describe('Professional title (e.g., "Dr.", "Prof.")'),
  jobPosition: z.string().optional().describe('Job role/position'),
  mobilePhone: z.string().optional().describe('Mobile phone number'),
  workPhone: z.string().optional().describe('Work phone number'),
  workFax: z.string().optional().describe('Work fax number'),
  workEmail: z.string().email().optional().describe('Work email address'),
  homeEmail: z.string().email().optional().describe('Home email address'),
  workAddress: z.string().optional().describe('Work address'),
  homeAddress: z.string().optional().describe('Home address'),
  birthday: z.string().optional().describe('Birthday (YYYY-MM-DD format)'),
  info: z.string().optional().describe('Additional information'),
  tags: z.array(z.string()).optional().describe('Tags for the contact')
});

// Schema for update_contact tool
const UpdateContactSchema = z.object({
  contactId: z.number().positive().describe('ID of the contact to update'),
  lastname: z.string().optional().describe('Contact\'s surname'),
  gender: GenderEnum.optional().describe('Gender: F (female), M (male), or U (unknown)'),
  firstname: z.string().optional().describe('Contact\'s first name'),
  companyId: z.number().positive().optional().describe('Associated company ID'),
  userId: z.number().positive().optional().describe('Responsible user ID'),
  title: z.string().optional().describe('Professional title'),
  jobPosition: z.string().optional().describe('Job role/position'),
  mobilePhone: z.string().optional().describe('Mobile phone number'),
  workPhone: z.string().optional().describe('Work phone number'),
  workFax: z.string().optional().describe('Work fax number'),
  workEmail: z.string().email().optional().describe('Work email address'),
  homeEmail: z.string().email().optional().describe('Home email address'),
  workAddress: z.string().optional().describe('Work address'),
  homeAddress: z.string().optional().describe('Home address'),
  birthday: z.string().optional().describe('Birthday (YYYY-MM-DD format)'),
  info: z.string().optional().describe('Additional information'),
  tags: z.array(z.string()).optional().describe('Tags for the contact')
});

// Schema for delete_contact tool
const DeleteContactSchema = z.object({
  contactId: z.number().positive().describe('ID of the contact to delete')
});

/**
 * Formats a contact into a readable string
 */
function formatContact(contact: Contact): string {
  const lines: string[] = [];
  lines.push(`Contact ID: ${contact.id}`);
  const fullName = [contact.title, contact.firstname, contact.lastname].filter(Boolean).join(' ');
  lines.push(`Name: ${fullName}`);
  lines.push(`Gender: ${contact.gender === 'F' ? 'Female' : contact.gender === 'M' ? 'Male' : 'Unknown'}`);
  if (contact.job_position) lines.push(`Position: ${contact.job_position}`);
  if (contact.company) lines.push(`Company: ${contact.company.name} (ID: ${contact.company.id})`);
  if (contact.work_email) lines.push(`Work Email: ${contact.work_email}`);
  if (contact.home_email) lines.push(`Home Email: ${contact.home_email}`);
  if (contact.work_phone) lines.push(`Work Phone: ${contact.work_phone}`);
  if (contact.mobile_phone) lines.push(`Mobile: ${contact.mobile_phone}`);
  if (contact.work_address) lines.push(`Work Address: ${contact.work_address}`);
  if (contact.birthday) lines.push(`Birthday: ${contact.birthday}`);
  if (contact.tags && contact.tags.length > 0) lines.push(`Tags: ${contact.tags.join(', ')}`);
  if (contact.user) lines.push(`Responsible: ${contact.user.firstname} ${contact.user.lastname}`);
  return lines.join('\n');
}

/**
 * Formats a list of contacts
 */
function formatContactList(contacts: Contact[]): string {
  const lines: string[] = [];
  lines.push(`Contacts (${contacts.length} found):\n`);

  contacts.forEach(contact => {
    const fullName = [contact.title, contact.firstname, contact.lastname].filter(Boolean).join(' ');
    lines.push(`ID: ${contact.id}`);
    lines.push(`Name: ${fullName}`);
    if (contact.company) lines.push(`Company: ${contact.company.name}`);
    if (contact.work_email) lines.push(`Email: ${contact.work_email}`);
    if (contact.work_phone) lines.push(`Phone: ${contact.work_phone}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Tool: get_contacts
 * Retrieves all contacts with optional filtering
 */
export const getContactsTool = {
  name: 'get_contacts',
  description: 'Get all contacts with optional filtering by tags, search term, or phone number.',
  inputSchema: zodToJsonSchema(GetContactsSchema),
  handler: async (params: z.infer<typeof GetContactsSchema>): Promise<string> => {
    const { tags, term, phone } = params;

    try {
      const apiService = new MocoApiService();
      const contacts = await apiService.getContacts({ tags, term, phone });

      if (contacts.length === 0) {
        return createEmptyResultMessage({ type: 'contacts' });
      }

      return formatContactList(contacts);

    } catch (error) {
      return `Error retrieving contacts: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: get_contact
 * Retrieves a single contact by ID
 */
export const getContactTool = {
  name: 'get_contact',
  description: 'Get a single contact by ID with full details.',
  inputSchema: zodToJsonSchema(GetContactSchema),
  handler: async (params: z.infer<typeof GetContactSchema>): Promise<string> => {
    const { contactId } = params;

    try {
      const apiService = new MocoApiService();
      const contact = await apiService.getContact(contactId);

      return formatContact(contact);

    } catch (error) {
      return `Error retrieving contact ${contactId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: create_contact
 * Creates a new contact
 */
export const createContactTool = {
  name: 'create_contact',
  description: 'Create a new contact person. Lastname and gender are required.',
  inputSchema: zodToJsonSchema(CreateContactSchema),
  handler: async (params: z.infer<typeof CreateContactSchema>): Promise<string> => {
    const {
      lastname, gender, firstname, companyId, userId, title, jobPosition,
      mobilePhone, workPhone, workFax, workEmail, homeEmail,
      workAddress, homeAddress, birthday, info, tags
    } = params;

    // Validate birthday format if provided
    if (birthday !== undefined && !isValidDateFormat(birthday)) {
      return createValidationErrorMessage({
        field: 'birthday',
        value: birthday,
        reason: 'invalid_date_format'
      });
    }

    // Build API parameters
    const apiParams: Record<string, unknown> = { lastname, gender };

    if (firstname !== undefined) apiParams.firstname = firstname;
    if (companyId !== undefined) apiParams.company_id = companyId;
    if (userId !== undefined) apiParams.user_id = userId;
    if (title !== undefined) apiParams.title = title;
    if (jobPosition !== undefined) apiParams.job_position = jobPosition;
    if (mobilePhone !== undefined) apiParams.mobile_phone = mobilePhone;
    if (workPhone !== undefined) apiParams.work_phone = workPhone;
    if (workFax !== undefined) apiParams.work_fax = workFax;
    if (workEmail !== undefined) apiParams.work_email = workEmail;
    if (homeEmail !== undefined) apiParams.home_email = homeEmail;
    if (workAddress !== undefined) apiParams.work_address = workAddress;
    if (homeAddress !== undefined) apiParams.home_address = homeAddress;
    if (birthday !== undefined) apiParams.birthday = birthday;
    if (info !== undefined) apiParams.info = info;
    if (tags !== undefined) apiParams.tags = tags;

    try {
      const apiService = new MocoApiService();
      const contact = await apiService.createContact(apiParams as any);

      return `Contact created successfully!\n\n${formatContact(contact)}`;

    } catch (error) {
      return `Error creating contact: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: update_contact
 * Updates an existing contact
 */
export const updateContactTool = {
  name: 'update_contact',
  description: 'Update an existing contact. Only provide the fields you want to change.',
  inputSchema: zodToJsonSchema(UpdateContactSchema),
  handler: async (params: z.infer<typeof UpdateContactSchema>): Promise<string> => {
    const {
      contactId, lastname, gender, firstname, companyId, userId, title, jobPosition,
      mobilePhone, workPhone, workFax, workEmail, homeEmail,
      workAddress, homeAddress, birthday, info, tags
    } = params;

    // Validate birthday format if provided
    if (birthday !== undefined && !isValidDateFormat(birthday)) {
      return createValidationErrorMessage({
        field: 'birthday',
        value: birthday,
        reason: 'invalid_date_format'
      });
    }

    // Build API parameters (only include provided fields)
    const apiParams: Record<string, unknown> = {};

    if (lastname !== undefined) apiParams.lastname = lastname;
    if (gender !== undefined) apiParams.gender = gender;
    if (firstname !== undefined) apiParams.firstname = firstname;
    if (companyId !== undefined) apiParams.company_id = companyId;
    if (userId !== undefined) apiParams.user_id = userId;
    if (title !== undefined) apiParams.title = title;
    if (jobPosition !== undefined) apiParams.job_position = jobPosition;
    if (mobilePhone !== undefined) apiParams.mobile_phone = mobilePhone;
    if (workPhone !== undefined) apiParams.work_phone = workPhone;
    if (workFax !== undefined) apiParams.work_fax = workFax;
    if (workEmail !== undefined) apiParams.work_email = workEmail;
    if (homeEmail !== undefined) apiParams.home_email = homeEmail;
    if (workAddress !== undefined) apiParams.work_address = workAddress;
    if (homeAddress !== undefined) apiParams.home_address = homeAddress;
    if (birthday !== undefined) apiParams.birthday = birthday;
    if (info !== undefined) apiParams.info = info;
    if (tags !== undefined) apiParams.tags = tags;

    if (Object.keys(apiParams).length === 0) {
      return 'No fields provided to update. Please specify at least one field to change.';
    }

    try {
      const apiService = new MocoApiService();
      const contact = await apiService.updateContact(contactId, apiParams as any);

      return `Contact updated successfully!\n\n${formatContact(contact)}`;

    } catch (error) {
      return `Error updating contact ${contactId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

/**
 * Tool: delete_contact
 * Deletes a contact
 */
export const deleteContactTool = {
  name: 'delete_contact',
  description: 'Delete a contact permanently.',
  inputSchema: zodToJsonSchema(DeleteContactSchema),
  handler: async (params: z.infer<typeof DeleteContactSchema>): Promise<string> => {
    const { contactId } = params;

    try {
      const apiService = new MocoApiService();
      await apiService.deleteContact(contactId);

      return `Contact ${contactId} deleted successfully.`;

    } catch (error) {
      return `Error deleting contact ${contactId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};
