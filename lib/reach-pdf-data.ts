import {
  buildEuReachAddressLine1,
  buildReachAddressLines,
  generateReachCertificateDocx,
  convertReachDocxToPdf,
  type ReachCertificateDocxData,
} from '@/services/reach-certificate-docx';
import { normalizeReachDisplayValue, resolveReachTonnageBand } from '@/lib/reach-certificate-fields';

export type ReachCertificateStoredFile = {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  format: 'pdf';
};

export function buildReachDocxData(
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
  const issuedIso = options.issuedDate.split('T')[0];
  const validatedIso = options.validatedDate.split('T')[0];
  const tonnage = resolveReachTonnageBand(options.tonnageBand, chemical.tonnage_band);
  return {
    companyName: normalizeReachDisplayValue(client.company_name),
    addressLine1: buildEuReachAddressLine1(client),
    addressLine2: normalizeReachDisplayValue(address.line2),
    addressLine3: normalizeReachDisplayValue(client.country),
    chemicalName: normalizeReachDisplayValue(chemical.chemical_name),
    ecNumber: normalizeReachDisplayValue(chemical.ec_number),
    casNumber: normalizeReachDisplayValue(chemical.cas_number),
    registrationNumber: normalizeReachDisplayValue(options.registrationNumber),
    tonnageBand: normalizeReachDisplayValue(tonnage),
    uuidNumber: normalizeReachDisplayValue(client.uuid_number),
    issuedDate: issuedIso,
    validatedDate: validatedIso,
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

/** Build certificate PDF for storage — requires server-side DOCX→PDF converter. */
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

  const pdfBuffer = await convertReachDocxToPdf(docxBuffer);
  return {
    buffer: pdfBuffer,
    fileName: `${certNumber}.pdf`,
    contentType: 'application/pdf',
    format: 'pdf',
  };
}
