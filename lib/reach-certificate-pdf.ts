import type { SupabaseClient } from '@supabase/supabase-js';
import { buildReachDocxData } from '@/lib/reach-pdf-data';
import {
  resolveReachCertificatePreview,
  type ReachCertPdfInput,
} from '@/lib/reach-certificate-preview';
import { generateReachCertificateHtmlPdf } from '@/lib/reach-certificate-html-pdf-server';
import type { LoadedReachCertificateInput } from '@/lib/reach-certificate-api-input';
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
 * Resolves RC download — Puppeteer HTML PDF when possible, else public DOCX URL.
 */
export async function resolveReachCertificateDownload(
  supabase: SupabaseClient,
  input: ReachCertPdfInput & LoadedReachCertificateInput
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

/** Always builds a PDF from the HTML certificate template — throws when generation unavailable. */
export async function resolveReachCertificateDownloadFile(
  supabase: SupabaseClient,
  input: ReachCertPdfInput & LoadedReachCertificateInput
): Promise<ReachCertificateDownloadFile> {
  try {
    const pdfBuffer = await generateReachCertificateHtmlPdf(input);
    return {
      buffer: pdfBuffer,
      contentType: PDF_CONTENT_TYPE,
      fileName: `${input.certificateNumber}.pdf`,
      format: 'pdf',
    };
  } catch (htmlErr) {
    const freshDocx = buildFreshReachDocx(input);
    try {
      const pdfBuffer = await convertReachDocxToPdf(freshDocx);
      return {
        buffer: pdfBuffer,
        contentType: PDF_CONTENT_TYPE,
        fileName: `${input.certificateNumber}.pdf`,
        format: 'pdf',
      };
    } catch {
      const message =
        htmlErr instanceof Error
          ? htmlErr.message
          : 'PDF generation is not available on this server.';
      throw new Error(message);
    }
  }
}

/** Convert a public DOCX URL (Office preview file) to PDF via server-side LibreOffice. */
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
  input: ReachCertPdfInput & LoadedReachCertificateInput
): Promise<Buffer> {
  const file = await resolveReachCertificateDownloadFile(supabase, input);
  return file.buffer;
}

export { generateReachPdfForClientChemical, buildReachCertificateStoredFile } from '@/lib/reach-pdf-data';
