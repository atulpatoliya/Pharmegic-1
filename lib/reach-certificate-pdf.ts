import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReachCertificateStoredFile,
  buildReachDocxData,
  generateReachPdfForClientChemical,
  type ReachPdfChemical,
  type ReachPdfSource,
} from '@/lib/reach-pdf-data';
import { generateReachCertificateDocx, convertReachDocxToPdf } from '@/services/reach-certificate-docx';

type ReachCertPdfInput = {
  certificateNumber: string;
  registrationNumber: string;
  issuedDate: string;
  validatedDate: string;
  client: ReachPdfSource;
  chemical: ReachPdfChemical;
  tonnageBand?: string | null;
};

const PDF_CONTENT_TYPE = 'application/pdf';

export type ReachCertificateDownloadFile = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  format: 'pdf';
};

function buildFreshReachDocx(input: ReachCertPdfInput): Buffer {
  return generateReachCertificateDocx(
    buildReachDocxData(input.client, input.chemical, {
      registrationNumber: input.registrationNumber,
      issuedDate: input.issuedDate,
      validatedDate: input.validatedDate,
      tonnageBand: input.tonnageBand,
    })
  );
}

/**
 * Always builds a PDF from the current EU REACH template and current field values.
 * Never serves DOCX for download.
 */
export async function resolveReachCertificateDownloadFile(
  supabase: SupabaseClient,
  input: ReachCertPdfInput
): Promise<ReachCertificateDownloadFile> {
  void supabase;
  const certNumber = input.certificateNumber;
  const freshDocx = buildFreshReachDocx(input);

  try {
    const pdfBuffer = await convertReachDocxToPdf(freshDocx);
    return {
      buffer: pdfBuffer,
      contentType: PDF_CONTENT_TYPE,
      fileName: `${certNumber}.pdf`,
      format: 'pdf',
    };
  } catch {
    throw new Error(
      'PDF conversion is not available on this server. Install LibreOffice (recommended: apt install libreoffice-writer) or set GOTENBERG_URL for document conversion.'
    );
  }
}

/** Returns a PDF buffer; throws if conversion is unavailable. */
export async function resolveReachCertificatePdfBuffer(
  supabase: SupabaseClient,
  input: ReachCertPdfInput
): Promise<Buffer> {
  const file = await resolveReachCertificateDownloadFile(supabase, input);
  return file.buffer;
}

export { generateReachPdfForClientChemical, buildReachCertificateStoredFile };
