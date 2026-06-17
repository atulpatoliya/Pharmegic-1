import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReachCertificateStoredFile,
  buildReachDocxData,
  generateReachPdfForClientChemical,
  type ReachPdfChemical,
  type ReachPdfSource,
} from '@/lib/reach-pdf-data';
import { CERTIFICATES_BUCKET } from '@/lib/storage';
import {
  convertReachDocxToPdf,
  generateReachCertificateDocx,
} from '@/services/reach-certificate-docx';

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
const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type ReachCertificateDownloadFile = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  format: 'pdf' | 'docx';
};

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
  return generateReachCertificateDocx(
    buildReachDocxData(input.client, input.chemical, {
      registrationNumber: input.registrationNumber,
      issuedDate: input.issuedDate,
      validatedDate: input.validatedDate,
      tonnageBand: input.tonnageBand,
    })
  );
}

async function tryConvertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  return convertReachDocxToPdf(docxBuffer);
}

/**
 * Always builds from the current EU REACH template.
 * Never serves stale files from storage (old Template 1 PDFs/DOCXs).
 */
export async function resolveReachCertificateDownloadFile(
  supabase: SupabaseClient,
  input: ReachCertPdfInput
): Promise<ReachCertificateDownloadFile> {
  const certNumber = input.certificateNumber;
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
