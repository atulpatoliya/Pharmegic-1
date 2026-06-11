/**
 * One-time script: converts TCC-Demo.docx sample values into merge placeholders.
 * Run: node scripts/prepare-tcc-template.mjs
 */
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const root = process.cwd();
const source = path.join(root, 'templates', 'TCC-Demo.docx');
const target = path.join(root, 'templates', 'TCC_2026.docx');

if (!fs.existsSync(source)) {
  console.error('templates/TCC-Demo.docx not found.');
  process.exit(1);
}

const zip = new PizZip(fs.readFileSync(source));
let xml = zip.files['word/document.xml'].asText();

const textReplacements = [
  ['Fairchem Organics Limited', '{{COMPANY_NAME}}'],
  ['253/P and 312, Village Chekhala,', '{{ADDR_LINE1}}'],
  ['Sanand – Kadi Highway, Taluka SANAND,', '{{ADDR_LINE2}}'],
  ['Dist. AHMEDABAD\u00a0\u2013 382 115, INDIA', 'Dist. {{ADDR_LINE3}}'],
  [
    '253/P and 312, Village Chekhala, Sanand – Kadi Highway, Taluka SANAND, Dist. AHMEDABAD\u00a0\u2013 382 115, INDIA',
    '{{EXPORTER_FULL_ADDRESS}}',
  ],
  ['500-148-0', '{{EC_NUMBER}}'],
  ['61788-89-4', '{{CAS_NUMBER}}'],
  ['01-2119493908-18-0028', '{{REGISTRATION_NUMBER}}'],
  ['10-100 tpa', '{{TONNAGE_BAND}}'],
  ['ECHA-334d8d7b-4b93-40d9-b1f3-25494dc492d6', '{{UUID_NUMBER}}'],
  ['INDUSTRIAL QUIMICA LASEM, S.A.U.', '{{EU_IMPORTER_NAME}}'],
  ['AVENIDA DE LA INDUSTRIA, ', '{{EU_IMPORTER_ADDR1}}'],
  ['POL. IND. PLA DEL CAMÍ,', '{{EU_IMPORTER_ADDR2}}'],
  ['CASTELLGALÍ - 08297, SPAIN', '{{EU_IMPORTER_ADDR3}}'],
  ['19 MT', '{{VOLUME_MT}}'],
  ['SDCE2627/200014', '{{DELIVERY_CHALLAN_NO}}'],
];

for (const [from, to] of textReplacements) {
  if (!xml.includes(from)) {
    console.warn(`Warning: placeholder source not found: ${from}`);
  }
  xml = xml.split(from).join(to);
}

function collapseSplitChemicalName(xml, paraId) {
  const pattern = new RegExp(
    `<w:t>Fatty acids, C18-</w:t></w:r></w:p><w:p w14:paraId="${paraId}"[\\s\\S]*?<w:t>unsatd, dimers</w:t></w:r></w:p>`
  );
  if (!pattern.test(xml)) {
    console.warn(`Warning: split chemical name pattern not found for ${paraId}`);
    return xml;
  }
  return xml.replace(pattern, '<w:t>{{CHEMICAL_NAME}}</w:t></w:r></w:p>');
}

xml = collapseSplitChemicalName(xml, '57E01E06');
xml = collapseSplitChemicalName(xml, '1B430B4F');

const exportDatePattern =
  /<w:r w:rsidR="00F479C3"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>03<\/w:t><\/w:r><w:r w:rsidR="0063559C"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>\.<\/w:t><\/w:r><w:r w:rsidR="00F479C3"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>06<\/w:t><\/w:r><w:r w:rsidR="0063559C"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>\.202<\/w:t><\/w:r><w:r w:rsidR="0076202C"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>6<\/w:t><\/w:r>/;

if (!exportDatePattern.test(xml)) {
  console.warn('Warning: export date pattern not found');
} else {
  xml = xml.replace(
    exportDatePattern,
    '<w:r w:rsidR="00F479C3"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>{{EXPORT_DATE}}</w:t></w:r>'
  );
}

const validUntilPattern =
  /<w:r><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>Valid Until: 31\.<\/w:t><\/w:r><w:r w:rsidR="00F479C3"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>12<\/w:t><\/w:r><w:r><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>\.202<\/w:t><\/w:r><w:r w:rsidR="0076202C"><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><\/w:rPr><w:t>6<\/w:t><\/w:r>/;

if (!validUntilPattern.test(xml)) {
  console.warn('Warning: valid until pattern not found');
} else {
  xml = xml.replace(
    validUntilPattern,
    '<w:r><w:rPr><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>Valid Until: {{VALID_UNTIL_DATE}}</w:t></w:r>'
  );
}

zip.file('word/document.xml', xml);
const output = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(target, output);

const sourceLen = new PizZip(fs.readFileSync(source)).files['word/document.xml'].asText().length;
const targetLen = xml.length;
console.log(`Template written to ${target} (document.xml ${sourceLen} -> ${targetLen} chars)`);
if (targetLen < sourceLen * 0.8) {
  console.error('ERROR: prepared template looks truncated. Aborting validation failed.');
  process.exit(1);
}
