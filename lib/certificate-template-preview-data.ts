import type { CertificateTemplateKey } from '@/lib/certificate-template-config';
import type { ReachPdfChemical, ReachPdfSource } from '@/lib/reach-pdf-data';
import type { TccCertificateDocxData } from '@/services/tcc-certificate-docx';

const RC_TEMPLATE_1_PREVIEW_SAMPLE = {
  client: {
    company_name: 'Example Pharma Ltd',
    address: 'C-1/394, Phase II, G.I.D.C. Estate, Vatva',
    city: 'Ahmedabad',
    state: 'Gujarat',
    postal_code: '382445',
    country: 'India',
    uuid_number: 'ECHA-00000000-0000-4000-8000-000000000001',
  },
  chemical: {
    chemical_name: 'Ethylene Glycol Monoethyl Ether',
    cas_number: '110-80-2',
    ec_number: '203-787-0',
    tonnage_band: '10-100 tpa',
  },
  options: {
    registrationNumber: '01-2119493908-18-0028',
    issuedDate: '2026-01-01',
    validatedDate: '2026-12-31',
    tonnageBand: '10-100 tpa',
  },
} as const;

const RC_TEMPLATE_2_PREVIEW_SAMPLE = {
  client: {
    company_name: 'Example Pharma Ltd',
    address: '123 Industrial Estate, Sample Road',
    city: 'Ahmedabad',
    state: 'Gujarat',
    postal_code: '382445',
    country: 'India',
    uuid_number: 'ECHA-00000000-0000-4000-8000-000000000002',
  },
  chemical: {
    chemical_name: 'Example Chemical Substance',
    cas_number: '000-00-0',
    ec_number: '000-000-0',
    tonnage_band: '10–100 tpa',
  },
  options: {
    registrationNumber: '01-2119000000-00-0000',
    issuedDate: '2026-01-01',
    validatedDate: '2026-12-31',
    tonnageBand: '10–100 tpa',
  },
} as const;

export function getRcTemplatePreviewSample(
  templateKey: CertificateTemplateKey = 'template_1'
): {
  client: ReachPdfSource;
  chemical: ReachPdfChemical;
  options: {
    registrationNumber: string;
    issuedDate: string;
    validatedDate: string;
    tonnageBand: string;
  };
} {
  const sample =
    templateKey === 'template_2' ? RC_TEMPLATE_2_PREVIEW_SAMPLE : RC_TEMPLATE_1_PREVIEW_SAMPLE;

  return {
    client: { ...sample.client },
    chemical: { ...sample.chemical },
    options: { ...sample.options },
  };
}

export function getTccTemplatePreviewSample(): TccCertificateDocxData {
  return {
    companyName: 'Example Pharma Ltd',
    addressLine1: 'C-1/394, Phase II, G.I.D.C. Estate, Vatva',
    addressLine2: 'Ahmedabad, Gujarat',
    addressLine3: 'Ahmedabad – 382445, India',
    exporterFullAddress:
      'Example Pharma Ltd, C-1/394, Phase II, G.I.D.C. Estate, Vatva, Ahmedabad – 382445, India',
    chemicalName: 'Ethylene Glycol Monoethyl Ether',
    ecNumber: '203-787-0',
    casNumber: '110-80-2',
    registrationNumber: '01-2119493908-18-0028',
    tonnageBand: '10-100 tpa',
    uuidNumber: 'ECHA-00000000-0000-4000-8000-000000000001',
    euImporterName: 'EU Importer GmbH',
    euImporterAddr1: 'Industriestrasse 12',
    euImporterAddr2: '60329 Frankfurt',
    euImporterAddr3: 'Germany',
    volumeMt: '25.00',
    deliveryChallanNo: 'DC-2026-001',
    exportDate: '15.03.2026',
    validUntilDate: '31.12.2026',
  };
}
