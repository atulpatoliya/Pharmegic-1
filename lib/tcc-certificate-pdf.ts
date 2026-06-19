import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildTccDocxData,
  generateTccPdfForApplication,
  type TccPdfApplication,
  type TccPdfChemical,
  type TccPdfClient,
} from '@/lib/tcc-pdf-data';
import { CERTIFICATES_BUCKET } from '@/lib/storage';
import { convertTccDocxToPdf, generateTccCertificateDocx } from '@/services/tcc-certificate-docx';
import { generateTccCertificateHtmlPdf } from '@/lib/tcc-certificate-html-pdf-server';
import { isReachPuppeteerPdfAvailable } from '@/services/reach-certificate-puppeteer-pdf';
import { findReachCertificateForExportDate, REACH_CERTIFICATE_TYPE } from '@/lib/reach-certificate';

const REACH_QUOTA_CERT_SELECT =
  'id, certificate_number, client_id, chemical_id, status, expires_at, issued_at, type, allocated_quantity, tonnage_band, registration_number';

type TccCertPdfInput = {
  certificateNumber: string;
  client: TccPdfClient;
  chemical: TccPdfChemical;
  application: TccPdfApplication;
  registrationNumber?: string | null;
  validUntilDate: string;
  deliveryChallanNo?: string | null;
  issuedDate?: string | null;
};

export type { TccCertPdfInput };

const PDF_CONTENT_TYPE = 'application/pdf';
const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type TccCertificateDownloadFile = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  format: 'pdf';
};

async function downloadStorageFile(
  supabase: SupabaseClient,
  fileName: string
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(CERTIFICATES_BUCKET).download(fileName);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

function cachePdfToStorage(
  supabase: SupabaseClient,
  certificateNumber: string,
  pdfBuffer: Buffer
): void {
  void supabase.storage
    .from(CERTIFICATES_BUCKET)
    .upload(`${certificateNumber}.pdf`, pdfBuffer, {
      contentType: PDF_CONTENT_TYPE,
      upsert: true,
    })
    .then(({ error }) => {
      if (error) {
        console.warn(`[TCC PDF] Failed to cache ${certificateNumber}.pdf:`, error.message);
      }
    });
}

function buildDocxInput(input: TccCertPdfInput) {
  return {
    client: input.client,
    chemical: input.chemical,
    application: input.application,
    registrationNumber: input.registrationNumber,
    validUntilDate: input.validUntilDate,
    deliveryChallanNo: input.deliveryChallanNo,
  };
}

async function tryConvertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  return convertTccDocxToPdf(docxBuffer);
}

/**
 * Resolves the best available certificate file for download/email.
 * Prefers a freshly generated PDF from the current template, then stored PDF,
 * then DOCX fallbacks when PDF conversion is unavailable on the server.
 */
export async function resolveTccCertificateDownloadFile(
  supabase: SupabaseClient,
  input: TccCertPdfInput
): Promise<TccCertificateDownloadFile> {
  const certNumber = input.certificateNumber;

  // 1. Fresh HTML → PDF (Puppeteer) — matches on-screen preview
  if (isReachPuppeteerPdfAvailable()) {
    try {
      const pdfBuffer = await generateTccCertificateHtmlPdf(input);
      cachePdfToStorage(supabase, certNumber, pdfBuffer);
      return {
        buffer: pdfBuffer,
        contentType: PDF_CONTENT_TYPE,
        fileName: `${certNumber}.pdf`,
        format: 'pdf',
      };
    } catch {
      // Fall through to DOCX/LibreOffice path.
    }
  }

  const docxData = buildTccDocxData(buildDocxInput(input));

  // 2. Fresh PDF from DOCX template (LibreOffice)
  try {
    const docxBuffer = generateTccCertificateDocx(docxData);
    const pdfBuffer = await tryConvertDocxToPdf(docxBuffer);
    cachePdfToStorage(supabase, certNumber, pdfBuffer);
    return {
      buffer: pdfBuffer,
      contentType: PDF_CONTENT_TYPE,
      fileName: `${certNumber}.pdf`,
      format: 'pdf',
    };
  } catch {
    // Converter unavailable or failed — try stored files.
  }

  // 3. Stored PDF (from a previous successful conversion)
  const storedPdf = await downloadStorageFile(supabase, `${certNumber}.pdf`);
  if (storedPdf) {
    return {
      buffer: storedPdf,
      contentType: PDF_CONTENT_TYPE,
      fileName: `${certNumber}.pdf`,
      format: 'pdf',
    };
  }

  // 4. Stored DOCX → convert if possible
  const storedDocx = await downloadStorageFile(supabase, `${certNumber}.docx`);
  if (storedDocx) {
    try {
      const pdfBuffer = await tryConvertDocxToPdf(storedDocx);
      cachePdfToStorage(supabase, certNumber, pdfBuffer);
      return {
        buffer: pdfBuffer,
        contentType: PDF_CONTENT_TYPE,
        fileName: `${certNumber}.pdf`,
        format: 'pdf',
      };
    } catch {
      // Fall through to fresh DOCX from template.
    }
  }

  // 5. Fresh DOCX from template (always available without LibreOffice)
  const freshDocx = generateTccCertificateDocx(docxData);
  try {
    const pdfBuffer = await tryConvertDocxToPdf(freshDocx);
    cachePdfToStorage(supabase, certNumber, pdfBuffer);
    return {
      buffer: pdfBuffer,
      contentType: PDF_CONTENT_TYPE,
      fileName: `${certNumber}.pdf`,
      format: 'pdf',
    };
  } catch {
    throw new Error(
      'PDF conversion is not available on this server. Install LibreOffice (Linux: sudo apt install libreoffice-writer).'
    );
  }
}

/** Returns a PDF buffer; throws if conversion is unavailable. */
export async function resolveTccCertificatePdfBuffer(
  supabase: SupabaseClient,
  input: TccCertPdfInput
): Promise<Buffer> {
  const file = await resolveTccCertificateDownloadFile(supabase, input);
  return file.buffer;
}

export function buildTccCertificatePdfInputFromCert(cert: {
  certificate_number: string;
  expires_at?: string | null;
  registration_number?: string | null;
  clients: TccPdfClient | TccPdfClient[];
  chemicals?: TccPdfChemical | TccPdfChemical[] | null;
  tcc_applications?:
    | (TccPdfApplication & { chemicals?: TccPdfChemical | TccPdfChemical[] | null })
    | (TccPdfApplication & { chemicals?: TccPdfChemical | TccPdfChemical[] | null })[]
    | null;
}): TccCertPdfInput {
  const applicationRaw = cert.tcc_applications;
  const application = Array.isArray(applicationRaw) ? applicationRaw[0] : applicationRaw;
  const client = Array.isArray(cert.clients) ? cert.clients[0] : cert.clients;
  const chemicalFromCert = cert.chemicals
    ? Array.isArray(cert.chemicals)
      ? cert.chemicals[0]
      : cert.chemicals
    : null;
  const chemicalFromApp = application?.chemicals
    ? Array.isArray(application.chemicals)
      ? application.chemicals[0]
      : application.chemicals
    : null;
  const chemical = chemicalFromCert || chemicalFromApp;

  if (!application || !chemical || !client) {
    throw new Error('TCC certificate data is incomplete.');
  }

  return {
    certificateNumber: cert.certificate_number,
    client,
    chemical,
    application,
    registrationNumber: cert.registration_number,
    validUntilDate: cert.expires_at?.split('T')[0] || application.export_date || '',
    deliveryChallanNo:
      application.purchase_order_number?.trim() || application.tracking_id || undefined,
  };
}

/** Builds preview input for a pending TCC application (admin review before approval). */
export async function buildTccApplicationPreviewInput(
  supabase: SupabaseClient,
  applicationId: string
): Promise<TccCertPdfInput> {
  const { data: app, error } = await supabase
    .from('tcc_applications')
    .select(
      `
      id,
      client_id,
      chemical_id,
      quantity_mt,
      export_date,
      tracking_id,
      registration_number,
      remarks,
      certificate_issue_date,
      reach_certificate_id,
      eu_importer_company_name,
      eu_importer_address,
      purchase_order_number,
      invoice_number,
      clients (
        company_name,
        uuid_number,
        address,
        city,
        state,
        postal_code,
        country
      ),
      chemicals (
        chemical_name,
        cas_number,
        ec_number,
        tonnage_band
      )
    `
    )
    .eq('id', applicationId)
    .single();

  if (error || !app) {
    throw new Error('TCC application not found.');
  }

  const client = Array.isArray(app.clients) ? app.clients[0] : app.clients;
  const chemicalRaw = Array.isArray(app.chemicals) ? app.chemicals[0] : app.chemicals;

  if (!client || !chemicalRaw) {
    throw new Error('TCC application data is incomplete.');
  }

  const { data: reachCerts } = await supabase
    .from('certificates')
    .select(REACH_QUOTA_CERT_SELECT)
    .eq('client_id', app.client_id)
    .eq('chemical_id', app.chemical_id)
    .eq('type', REACH_CERTIFICATE_TYPE)
    .neq('status', 'revoked');

  const reachCert =
    (app.reach_certificate_id
      ? (reachCerts || []).find((cert) => cert.id === app.reach_certificate_id)
      : null) ||
    (app.export_date
      ? findReachCertificateForExportDate(reachCerts || [], app.chemical_id, app.export_date)
      : null);

  const chemical: TccPdfChemical = {
    ...chemicalRaw,
    tonnage_band: reachCert?.tonnage_band || chemicalRaw.tonnage_band,
  };

  const issueDateRaw = app.certificate_issue_date
    ? String(app.certificate_issue_date).split('T')[0]
    : new Date().toISOString().split('T')[0];
  const issueDate = new Date(`${issueDateRaw}T12:00:00`);
  const expiryDate = new Date(issueDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const application: TccPdfApplication = {
    quantity_mt: app.quantity_mt,
    export_date: app.export_date,
    tracking_id: app.tracking_id,
    registration_number: app.registration_number,
    remarks: app.remarks,
    eu_importer_company_name: app.eu_importer_company_name,
    eu_importer_address: app.eu_importer_address,
    purchase_order_number: app.purchase_order_number,
    invoice_number: app.invoice_number,
  };

  return {
    certificateNumber: 'TCC-PREVIEW',
    client,
    chemical,
    application,
    registrationNumber:
      reachCert?.registration_number?.trim() || app.registration_number?.trim() || null,
    validUntilDate: expiryDate.toISOString().split('T')[0],
    deliveryChallanNo: app.tracking_id?.trim() || app.purchase_order_number?.trim() || undefined,
  };
}

export { buildTccDocxData, generateTccPdfForApplication };
