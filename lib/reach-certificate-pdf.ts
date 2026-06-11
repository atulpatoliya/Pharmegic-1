import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReachCertificateStoredFile,
  generateReachPdfForClientChemical,
  type ReachPdfChemical,
  type ReachPdfSource,
} from '@/lib/reach-pdf-data';
import { CERTIFICATES_BUCKET } from '@/lib/storage';
import {
  buildReachAddressLines,
  convertReachDocxToPdf,
  formatReachCertDate,
  generateReachCertificateDocx,
} from '@/services/reach-certificate-docx';

type ReachCertPdfInput = {
  certificateNumber: string;
  registrationNumber: string;
  issuedDate: string;
  validatedDate: string;
  client: ReachPdfSource;
  chemical: ReachPdfChemical;
};

const PDF_CONTENT_TYPE = 'application/pdf';
const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type ReachCertificateDownloadFile = {
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
        console.warn(`[REACH PDF] Failed to cache ${certificateNumber}.pdf:`, error.message);
      }
    });
}

function buildFreshReachDocx(input: ReachCertPdfInput): Buffer {
  const address = buildReachAddressLines(input.client);
  return generateReachCertificateDocx({
    companyName: input.client.company_name,
    addressLine1: address.line1,
    addressLine2: address.line2,
    addressLine3: address.line3,
    chemicalName: input.chemical.chemical_name,
    ecNumber: input.chemical.ec_number || '—',
    casNumber: input.chemical.cas_number,
    registrationNumber: input.registrationNumber.trim(),
    tonnageBand: input.chemical.tonnage_band || '—',
    uuidNumber: input.client.uuid_number || '—',
    issuedDate: formatReachCertDate(input.issuedDate),
    validatedDate: formatReachCertDate(input.validatedDate),
  });
}

async function tryConvertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  return convertReachDocxToPdf(docxBuffer);
}

/**
 * Resolves the best available RC certificate file for download/email.
 * Prefers a freshly generated PDF from the current template, then stored PDF,
 * then DOCX fallbacks when PDF conversion is unavailable on the server.
 */
export async function resolveReachCertificateDownloadFile(
  supabase: SupabaseClient,
  input: ReachCertPdfInput
): Promise<ReachCertificateDownloadFile> {
  const certNumber = input.certificateNumber;

  // 1. Fresh PDF from current template
  try {
    const docxBuffer = buildFreshReachDocx(input);
    const pdfBuffer = await tryConvertDocxToPdf(docxBuffer);
    cachePdfToStorage(supabase, certNumber, pdfBuffer);
    return {
      buffer: pdfBuffer,
      contentType: PDF_CONTENT_TYPE,
      fileName: `${certNumber}.pdf`,
      format: 'pdf',
    };
  } catch {
    // Converter unavailable — try stored files.
  }

  // 2. Stored PDF
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
  const freshDocx = buildFreshReachDocx(input);
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
export async function resolveReachCertificatePdfBuffer(
  supabase: SupabaseClient,
  input: ReachCertPdfInput
): Promise<Buffer> {
  const file = await resolveReachCertificateDownloadFile(supabase, input);
  if (file.format !== 'pdf') {
    throw new Error(
      'PDF conversion is not available on this server. Install LibreOffice (recommended: apt install libreoffice-writer) or set GOTENBERG_URL for document conversion.'
    );
  }
  return file.buffer;
}

export { generateReachPdfForClientChemical, buildReachCertificateStoredFile };
