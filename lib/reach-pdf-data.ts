import {
  buildReachAddressLines,
  formatReachCertDate,
  generateReachCertificateDocx,
  convertReachDocxToPdf,
  type ReachCertificateDocxData,
} from '@/services/reach-certificate-docx';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type ReachCertificateStoredFile = {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  format: 'pdf' | 'docx';
};

function buildReachDocxData(
  client: ReachPdfSource,
  chemical: ReachPdfChemical,
  options: {
    registrationNumber: string;
    issuedDate: string;
    validatedDate: string;
    tonnageBand?: string | null;
  }
): ReachCertificateDocxData {
  const address = buildReachAddressLines(client);
  return {
    companyName: client.company_name,
    addressLine1: address.line1,
    addressLine2: address.line2,
    addressLine3: address.line3,
    chemicalName: chemical.chemical_name,
    ecNumber: chemical.ec_number || '—',
    casNumber: chemical.cas_number,
    registrationNumber: options.registrationNumber.trim(),
    tonnageBand: options.tonnageBand || chemical.tonnage_band || '—',
    uuidNumber: client.uuid_number || '—',
    issuedDate: formatReachCertDate(options.issuedDate),
    validatedDate: formatReachCertDate(options.validatedDate),
  };
}

export type ReachPdfSource = {
  company_name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  uuid_number?: string | null;
};

export type ReachPdfChemical = {
  chemical_name: string;
  cas_number: string;
  ec_number?: string | null;
  tonnage_band?: string | null;
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

/** Build certificate file for storage — PDF when converter available, otherwise DOCX. */
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
