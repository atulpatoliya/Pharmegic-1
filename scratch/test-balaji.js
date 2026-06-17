import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const DATA = {
  companyName: 'Balaji Amines',
  addressLine1: 'Part 3, 12th Floor, Damji Shamji Tower, LBS Marg, Ghatkopar West, Mumbai: 400086,',
  addressLine3: 'India',
  chemicalName: '1-ethylpyrrolidin-2-one',
  casNumber: '2687-91-4',
  ecNumber: '220-250-6',
  tonnageBand: 'None',
  registrationNumber: 'TEST-REG',
  uuidNumber: 'ECHA-9fbb305d-529a-4d3f-9bed-3a9bca1ada56',
  issuedDate: '1 January 2026',
  validatedDate: '31 December 2026',
};

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function convert() {
  const root = process.cwd();
  const templatePath = path.join(root, 'templates', 'EU_REACH_CERTIFICATE.docx');
  const docxOut = path.join(root, 'scratch', 'balaji.docx');
  const pdfOut = path.join(root, 'scratch', 'balaji.pdf');
  const scratchDir = path.join(root, 'scratch');
  
  const zip = new PizZip(fs.readFileSync(templatePath));
  let xml = zip.files['word/document.xml'].asText();
  
  const map = {
    '{{COMPANY_NAME}}': escapeXml(DATA.companyName),
    '{{ADDR_LINE1}}': escapeXml(DATA.addressLine1),
    '{{ADDR_LINE2}}': escapeXml('Maharashtra'),
    '{{ADDR_LINE3}}': escapeXml(DATA.addressLine3),
    '{{CHEMICAL_NAME}}': escapeXml(DATA.chemicalName),
    '{{EC_NUMBER}}': escapeXml(DATA.ecNumber),
    '{{CAS_NUMBER}}': escapeXml(DATA.casNumber),
    '{{REGISTRATION_NUMBER}}': escapeXml(DATA.registrationNumber),
    '{{TONNAGE_BAND}}': escapeXml(DATA.tonnageBand),
    '{{UUID_NUMBER}}': escapeXml(DATA.uuidNumber),
    '{{ISSUED_DATE}}': escapeXml(DATA.issuedDate),
    '{{VALIDATED_DATE}}': escapeXml(DATA.validatedDate),
  };

  for (const [key, value] of Object.entries(map)) {
    xml = xml.split(key).join(value);
  }
  
  zip.file('word/document.xml', xml);
  fs.writeFileSync(docxOut, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  
  console.log('balaji.docx written');
  
  const bin = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
  try {
    await execFileAsync(bin, ['--headless', '--convert-to', 'pdf', '--outdir', scratchDir, docxOut], {
      timeout: 120000,
    });
    console.log('PDF generated via LibreOffice');
    
    const pdf = fs.readFileSync(pdfOut, 'utf8');
    const pages = pdf.match(/\/Type\s*\/Page\b/g);
    console.log('Generated PDF Page Count:', pages ? pages.length : 0);
  } catch (err) {
    console.error('LibreOffice failed:', err.message);
  }
}

convert();
