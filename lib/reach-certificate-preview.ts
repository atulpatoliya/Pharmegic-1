import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReachDocxData,
  type ReachPdfChemical,
  type ReachPdfSource,
} from '@/lib/reach-pdf-data';
import {
  DOCX_CONTENT_TYPE,
  PDF_CONTENT_TYPE,
  downloadReachCertificateFile,
  uploadReachCertificateFile,
} from '@/lib/reach-certificate-storage';
import {
  convertReachDocxToPdf,
  generateReachCertificateDocx,
} from '@/services/reach-certificate-docx';

export type ReachCertPdfInput = {
  certificateNumber: string;
  registrationNumber: string;
  issuedDate: string;
  validatedDate: string;
  client: ReachPdfSource;
  chemical: ReachPdfChemical;
  tonnageBand?: string | null;
};

export type ReachCertificatePreviewResult =
  | { mode: 'pdf'; buffer: Buffer; fileName: string }
  | { mode: 'docx'; docxUrl: string; fileName: string };

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
 * Resolves RC preview: PDF when possible, else uploads full-layout DOCX to storage
 * for Office Online embed (no error when server lacks LibreOffice/Gotenberg).
 */
export async function resolveReachCertificatePreview(
  supabase: SupabaseClient,
  input: ReachCertPdfInput
): Promise<ReachCertificatePreviewResult> {
  const certNumber = input.certificateNumber;
  const freshDocx = buildFreshReachDocx(input);
  const pdfFileName = `${certNumber}.pdf`;
  const docxFileName = `${certNumber}.docx`;

  try {
    const pdfBuffer = await convertReachDocxToPdf(freshDocx);
    void uploadReachCertificateFile(supabase, pdfFileName, pdfBuffer, PDF_CONTENT_TYPE);
    return { mode: 'pdf', buffer: pdfBuffer, fileName: pdfFileName };
  } catch {
    const storedPdf = await downloadReachCertificateFile(supabase, pdfFileName);
    if (storedPdf) {
      return { mode: 'pdf', buffer: storedPdf, fileName: pdfFileName };
    }
  }

  const docxUrl = await uploadReachCertificateFile(
    supabase,
    docxFileName,
    freshDocx,
    DOCX_CONTENT_TYPE
  );

  if (docxUrl) {
    return { mode: 'docx', docxUrl, fileName: docxFileName };
  }

  throw new Error('Certificate preview is temporarily unavailable. Please try again.');
}

/** Returns PDF buffer when possible; throws only when preview cannot be produced at all. */
export async function resolveReachCertificatePdfBuffer(
  supabase: SupabaseClient,
  input: ReachCertPdfInput
): Promise<Buffer> {
  const result = await resolveReachCertificatePreview(supabase, input);
  if (result.mode !== 'pdf') {
    throw new Error(
      'PDF conversion is not available on this server. Install LibreOffice or set GOTENBERG_URL.'
    );
  }
  return result.buffer;
}
