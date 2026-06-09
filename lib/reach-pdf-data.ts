import {
  buildReachAddressLines,
  formatReachCertDate,
  generateReachCertificateFromTemplate,
} from '@/services/reach-certificate-docx';

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
  }
): Promise<Buffer> {
  const address = buildReachAddressLines(client);
  return generateReachCertificateFromTemplate({
    companyName: client.company_name,
    addressLine1: address.line1,
    addressLine2: address.line2,
    addressLine3: address.line3,
    chemicalName: chemical.chemical_name,
    ecNumber: chemical.ec_number || '—',
    casNumber: chemical.cas_number,
    registrationNumber: options.registrationNumber.trim(),
    tonnageBand: chemical.tonnage_band || '—',
    uuidNumber: client.uuid_number || '—',
    issuedDate: formatReachCertDate(options.issuedDate),
    validatedDate: formatReachCertDate(options.validatedDate),
  });
}
