import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import PizZip from 'pizzip';

const execFileAsync = promisify(execFile);

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'CT_2026.docx');
const FALLBACK_TEMPLATE_PATH = path.join(process.cwd(), 'CT_Draftr.docx');

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

/** Format as DD.MM.YYYY matching the original CT_2026 certificate. */
export function formatReachCertDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
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

function resolveTemplatePath(): string {
  if (fs.existsSync(TEMPLATE_PATH)) return TEMPLATE_PATH;
  if (fs.existsSync(FALLBACK_TEMPLATE_PATH)) return FALLBACK_TEMPLATE_PATH;
  throw new Error(
    'REACH certificate template not found. Place CT_Draftr.docx in project root and run: node scripts/prepare-reach-template.mjs'
  );
}

function applyPlaceholders(xml: string, data: ReachCertificateDocxData): string {
  const map: Record<string, string> = {
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
    '{{ISSUED_DATE}}': escapeReachXml(data.issuedDate),
    '{{VALIDATED_DATE}}': escapeReachXml(data.validatedDate),
    // Fallback replacements when template was not prepared (raw CT_Draftr.docx)
    'Fairchem Organics Limited': escapeReachXml(data.companyName),
    '253/P and 312, Village Chekhala,': escapeReachXml(data.addressLine1),
    'Sanand – Kadi Highway, Taluka SANAND,': escapeReachXml(data.addressLine2),
    'Dist. AHMEDABAD\u00a0\u2013 382 115, INDIA': `Dist. ${escapeReachXml(data.addressLine3)}`,
    'Fatty acids, C18-unsatd, dimers': escapeReachXml(data.chemicalName),
    '500-148-0': escapeReachXml(data.ecNumber),
    '61788-89-4': escapeReachXml(data.casNumber),
    '01-2119493908-18-0028': escapeReachXml(data.registrationNumber),
    '10-100 tpa': escapeReachXml(data.tonnageBand),
    'ECHA-334d8d7b-4b93-40d9-b1f3-25494dc492d6': escapeReachXml(data.uuidNumber),
  };

  let result = xml;
  for (const [key, value] of Object.entries(map)) {
    result = result.split(key).join(value);
  }

  // Replace split date runs if template still has sample dates
  const issuedSample =
    /<w:r w:rsidR="007957B7"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>01<\/w:t><\/w:r><w:r w:rsidR="00D86250"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>\.<\/w:t><\/w:r><w:r w:rsidR="007957B7"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>01<\/w:t><\/w:r><w:r w:rsidR="00F22E86"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>\.202<\/w:t><\/w:r><w:r w:rsidR="007957B7"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>6<\/w:t><\/w:r>/;
  if (issuedSample.test(result)) {
    result = result.replace(
      issuedSample,
      `<w:r w:rsidR="007957B7"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeReachXml(data.issuedDate)}</w:t></w:r>`
    );
  }

  const validatedSample =
    /<w:r w:rsidR="0014606D"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>31\.12\.202<\/w:t><\/w:r><w:r w:rsidR="007957B7"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>6<\/w:t><\/w:r>/;
  if (validatedSample.test(result)) {
    result = result.replace(
      validatedSample,
      `<w:r w:rsidR="0014606D"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeReachXml(data.validatedDate)}</w:t></w:r>`
    );
  }

  return result;
}

export function generateReachCertificateDocx(data: ReachCertificateDocxData): Buffer {
  const templatePath = resolveTemplatePath();
  const zip = new PizZip(fs.readFileSync(templatePath));
  const xml = zip.files['word/document.xml'].asText();
  zip.file('word/document.xml', applyPlaceholders(xml, data));
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

export async function generateReachCertificateFromTemplate(data: ReachCertificateDocxData): Promise<Buffer> {
  const docxBuffer = generateReachCertificateDocx(data);
  return convertReachDocxToPdf(docxBuffer);
}
