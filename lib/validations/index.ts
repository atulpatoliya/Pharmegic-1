import { z } from 'zod';

// ============================================================================
// AUTHENTICATION
// ============================================================================
export const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

// ============================================================================
// CHEMICAL SCHEMAS
// ============================================================================
export const chemicalSchema = z.object({
  chemical_name: z.string().min(2, { message: 'Chemical name is required' }),
  cas_number: z.string().regex(/^\d{2,7}-\d{2}-\d$/, { message: 'Invalid CAS number format (e.g. 110-80-5)' }),
  ec_number: z.string().min(1, { message: 'EC number is required' }),
  tonnage_band: z.string().min(1, { message: 'Tonnage band is required' }),
  validity_date: z.string().min(1, { message: 'Validity date is required' }),
  available_quantity: z.coerce.number().min(0, { message: 'Quantity must be non-negative' }),
  status: z.enum(['active', 'inactive']).default('active'),
});

// ============================================================================
// CLIENT SCHEMAS
// ============================================================================
export const contactSchema = z.object({
  first_name: z.string().min(1, { message: 'First name is required' }),
  last_name: z.string().min(1, { message: 'Last name is required' }),
  email: z.string().email({ message: 'Invalid email' }),
  phone: z.string().optional().or(z.literal('')),
  role: z.string().optional().or(z.literal('')),
});

export const clientProfileSchema = z.object({
  company_name: z.string().min(2, { message: 'Company name is required' }),
  uuid_number: z.string().min(1, { message: 'UUID number is required' }),
  primary_contact_first_name: z.string().min(1, { message: 'First name is required' }),
  primary_contact_last_name: z.string().min(1, { message: 'Last name is required' }),
  email: z.string().email({ message: 'Invalid primary contact email' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  owner_name: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  cc_emails: z.string().optional().or(z.literal('')),
  cc_phones: z.string().optional().or(z.literal('')),
  address: z.string().min(1, { message: 'Address is required' }),
  city: z.string().min(1, { message: 'City is required' }),
  state: z.string().min(1, { message: 'State is required' }),
  country: z.string().min(1, { message: 'Country is required' }),
  postal_code: z.string().min(1, { message: 'Postal code is required' }),
  status: z.enum(['active', 'inactive', 'pending']).default('pending'),
});

export const clientWizardSchema = z.object({
  profile: clientProfileSchema,
  contacts: z.array(contactSchema).default([]),
});

// ============================================================================
// ASSIGN CHEMICAL TO CLIENT
// ============================================================================
export const assignChemicalSchema = z.object({
  chemical_id: z.string().uuid({ message: 'Please select a chemical' }),
  available_quantity: z.coerce.number().min(0.01, { message: 'Quantity must be greater than 0' }),
  validity_date: z.string().min(1, { message: 'Validity date is required' }),
  status: z.enum(['active', 'expired', 'suspended']).default('active'),
});

// ============================================================================
// INTERNAL NOTE
// ============================================================================
export const internalNoteSchema = z.object({
  note: z.string().min(1, { message: 'Note cannot be empty' }).max(2000),
});

// ============================================================================
// TCC APPLICATION
// ============================================================================
export const tccApplicationSchema = z.object({
  chemical_id: z.string().uuid({ message: 'Please select a chemical' }),
  quantity_mt: z.coerce.number().positive({ message: 'Quantity must be greater than 0' }),
  registration_number: z
    .preprocess((val) => (val == null || val === '' ? undefined : String(val)), z.string().optional()),
  export_date: z.string().min(1, { message: 'Expected export date is required' }),
  remarks: z
    .preprocess((val) => (val == null || val === '' ? undefined : String(val)), z.string().optional()),
  eu_importer_company_name: z.string().min(1, { message: 'EU importer company name is required' }),
  eu_importer_address: z.string().min(1, { message: 'EU importer address is required' }),
  purchase_order_number: z.string().min(1, { message: 'Purchase order number is required' }),
  invoice_number: z
    .preprocess((val) => (val == null || val === '' ? undefined : String(val)), z.string().optional()),
});

// ============================================================================
// SMTP SETTINGS
// ============================================================================
export const smtpSettingsSchema = z.object({
  smtp_host: z.string().min(1, { message: 'SMTP host is required' }),
  smtp_port: z.coerce.number().min(1).max(65535),
  smtp_user: z.string().min(1, { message: 'SMTP username is required' }),
  smtp_pass: z.string().min(1, { message: 'SMTP password is required' }),
  smtp_from: z.string().email({ message: 'Invalid From email' }),
  smtp_cc_default: z.string().optional().or(z.literal('')),
});

// ============================================================================
// CHANGE CLIENT CREDENTIALS (admin only)
// ============================================================================
export const changePasswordSchema = z.object({
  new_password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export const changeEmailSchema = z.object({
  new_email: z.string().email({ message: 'Invalid email address' }),
});
