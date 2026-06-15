import type { SupabaseClient } from '@supabase/supabase-js';
import { formatDisplayDate } from '@/lib/date-filter';
import { isReachCertificateType } from '@/lib/reach-certificate';
import {
  normalizeRegulatoryRegistrations,
  getRegulatoryRegistrationLabel,
} from '@/lib/regulatory-registrations';
import { buildExcelArrayBuffer, type ExcelSheet } from '@/lib/export-excel';

function formatExportDate(value: string | null | undefined): string {
  if (!value) return '';
  return formatDisplayDate(value);
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatRegistrations(value: unknown): string {
  return normalizeRegulatoryRegistrations(value)
    .map((item) => getRegulatoryRegistrationLabel(item))
    .join(', ');
}

type ExportRow = Record<string, string | number | boolean | null | undefined>;

const RECORD_TYPE_ORDER = [
  'Client',
  'Contact',
  'Authorized Chemical',
  'RC Certificate',
  'TCC Application',
  'TCC Certificate',
] as const;

function withRecordType(recordType: (typeof RECORD_TYPE_ORDER)[number], row: ExportRow): ExportRow {
  return { 'Record Type': recordType, ...row };
}

function mergeRowsToSingleSheet(groups: { recordType: (typeof RECORD_TYPE_ORDER)[number]; rows: ExportRow[] }[]): ExportRow[] {
  const merged = groups.flatMap((group) =>
    group.rows.map((row) => withRecordType(group.recordType, row))
  );

  merged.sort((a, b) => {
    const companyCompare = String(a['Company Name'] ?? '').localeCompare(
      String(b['Company Name'] ?? ''),
      undefined,
      { sensitivity: 'base' }
    );
    if (companyCompare !== 0) return companyCompare;

    const typeCompare =
      RECORD_TYPE_ORDER.indexOf(a['Record Type'] as (typeof RECORD_TYPE_ORDER)[number]) -
      RECORD_TYPE_ORDER.indexOf(b['Record Type'] as (typeof RECORD_TYPE_ORDER)[number]);
    if (typeCompare !== 0) return typeCompare;

    return String(a['Chemical Name'] ?? a['Tracking ID'] ?? a['Certificate Number'] ?? '').localeCompare(
      String(b['Chemical Name'] ?? b['Tracking ID'] ?? b['Certificate Number'] ?? ''),
      undefined,
      { sensitivity: 'base' }
    );
  });

  const columnKeys = new Set<string>();
  merged.forEach((row) => {
    Object.keys(row).forEach((key) => columnKeys.add(key));
  });

  const orderedColumns = [
    'Record Type',
    'Company Name',
    ...[...columnKeys]
      .filter((key) => key !== 'Record Type' && key !== 'Company Name')
      .sort((a, b) => a.localeCompare(b)),
  ];

  return merged.map((row) => {
    const normalized: ExportRow = {};
    orderedColumns.forEach((key) => {
      normalized[key] = row[key] ?? '';
    });
    return normalized;
  });
}

type ChemicalRef = {
  chemical_name?: string | null;
  cas_number?: string | null;
  ec_number?: string | null;
  tonnage_band?: string | null;
};

export async function buildClientDirectoryExportBuffer(
  supabase: SupabaseClient,
  clientIds: string[]
): Promise<ArrayBuffer> {
  if (clientIds.length === 0) {
    throw new Error('No clients selected for export.');
  }

  const [
    { data: clients, error: clientsError },
    { data: contacts, error: contactsError },
    { data: clientChemicals, error: clientChemicalsError },
    { data: certificates, error: certificatesError },
    { data: tccApplications, error: tccApplicationsError },
    { data: users, error: usersError },
  ] = await Promise.all([
    supabase.from('clients').select('*').in('id', clientIds).order('company_name', { ascending: true }),
    supabase.from('client_contacts').select('*').in('client_id', clientIds).order('created_at', { ascending: true }),
    supabase
      .from('client_chemicals')
      .select('*, chemicals(*)')
      .in('client_id', clientIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('certificates')
      .select(
        '*, chemicals(chemical_name, cas_number, ec_number, tonnage_band), tcc_applications!certificates_tcc_application_id_fkey(tracking_id, export_date, quantity_mt, status)'
      )
      .in('client_id', clientIds)
      .order('issued_at', { ascending: false }),
    supabase
      .from('tcc_applications')
      .select(
        '*, chemicals(chemical_name, cas_number, ec_number, tonnage_band), certificates!certificates_tcc_application_id_fkey(certificate_number, issued_at, expires_at, status, mail_sent, mail_sent_at)'
      )
      .in('client_id', clientIds)
      .order('created_at', { ascending: false }),
    supabase.from('users').select('client_id, email, is_disabled, created_at').in('client_id', clientIds),
  ]);

  const queryError =
    clientsError ||
    contactsError ||
    clientChemicalsError ||
    certificatesError ||
    tccApplicationsError ||
    usersError;
  if (queryError) {
    throw queryError;
  }

  const clientNameById = new Map(
    (clients || []).map((client) => [client.id as string, client.company_name as string])
  );
  const loginByClientId = new Map(
    (users || []).map((user) => [user.client_id as string, user])
  );

  const clientRows = (clients || []).map((client) => {
    const login = loginByClientId.get(client.id);
    return {
      'Company Name': client.company_name ?? '',
      'Legal Name': client.legal_name ?? '',
      'UUID Number': client.uuid_number ?? '',
      'Registration Number': client.registration_number ?? '',
      Email: client.email ?? '',
      'Owner Name': client.owner_name ?? '',
      'Primary Contact First Name': client.primary_contact_first_name ?? '',
      'Primary Contact Last Name': client.primary_contact_last_name ?? '',
      Phone: client.phone ?? '',
      'CC Emails': client.cc_emails ?? '',
      'CC Phones': client.cc_phones ?? '',
      Address: client.address ?? '',
      City: client.city ?? '',
      State: client.state ?? '',
      Country: client.country ?? '',
      'Postal Code': client.postal_code ?? '',
      Status: client.status ?? '',
      'Regulatory Registrations': formatRegistrations(client.regulatory_registrations),
      'Login Email': login?.email ?? '',
      'Login Disabled': login?.is_disabled ? 'Yes' : 'No',
      'Registered On': formatExportDate(client.created_at),
      'Last Updated': formatExportDate(client.updated_at),
    };
  });

  const contactRows = (contacts || []).map((contact) => ({
    'Company Name': clientNameById.get(contact.client_id) ?? '',
    'First Name': contact.first_name ?? '',
    'Last Name': contact.last_name ?? '',
    Email: contact.email ?? '',
    Phone: contact.phone ?? '',
    Role: contact.role ?? '',
    'Added On': formatExportDate(contact.created_at),
  }));

  const authorizedChemicalRows = (clientChemicals || []).map((row) => {
    const chemical = unwrapRelation(row.chemicals) as ChemicalRef | null;
    return {
      'Company Name': clientNameById.get(row.client_id) ?? '',
      'Chemical Name': chemical?.chemical_name ?? '',
      'CAS Number': chemical?.cas_number ?? '',
      'EC Number': chemical?.ec_number ?? '',
      'Tonnage Band': chemical?.tonnage_band ?? '',
      'Available Quantity (MT)': row.available_quantity ?? '',
      'Validity Date': formatExportDate(row.validity_date),
      'Registration Number': row.registration_number ?? '',
      'RC Certificate Number': row.certificate_number ?? '',
      'Issued Date': formatExportDate(row.issued_date),
      Status: row.status ?? '',
      'Assigned On': formatExportDate(row.created_at),
      'Last Updated': formatExportDate(row.updated_at),
    };
  });

  const rcCertificateRows = (certificates || [])
    .filter((cert) => isReachCertificateType(cert) && cert.status !== 'revoked')
    .map((cert) => {
      const chemical = unwrapRelation(cert.chemicals) as ChemicalRef | null;
      return {
        'Company Name': clientNameById.get(cert.client_id) ?? '',
        'Certificate Number': cert.certificate_number ?? '',
        'Registration Number': cert.registration_number ?? '',
        'Chemical Name': chemical?.chemical_name ?? '',
        'CAS Number': chemical?.cas_number ?? '',
        'EC Number': chemical?.ec_number ?? '',
        'Tonnage Band': cert.tonnage_band ?? chemical?.tonnage_band ?? '',
        'Allocated Quantity (MT)': cert.allocated_quantity ?? '',
        'Issued Date': formatExportDate(cert.issued_at),
        'Validity / Expires Date': formatExportDate(cert.expires_at),
        Status: cert.status ?? '',
        'Mail Sent': cert.mail_sent ? 'Yes' : 'No',
        'Mail Sent At': formatExportDate(cert.mail_sent_at),
        'Resend Count': cert.mail_resend_count ?? 0,
      };
    });

  const tccApplicationRows = (tccApplications || []).map((app) => {
    const chemical = unwrapRelation(app.chemicals) as ChemicalRef | null;
    const certificate = unwrapRelation(app.certificates);
    return {
      'Company Name': clientNameById.get(app.client_id) ?? '',
      'Tracking ID': app.tracking_id ?? '',
      'Regulatory Framework': getRegulatoryRegistrationLabel(app.regulatory_framework),
      'Chemical Name': chemical?.chemical_name ?? '',
      'CAS Number': chemical?.cas_number ?? '',
      'EC Number': chemical?.ec_number ?? '',
      'Quantity (MT)': app.quantity_mt ?? '',
      'Export Date': formatExportDate(app.export_date),
      'Registration Number': app.registration_number ?? '',
      Status: app.status ?? '',
      'EU Importer Company': app.eu_importer_company_name ?? '',
      'EU Importer Address': app.eu_importer_address ?? '',
      'Purchase Order Number': app.purchase_order_number ?? '',
      'Invoice Number': app.invoice_number ?? '',
      'BO Attachment': app.bo_attachment_name ?? '',
      Remarks: app.remarks ?? '',
      'Rejection Reason': app.rejection_reason ?? '',
      'TCC Certificate Number': certificate?.certificate_number ?? '',
      'Certificate Issued At': formatExportDate(certificate?.issued_at),
      'Certificate Status': certificate?.status ?? '',
      'Submitted On': formatExportDate(app.created_at),
      'Last Updated': formatExportDate(app.updated_at),
    };
  });

  const tccCertificateRows = (certificates || [])
    .filter((cert) => !isReachCertificateType(cert) && cert.status !== 'revoked')
    .map((cert) => {
      const chemical = unwrapRelation(cert.chemicals) as ChemicalRef | null;
      const tccApp = unwrapRelation(cert.tcc_applications);
      return {
        'Company Name': clientNameById.get(cert.client_id) ?? '',
        'Certificate Number': cert.certificate_number ?? '',
        'TCC Tracking ID': tccApp?.tracking_id ?? '',
        'Chemical Name': chemical?.chemical_name ?? '',
        'CAS Number': chemical?.cas_number ?? '',
        'EC Number': chemical?.ec_number ?? '',
        'Allocated Quantity (MT)': cert.allocated_quantity ?? '',
        'Tonnage Band': cert.tonnage_band ?? chemical?.tonnage_band ?? '',
        'Issued Date': formatExportDate(cert.issued_at),
        'Validity / Expires Date': formatExportDate(cert.expires_at),
        Status: cert.status ?? '',
        'TCC Status': tccApp?.status ?? '',
        'TCC Export Date': formatExportDate(tccApp?.export_date),
        'TCC Quantity (MT)': tccApp?.quantity_mt ?? '',
        'Mail Sent': cert.mail_sent ? 'Yes' : 'No',
        'Mail Sent At': formatExportDate(cert.mail_sent_at),
      };
    });

  const allRows = mergeRowsToSingleSheet([
    { recordType: 'Client', rows: clientRows },
    { recordType: 'Contact', rows: contactRows },
    { recordType: 'Authorized Chemical', rows: authorizedChemicalRows },
    { recordType: 'RC Certificate', rows: rcCertificateRows },
    { recordType: 'TCC Application', rows: tccApplicationRows },
    { recordType: 'TCC Certificate', rows: tccCertificateRows },
  ]);

  const sheets: ExcelSheet[] = [{ name: 'Client Export', rows: allRows }];

  return buildExcelArrayBuffer(sheets);
}
