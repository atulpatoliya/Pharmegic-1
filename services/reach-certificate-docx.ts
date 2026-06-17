import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import PizZip from 'pizzip';
import { EU_REACH_TEMPLATE } from '@/lib/eu-reach-certificate-template';

const execFileAsync = promisify(execFile);

export type ReachCertificateDocxData = {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  chemicalName: string;
  ecNumber: string;
  casNumber: string;
  registrationNumber: string;
  tonnageBand: string;
  uuidNumber: string;
  issuedDate: string;
  validatedDate: string;
};

export function escapeReachXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Format as DD.MM.YYYY (used by TCC certificates). */
export function formatReachCertDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

/** Format as "1 January 2026" for EU REACH certificate. */
export function formatReachCertDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** EU REACH: "Street, City: Postal," on one line; country on the next. */
export function buildEuReachAddressLine1(client: {
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
}): string {
  const street = client.address?.trim();
  const city = client.city?.trim();
  const postal = client.postal_code?.trim();

  const parts: string[] = [];
  if (street) parts.push(street);

  if (city && postal) {
    parts.push(`${city}: ${postal}`);
  } else if (city) {
    parts.push(city);
  } else if (postal) {
    parts.push(postal);
  }

  if (parts.length === 0) return '—';
  return `${parts.join(', ')},`;
}

export function buildReachAddressLines(client: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}): { line1: string; line2: string; line3: string } {
  const cityState = [client.city, client.state].filter(Boolean).join(', ');
  const cityPostal =
    client.city && client.postal_code
      ? `${client.city} – ${client.postal_code}`
      : [client.city, client.postal_code].filter(Boolean).join(' – ');
  const line3 = [cityPostal, client.country].filter(Boolean).join(', ');

  return {
    line1: client.address?.trim() || '—',
    line2: cityState || '—',
    line3: line3 || '—',
  };
}

function resolveTemplatePath(browserPreview = false): string {
  if (browserPreview && fs.existsSync(EU_REACH_TEMPLATE.browserPreview)) {
    return EU_REACH_TEMPLATE.browserPreview;
  }
  if (fs.existsSync(EU_REACH_TEMPLATE.runtime)) return EU_REACH_TEMPLATE.runtime;
  throw new Error(
    'EU REACH certificate template not found. Copy your Word file to templates/source/EU_REACH_SOURCE.docx and run: node scripts/prepare-eu-reach-template.mjs'
  );
}

function buildPlaceholderMap(data: ReachCertificateDocxData): Record<string, string> {
  return {
    '{{COMPANY_NAME}}': escapeReachXml(data.companyName),
    '{{ADDR_LINE1}}': escapeReachXml(data.addressLine1),
    '{{ADDR_LINE2}}': escapeReachXml(data.addressLine2),
    '{{ADDR_LINE3}}': escapeReachXml(data.addressLine3),
    '{{CHEMICAL_NAME}}': escapeReachXml(data.chemicalName),
    '{{EC_NUMBER}}': escapeReachXml(data.ecNumber),
    '{{CAS_NUMBER}}': escapeReachXml(data.casNumber),
    '{{REGISTRATION_NUMBER}}': escapeReachXml(data.registrationNumber),
    '{{TONNAGE_BAND}}': escapeReachXml(data.tonnageBand),
    '{{UUID_NUMBER}}': escapeReachXml(data.uuidNumber),
    '{{ISSUED_DATE}}': escapeReachXml(formatReachCertDateLong(data.issuedDate)),
    '{{VALIDATED_DATE}}': escapeReachXml(formatReachCertDateLong(data.validatedDate)),
  };
}

function applyPlaceholders(xml: string, data: ReachCertificateDocxData): string {
  const map = buildPlaceholderMap(data);
  let result = xml;
  for (const [key, value] of Object.entries(map)) {
    result = result.split(key).join(value);
  }
  return result;
}

export function generateReachCertificateDocx(
  data: ReachCertificateDocxData,
  options?: { browserPreview?: boolean }
): Buffer {
  const templatePath = resolveTemplatePath(options?.browserPreview === true);
  const zip = new PizZip(fs.readFileSync(templatePath));
  const xml = applyPlaceholders(zip.files['word/document.xml'].asText(), data);
  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

const LIBREOFFICE_PATHS = [
  'soffice',
  'libreoffice',
  '/usr/bin/soffice',
  '/usr/bin/libreoffice',
  '/snap/bin/libreoffice',
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
];

/** True when server-side DOCX→PDF conversion is likely available. */
export function isReachPdfConversionAvailable(): boolean {
  if (process.env.GOTENBERG_URL?.trim()) return true;
  if (process.platform === 'win32') return true;
  for (const bin of LIBREOFFICE_PATHS) {
    if (bin.includes('/') && fs.existsSync(bin)) return true;
  }
  return false;
}

async function convertWithLibreOfficeCli(docxPath: string, outDir: string): Promise<string> {
  let lastError: Error | null = null;
  for (const bin of LIBREOFFICE_PATHS) {
    try {
      await execFileAsync(
        bin,
        ['--headless', '--convert-to', 'pdf', '--outdir', outDir, docxPath],
        { timeout: 120000 }
      );
      const pdfPath = path.join(outDir, `${path.basename(docxPath, '.docx')}.pdf`);
      if (fs.existsSync(pdfPath)) return pdfPath;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('LibreOffice not found.');
}

async function convertWithLibreOfficeConvert(docxBuffer: Buffer): Promise<Buffer> {
  const libre = await import('libreoffice-convert');
  const convertAsync = (buf: Buffer, ext: string, filter: undefined) =>
    new Promise<Buffer>((resolve, reject) => {
      libre.default.convert(buf, ext, filter, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  return convertAsync(docxBuffer, '.pdf', undefined);
}

async function convertWithWordCom(docxPath: string, pdfPath: string): Promise<void> {
  const ps = `
$ErrorActionPreference = 'Stop'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open('${docxPath.replace(/'/g, "''")}')
$wdFormatPDF = 17
$doc.SaveAs([ref]'${pdfPath.replace(/'/g, "''")}', [ref]$wdFormatPDF)
$doc.Close([ref]$false)
try { $word.Quit() } catch {}
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
[GC]::Collect()
`;
  await execFileAsync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
    timeout: 120000,
  });
}

async function convertWithGotenberg(docxBuffer: Buffer): Promise<Buffer> {
  const baseUrl = process.env.GOTENBERG_URL?.replace(/\/$/, '');
  if (!baseUrl) throw new Error('Gotenberg not configured.');

  const formData = new FormData();
  formData.append('files', new Blob([new Uint8Array(docxBuffer)]), 'certificate.docx');

  const res = await fetch(`${baseUrl}/forms/libreoffice/convert`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Gotenberg conversion failed (${res.status}).`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function convertReachDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const id = randomUUID();
  const workDir = path.join(tmpdir(), `reach-${id}`);
  const docxPath = path.join(workDir, 'certificate.docx');
  const pdfPath = path.join(workDir, 'certificate.pdf');
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(docxPath, docxBuffer);

  try {
    if (process.env.GOTENBERG_URL) {
      try {
        return await convertWithGotenberg(docxBuffer);
      } catch {
        // fall through to local converters
      }
    }

    try {
      const cliPdf = await convertWithLibreOfficeCli(docxPath, workDir);
      return fs.readFileSync(cliPdf);
    } catch {
      // try libreoffice-convert npm wrapper
    }

    try {
      return await convertWithLibreOfficeConvert(docxBuffer);
    } catch {
      // try Word COM on Windows
    }

    if (process.platform === 'win32') {
      try {
        await convertWithWordCom(docxPath, pdfPath);
        if (fs.existsSync(pdfPath)) {
          return fs.readFileSync(pdfPath);
        }
      } catch {
        // fall through
      }
    }

    throw new Error(
      'PDF conversion is not available on this server. Install LibreOffice (recommended: apt install libreoffice-writer) or set GOTENBERG_URL for document conversion.'
    );
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

export { EU_REACH_TEMPLATE };
export const BUNDLED_RC_PREVIEW_PDF = EU_REACH_TEMPLATE.bundledPreviewPdf;

export async function generateReachCertificateFromTemplate(data: ReachCertificateDocxData): Promise<Buffer> {
  const docxBuffer = generateReachCertificateDocx(data);
  return convertReachDocxToPdf(docxBuffer);
}
