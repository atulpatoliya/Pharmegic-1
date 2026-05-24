import { z } from 'zod';

// AUTHENTICATION SCHEMAS
export const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z.string().min(6, { message: 'Password confirmation must be at least 6 characters' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// CHEMICAL SCHEMAS
export const chemicalSchema = z.object({
  chemical_name: z.string().min(2, { message: 'Chemical name is required' }),
  cas_number: z.string().regex(/^\d{2,7}-\d{2}-\d$/, { message: 'Invalid CAS number format (e.g. 110-80-5)' }),
  ec_number: z.string().optional().or(z.literal('')),
  tonnage_band: z.string().min(1, { message: 'Tonnage band is required' }),
  validity_date: z.string().min(1, { message: 'Validity date is required' }),
  available_quantity: z.coerce.number().min(0, { message: 'Quantity must be non-negative' }),
  status: z.enum(['active', 'inactive']).default('active'),
});

// CLIENT SCHEMAS
export const contactSchema = z.object({
  person_name: z.string().min(2, { message: 'Contact name is required' }),
  email: z.string().email({ message: 'Invalid email' }),
  phone: z.string().optional().or(z.literal('')),
  role: z.string().optional().or(z.literal('')),
});

export const clientStep1Schema = z.object({
  company_name: z.string().min(2, { message: 'Company name is required' }),
  legal_name: z.string().optional().or(z.literal('')),
  registration_number: z.string().min(2, { message: 'Registration number is required' }),
  uuid_number: z.string().optional().or(z.literal('')),
  email: z.string().email({ message: 'Invalid company email' }),
  owner_name: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  cc_emails: z.string().optional().or(z.literal('')),
  cc_phones: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  postal_code: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'pending']).default('pending'),
});

export const clientWizardSchema = z.object({
  profile: clientStep1Schema,
  contacts: z.array(contactSchema).default([]),
  authorizedChemicalIds: z.array(z.string()).default([]), // Authorized chemicals for this client
});

// TCC APPLICATION SCHEMA
export const tccApplicationSchema = z.object({
  chemical_id: z.string().uuid({ message: 'Please select a chemical' }),
  quantity_mt: z.coerce.number().positive({ message: 'Quantity must be greater than 0' }),
  kkdik_reg_no: z.string().min(1, { message: 'KKDIK registration number is required' }),
  export_date: z.string().min(1, { message: 'Expected export date is required' }),
});
