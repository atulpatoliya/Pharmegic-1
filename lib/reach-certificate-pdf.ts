import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReachCertificateStoredFile,
  buildReachDocxData,
  generateReachPdfForClientChemical,
  type ReachPdfChemical,
  type ReachPdfSource,
} from '@/lib/reach-pdf-data';
import { generateReachCertificateDocx } from '@/services/reach-certificate-docx';
import { resolveReachCertificatePreview } from '@/lib/reach-certificate-preview';

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

export type ReachCertificateDownloadFile =
  | {
      buffer: Buffer;
      contentType: string;
      fileName: string;
      format: 'pdf';
    }
  | {
      buffer: Buffer;
      contentType: string;
      fileName: string;
      format: 'docx';
      docxUrl: string | null;
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
 * Always builds from the current EU REACH template and current field values.
 * Never serves stale files from storage.
 */
export async function resolveReachCertificateDownloadFile(
  supabase: SupabaseClient,
  input: ReachCertPdfInput
): Promise<ReachCertificateDownloadFile> {
  const certNumber = input.certificateNumber;
  const result = await resolveReachCertificatePreview(supabase, input);

  if (result.mode === 'pdf') {
    return {
      buffer: result.buffer,
      contentType: PDF_CONTENT_TYPE,
      fileName: result.fileName,
      format: 'pdf',
    };
  }

  const freshDocx = buildFreshReachDocx(input);
  return {
    buffer: freshDocx,
    contentType: DOCX_CONTENT_TYPE,
    fileName: `${certNumber}.docx`,
    format: 'docx',
    docxUrl: result.docxUrl,
  };
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
