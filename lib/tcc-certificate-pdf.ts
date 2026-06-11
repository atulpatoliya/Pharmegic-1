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

type TccCertPdfInput = {
  certificateNumber: string;
  client: TccPdfClient;
  chemical: TccPdfChemical;
  application: TccPdfApplication;
  registrationNumber?: string | null;
  validUntilDate: string;
  deliveryChallanNo?: string | null;
};

const PDF_CONTENT_TYPE = 'application/pdf';
const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type TccCertificateDownloadFile = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  format: 'pdf' | 'docx';
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
  const docxData = buildTccDocxData(buildDocxInput(input));

  // 1. Fresh PDF from current template
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

  // 2. Stored PDF (from a previous successful conversion)
  const storedPdf = await downloadStorageFile(supabase, `${certNumber}.pdf`);
  if (storedPdf) {
    return {
      buffer: storedPdf,
      contentType: PDF_CONTENT_TYPE,
      fileName: `${certNumber}.pdf`,
      format: 'pdf',
    };
  }

  // 3. Stored DOCX → convert if possible
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

  // 4. Fresh DOCX from template (always available without LibreOffice)
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
    return {
      buffer: freshDocx,
      contentType: DOCX_CONTENT_TYPE,
      fileName: `${certNumber}.docx`,
      format: 'docx',
    };
  }
}

/** Returns a PDF buffer when possible; throws if only DOCX can be produced. */
export async function resolveTccCertificatePdfBuffer(
  supabase: SupabaseClient,
  input: TccCertPdfInput
): Promise<Buffer> {
  const file = await resolveTccCertificateDownloadFile(supabase, input);
  if (file.format !== 'pdf') {
    throw new Error(
      'PDF conversion is not available on this server. Install LibreOffice (recommended: apt install libreoffice-writer) or set GOTENBERG_URL for document conversion.'
    );
  }
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
    deliveryChallanNo: application.tracking_id,
  };
}

export { buildTccDocxData, generateTccPdfForApplication };
