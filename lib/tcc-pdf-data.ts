import {
  buildTccExporterFullAddress,
  convertTccDocxToPdf,
  formatTccCertDate,
  generateTccCertificateDocx,
  parseEuImporterFields,
  type TccCertificateDocxData,
} from '@/services/tcc-certificate-docx';
import { buildReachAddressLines } from '@/services/reach-certificate-docx';
import { getTodayDateString } from '@/lib/reach-certificate';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type TccCertificateStoredFile = {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  format: 'pdf' | 'docx';
};

export type TccPdfClient = {
  company_name: string;
  uuid_number?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type TccPdfChemical = {
  chemical_name: string;
  cas_number: string;
  ec_number?: string | null;
  tonnage_band?: string | null;
};

export type TccPdfApplication = {
  quantity_mt: number;
  export_date?: string | null;
  tracking_id?: string | null;
  kkdik_reg_no?: string | null;
  remarks?: string | null;
};

export function buildTccDocxData(input: {
  client: TccPdfClient;
  chemical: TccPdfChemical;
  application: TccPdfApplication;
  registrationNumber?: string | null;
  validUntilDate: string;
  deliveryChallanNo?: string | null;
}): TccCertificateDocxData {
  const address = buildReachAddressLines(input.client);
  const euImporter = parseEuImporterFields(input.application.remarks, input.application.kkdik_reg_no);
  const exportDateRaw = input.application.export_date || getTodayDateString();

  return {
    companyName: input.client.company_name,
    addressLine1: address.line1,
    addressLine2: address.line2,
    addressLine3: address.line3,
    exporterFullAddress: buildTccExporterFullAddress(input.client),
    chemicalName: input.chemical.chemical_name,
    ecNumber: input.chemical.ec_number || '—',
    casNumber: input.chemical.cas_number,
    registrationNumber: input.registrationNumber?.trim() || '—',
    tonnageBand: input.chemical.tonnage_band || '—',
    uuidNumber: input.client.uuid_number || '—',
    euImporterName: euImporter.name,
    euImporterAddr1: euImporter.addr1,
    euImporterAddr2: euImporter.addr2,
    euImporterAddr3: euImporter.addr3,
    volumeMt: `${Number(input.application.quantity_mt)} MT`,
    deliveryChallanNo:
      input.deliveryChallanNo?.trim() ||
      input.application.tracking_id?.trim() ||
      '—',
    exportDate: formatTccCertDate(exportDateRaw),
    validUntilDate: formatTccCertDate(input.validUntilDate),
  };
}

export async function buildTccCertificateStoredFile(
  input: {
    certNumber: string;
    client: TccPdfClient;
    chemical: TccPdfChemical;
    application: TccPdfApplication;
    registrationNumber?: string | null;
    validUntilDate: string;
    deliveryChallanNo?: string | null;
  }
): Promise<TccCertificateStoredFile> {
  const docxBuffer = generateTccCertificateDocx(buildTccDocxData(input));

  try {
    const pdfBuffer = await convertTccDocxToPdf(docxBuffer);
    return {
      buffer: pdfBuffer,
      fileName: `${input.certNumber}.pdf`,
      contentType: 'application/pdf',
      format: 'pdf',
    };
  } catch {
    return {
      buffer: docxBuffer,
      fileName: `${input.certNumber}.docx`,
      contentType: DOCX_CONTENT_TYPE,
      format: 'docx',
    };
  }
}

export async function generateTccPdfForApplication(
  input: Parameters<typeof buildTccDocxData>[0]
): Promise<Buffer> {
  const docxBuffer = generateTccCertificateDocx(buildTccDocxData(input));
  return convertTccDocxToPdf(docxBuffer);
}
