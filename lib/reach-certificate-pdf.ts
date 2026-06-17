import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReachCertificateStoredFile,
  buildReachDocxData,
  generateReachPdfForClientChemical,
  type ReachPdfChemical,
  type ReachPdfSource,
} from '@/lib/reach-pdf-data';
import {
  resolveReachCertificatePreview,
  type ReachCertPdfInput,
} from '@/lib/reach-certificate-preview';
import { convertReachDocxToPdf, generateReachCertificateDocx } from '@/services/reach-certificate-docx';

const PDF_CONTENT_TYPE = 'application/pdf';

export type ReachCertificateDownloadFile = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  format: 'pdf';
};

export type ReachCertificateDownloadResult =
  | ReachCertificateDownloadFile
  | { format: 'docx'; docxUrl: string; fileName: string };

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
 * Resolves RC download — PDF when converter available, else public DOCX URL
 * (same file shown in Office Online preview).
 */
export async function resolveReachCertificateDownload(
  supabase: SupabaseClient,
  input: ReachCertPdfInput
): Promise<ReachCertificateDownloadResult> {
  const preview = await resolveReachCertificatePreview(supabase, input);
  if (preview.mode === 'pdf') {
    return {
      buffer: preview.buffer,
      contentType: PDF_CONTENT_TYPE,
      fileName: preview.fileName,
      format: 'pdf',
    };
  }
  return {
    format: 'docx',
    docxUrl: preview.docxUrl,
    fileName: preview.fileName.replace(/\.docx$/i, '.pdf'),
  };
}

/** Always builds a PDF from the current EU REACH template — throws when conversion unavailable. */
export async function resolveReachCertificateDownloadFile(
  supabase: SupabaseClient,
  input: ReachCertPdfInput
): Promise<ReachCertificateDownloadFile> {
  const result = await resolveReachCertificateDownload(supabase, input);
  if (result.format === 'pdf') {
    return result;
  }
  const freshDocx = buildFreshReachDocx(input);
  try {
    const pdfBuffer = await convertReachDocxToPdf(freshDocx);
    return {
      buffer: pdfBuffer,
      contentType: PDF_CONTENT_TYPE,
      fileName: result.fileName,
      format: 'pdf',
    };
  } catch {
    throw new Error(
      'PDF conversion is not available on this server. Install LibreOffice (recommended: apt install libreoffice-writer) or set GOTENBERG_URL for document conversion.'
    );
  }
}

/** Convert a public DOCX URL (Office preview file) to PDF via server-side LibreOffice/Gotenberg. */
export async function convertReachDocxUrlToPdf(
  docxUrl: string,
  fileName: string
): Promise<ReachCertificateDownloadFile> {
  let parsed: URL;
  try {
    parsed = new URL(docxUrl);
  } catch {
    throw new Error('Invalid certificate document URL.');
  }

  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
    : null;
  if (!supabaseHost || parsed.host !== supabaseHost || !parsed.pathname.includes('/certificates/')) {
    throw new Error('Certificate document URL is not allowed.');
  }

  const res = await fetch(docxUrl, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to load certificate document for PDF conversion.');
  }
  const docxBuffer = Buffer.from(await res.arrayBuffer());
  const pdfBuffer = await convertReachDocxToPdf(docxBuffer);
  return {
    buffer: pdfBuffer,
    contentType: PDF_CONTENT_TYPE,
    fileName,
    format: 'pdf',
  };
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
