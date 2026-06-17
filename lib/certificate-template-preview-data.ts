import type { ReachPdfChemical, ReachPdfSource } from '@/lib/reach-pdf-data';
import type { TccCertificateDocxData } from '@/services/tcc-certificate-docx';

export function getRcTemplatePreviewSample(): {
  client: ReachPdfSource;
  chemical: ReachPdfChemical;
  options: {
    registrationNumber: string;
    issuedDate: string;
    validatedDate: string;
    tonnageBand: string;
  };
} {
  return {
    client: {
      company_name: 'Ami Pharma',
      address: 'C-1/394, Phase II, G.I.D.C. Estate, Vatva',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postal_code: '382445',
      country: 'India',
      uuid_number: 'ECHA-ac4a5f61-f070-4d66-9703-96b2190cb5ba',
    },
    chemical: {
      chemical_name: '29H,31H-phthalocyaninato(2-)-N29,N30,N31,N32 copper',
      cas_number: '147-14-8',
      ec_number: '205-685-1',
      tonnage_band: '10–100 tpa',
    },
    options: {
      registrationNumber: '01-2119458771-32-0109',
      issuedDate: '2026-01-01',
      validatedDate: '2026-12-31',
      tonnageBand: '10–100 tpa',
    },
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
    uuidNumber: 'ECHA-ac4a5f61-f070-4d66-9703-96b2190cb5ba',
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
