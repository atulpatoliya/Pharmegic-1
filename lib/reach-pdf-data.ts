import {
  buildReachDocxData,
  type ReachCertificateDocxData,
  type ReachPdfChemical,
  type ReachPdfSource,
} from '@/lib/reach-certificate-data';
import {
  generateReachCertificateDocx,
  convertReachDocxToPdf,
} from '@/services/reach-certificate-docx';

export type { ReachCertificateDocxData, ReachPdfChemical, ReachPdfSource } from '@/lib/reach-certificate-data';
export { buildReachDocxData } from '@/lib/reach-certificate-data';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type ReachCertificateStoredFile = {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  format: 'pdf' | 'docx';
};

export async function generateReachPdfForClientChemical(
  client: ReachPdfSource,
  chemical: ReachPdfChemical,
  options: {
    registrationNumber: string;
    issuedDate: string;
    validatedDate: string;
    tonnageBand?: string | null;
  }
): Promise<Buffer> {
  const docxBuffer = generateReachCertificateDocx(buildReachDocxData(client, chemical, options));
  return convertReachDocxToPdf(docxBuffer);
}

/** Build certificate file for storage — PDF when converter available, else DOCX for preview/embed. */
export async function buildReachCertificateStoredFile(
  client: ReachPdfSource,
  chemical: ReachPdfChemical,
  certNumber: string,
  options: {
    registrationNumber: string;
    issuedDate: string;
    validatedDate: string;
    tonnageBand?: string | null;
  }
): Promise<ReachCertificateStoredFile> {
  const docxBuffer = generateReachCertificateDocx(buildReachDocxData(client, chemical, options));

  try {
    const pdfBuffer = await convertReachDocxToPdf(docxBuffer);
    return {
      buffer: pdfBuffer,
      fileName: `${certNumber}.pdf`,
      contentType: 'application/pdf',
      format: 'pdf',
    };
  } catch {
    return {
      buffer: docxBuffer,
      fileName: `${certNumber}.docx`,
      contentType: DOCX_CONTENT_TYPE,
      format: 'docx',
    };
  }
}
