/**
 * One-time script: converts CT_Draftr.docx sample values into merge placeholders.
 * Run: node scripts/prepare-reach-template.mjs
 */
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const root = process.cwd();
const source = path.join(root, 'CT_Draftr.docx');
const outDir = path.join(root, 'templates');
const target = path.join(outDir, 'CT_2026.docx');

if (!fs.existsSync(source)) {
  console.error('CT_Draftr.docx not found at project root.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const zip = new PizZip(fs.readFileSync(source));
let xml = zip.files['word/document.xml'].asText();

const textReplacements = [
  ['Fairchem Organics Limited', '{{COMPANY_NAME}}'],
  ['253/P and 312, Village Chekhala,', '{{ADDR_LINE1}}'],
  ['Sanand – Kadi Highway, Taluka SANAND,', '{{ADDR_LINE2}}'],
  ['Dist. AHMEDABAD\u00a0\u2013 382 115, INDIA', 'Dist. {{ADDR_LINE3}}'],
  ['Fatty acids, C18-unsatd, dimers', '{{CHEMICAL_NAME}}'],
  ['500-148-0', '{{EC_NUMBER}}'],
  ['61788-89-4', '{{CAS_NUMBER}}'],
  ['01-2119493908-18-0028', '{{REGISTRATION_NUMBER}}'],
  ['10-100 tpa', '{{TONNAGE_BAND}}'],
  ['ECHA-334d8d7b-4b93-40d9-b1f3-25494dc492d6', '{{UUID_NUMBER}}'],
];

for (const [from, to] of textReplacements) {
  if (!xml.includes(from)) {
    console.warn(`Warning: placeholder source not found: ${from}`);
  }
  xml = xml.split(from).join(to);
}

// Collapse split issued-date runs into a single placeholder
const issuedDatePattern =
  /<w:r w:rsidR="007957B7"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>01<\/w:t><\/w:r><w:r w:rsidR="00D86250"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>\.<\/w:t><\/w:r><w:r w:rsidR="007957B7"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>01<\/w:t><\/w:r><w:r w:rsidR="00F22E86"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>\.202<\/w:t><\/w:r><w:r w:rsidR="007957B7"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>6<\/w:t><\/w:r>/;

if (issuedDatePattern.test(xml)) {
  xml = xml.replace(
    issuedDatePattern,
    '<w:r w:rsidR="007957B7"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>{{ISSUED_DATE}}</w:t></w:r>'
  );
} else {
  console.warn('Warning: issued date pattern not found');
}

// Collapse split validated-date runs
const validatedDatePattern =
  /<w:r w:rsidR="0014606D"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>31\.12\.202<\/w:t><\/w:r><w:r w:rsidR="007957B7"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>6<\/w:t><\/w:r>/;

if (validatedDatePattern.test(xml)) {
  xml = xml.replace(
    validatedDatePattern,
    '<w:r w:rsidR="0014606D"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>{{VALIDATED_DATE}}</w:t></w:r>'
  );
} else {
  console.warn('Warning: validated date pattern not found');
}

zip.file('word/document.xml', xml);
fs.writeFileSync(target, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`Template written to ${target}`);
