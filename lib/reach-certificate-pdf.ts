import type { SupabaseClient } from '@supabase/supabase-js';
import { generateReachPdfForClientChemical, type ReachPdfChemical, type ReachPdfSource } from '@/lib/reach-pdf-data';
import { CERTIFICATES_BUCKET } from '@/lib/storage';
import { convertReachDocxToPdf } from '@/services/reach-certificate-docx';

type ReachCertPdfInput = {
  certificateNumber: string;
  registrationNumber: string;
  issuedDate: string;
  validatedDate: string;
  client: ReachPdfSource;
  chemical: ReachPdfChemical;
};

async function downloadStorageFile(
  supabase: SupabaseClient,
  fileName: string
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(CERTIFICATES_BUCKET).download(fileName);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Always returns a PDF buffer — uses stored PDF, converts stored DOCX, or regenerates from template data. */
export async function resolveReachCertificatePdfBuffer(
  supabase: SupabaseClient,
  input: ReachCertPdfInput
): Promise<Buffer> {
  const pdfBuffer = await downloadStorageFile(supabase, `${input.certificateNumber}.pdf`);
  if (pdfBuffer) return pdfBuffer;

  const docxBuffer = await downloadStorageFile(supabase, `${input.certificateNumber}.docx`);
  if (docxBuffer) {
    try {
      return await convertReachDocxToPdf(docxBuffer);
    } catch {
      // Fall through to fresh generation from template data.
    }
  }

  return generateReachPdfForClientChemical(input.client, input.chemical, {
    registrationNumber: input.registrationNumber,
    issuedDate: input.issuedDate,
    validatedDate: input.validatedDate,
  });
}
