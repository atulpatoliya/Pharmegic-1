import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import {
  buildReachAddressLines,
  convertReachDocxToPdf,
  escapeReachXml,
  formatReachCertDate,
} from '@/services/reach-certificate-docx';

export { convertReachDocxToPdf as convertTccDocxToPdf, formatReachCertDate as formatTccCertDate };

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'TCC_2026.docx');
const FALLBACK_TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'TCC-Demo.docx');

export type TccCertificateDocxData = {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  exporterFullAddress: string;
  chemicalName: string;
  ecNumber: string;
  casNumber: string;
  registrationNumber: string;
  tonnageBand: string;
  uuidNumber: string;
  euImporterName: string;
  euImporterAddr1: string;
  euImporterAddr2: string;
  euImporterAddr3: string;
  volumeMt: string;
  deliveryChallanNo: string;
  exportDate: string;
  validUntilDate: string;
};

function resolveTemplatePath(): string {
  if (fs.existsSync(TEMPLATE_PATH)) return TEMPLATE_PATH;
  if (fs.existsSync(FALLBACK_TEMPLATE_PATH)) return FALLBACK_TEMPLATE_PATH;
  throw new Error(
    'TCC certificate template not found. Place templates/TCC-Demo.docx and run: node scripts/prepare-tcc-template.mjs'
  );
}

function applyPlaceholders(xml: string, data: TccCertificateDocxData): string {
  const map: Record<string, string> = {
    '{{COMPANY_NAME}}': escapeReachXml(data.companyName),
    '{{ADDR_LINE1}}': escapeReachXml(data.addressLine1),
    '{{ADDR_LINE2}}': escapeReachXml(data.addressLine2),
    '{{ADDR_LINE3}}': escapeReachXml(data.addressLine3),
    '{{EXPORTER_FULL_ADDRESS}}': escapeReachXml(data.exporterFullAddress),
    '{{CHEMICAL_NAME}}': escapeReachXml(data.chemicalName),
    '{{EC_NUMBER}}': escapeReachXml(data.ecNumber),
    '{{CAS_NUMBER}}': escapeReachXml(data.casNumber),
    '{{REGISTRATION_NUMBER}}': escapeReachXml(data.registrationNumber),
    '{{TONNAGE_BAND}}': escapeReachXml(data.tonnageBand),
    '{{UUID_NUMBER}}': escapeReachXml(data.uuidNumber),
    '{{EU_IMPORTER_NAME}}': escapeReachXml(data.euImporterName),
    '{{EU_IMPORTER_ADDR1}}': escapeReachXml(data.euImporterAddr1),
    '{{EU_IMPORTER_ADDR2}}': escapeReachXml(data.euImporterAddr2),
    '{{EU_IMPORTER_ADDR3}}': escapeReachXml(data.euImporterAddr3),
    '{{VOLUME_MT}}': escapeReachXml(data.volumeMt),
    '{{DELIVERY_CHALLAN_NO}}': escapeReachXml(data.deliveryChallanNo),
    '{{EXPORT_DATE}}': escapeReachXml(data.exportDate),
    '{{VALID_UNTIL_DATE}}': escapeReachXml(data.validUntilDate),
  };

  let result = xml;
  for (const [key, value] of Object.entries(map)) {
    result = result.split(key).join(value);
  }

  return result;
}

export function generateTccCertificateDocx(data: TccCertificateDocxData): Buffer {
  const templatePath = resolveTemplatePath();
  const zip = new PizZip(fs.readFileSync(templatePath));
  const xml = zip.files['word/document.xml'].asText();
  zip.file('word/document.xml', applyPlaceholders(xml, data));
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export function buildTccExporterFullAddress(client: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}): string {
  const address = buildReachAddressLines(client);
  return [address.line1, address.line2, `Dist. ${address.line3}`].filter(Boolean).join(' ');
}

export function parseEuImporterFields(remarks?: string | null, kkdikRegNo?: string | null): {
  name: string;
  addr1: string;
  addr2: string;
  addr3: string;
} {
  const lines = (remarks || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length >= 2) {
    return {
      name: lines[0],
      addr1: lines[1] || '—',
      addr2: lines[2] || '—',
      addr3: lines.slice(3).join(', ') || '—',
    };
  }

  if (kkdikRegNo?.trim()) {
    return {
      name: kkdikRegNo.trim(),
      addr1: '—',
      addr2: '—',
      addr3: '—',
    };
  }

  return {
    name: '—',
    addr1: '—',
    addr2: '—',
    addr3: '—',
  };
}
