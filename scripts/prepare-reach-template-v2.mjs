/**
 * Converts EU REACH REGISTRATION CERTIFICATE.docx sample values into merge placeholders.
 * Preserves the original Word layout (text boxes, floating tables, images).
 *
 * Source: templates/CT_EU_REACH_v2.docx
 * Output: templates/CT_2026_v2.docx
 *
 * Run: node scripts/prepare-reach-template-v2.mjs
 */
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const root = process.cwd();
const source = path.join(root, 'templates', 'CT_EU_REACH_v2.docx');
const target = path.join(root, 'templates', 'CT_2026_v2.docx');
const previewTarget = path.join(root, 'templates', 'CT_2026_v2_preview.docx');

if (!fs.existsSync(source)) {
  console.error('templates/CT_EU_REACH_v2.docx not found.');
  console.error('Copy EU REACH REGISTRATION CERTIFICATE.docx to templates/CT_EU_REACH_v2.docx');
  process.exit(1);
}

const zip = new PizZip(fs.readFileSync(source));
let xml = zip.files['word/document.xml'].asText();

const textReplacements = [
  ['C-1/394, Phase II, G.I.D.C. Estate, Vatva, Ahmedabad: 382445,', '{{ADDR_LINE1}}'],
  ['01-2119458771-32-0109', '{{REGISTRATION_NUMBER}}'],
  ['1 January 2026', '{{ISSUED_DATE}}'],
  ['31 December 2026', '{{VALIDATED_DATE}}'],
];

for (const [from, to] of textReplacements) {
  if (!xml.includes(from)) {
    console.warn(`Warning: placeholder source not found: ${from}`);
  }
  xml = xml.split(from).join(to);
}

const companyPattern =
  /<w:t xml:space="preserve">Ami <\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>Pharma<\/w:t>/g;
if (companyPattern.test(xml)) {
  xml = xml.replace(companyPattern, '<w:t>{{COMPANY_NAME}}</w:t>');
} else {
  console.warn('Warning: split company name pattern not found');
}

const casPattern =
  /<w:t>147-14-<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>8<\/w:t>/g;
if (casPattern.test(xml)) {
  xml = xml.replace(casPattern, '<w:t>{{CAS_NUMBER}}</w:t>');
} else {
  console.warn('Warning: split CAS pattern not found');
}

const ecPattern =
  /<w:t>205-685-<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>1<\/w:t>/g;
if (ecPattern.test(xml)) {
  xml = xml.replace(ecPattern, '<w:t>{{EC_NUMBER}}</w:t>');
} else {
  console.warn('Warning: split EC pattern not found');
}

const uuidPattern =
  /<w:t>ECHA-ac4a5f61-f070-4d66-9703-<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>96b2190cb5ba<\/w:t>/g;
if (uuidPattern.test(xml)) {
  xml = xml.replace(uuidPattern, '<w:t>{{UUID_NUMBER}}</w:t>');
} else {
  console.warn('Warning: split UUID pattern not found');
}

const chemicalPattern =
  /<w:t xml:space="preserve">29H,31H-phthalocyaninato\(2-\)-N29,N30,N31,N32 <\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>copper<\/w:t>/g;
if (chemicalPattern.test(xml)) {
  xml = xml.replace(chemicalPattern, '<w:t>{{CHEMICAL_NAME}}</w:t>');
} else {
  console.warn('Warning: split chemical name pattern not found');
}

const tonnagePattern =
  /<w:t xml:space="preserve">10–100 <\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>tpa<\/w:t>/g;
if (tonnagePattern.test(xml)) {
  xml = xml.replace(tonnagePattern, '<w:t>{{TONNAGE_BAND}}</w:t>');
} else {
  console.warn('Warning: split tonnage pattern not found');
}

if (xml.includes('>India<')) {
  xml = xml.split('>India<').join('>{{ADDR_LINE3}}<');
}

function flattenForBrowserPreview(sourceXml) {
  const marker = '<w:drawing>';
  const endMarker = '</w:drawing>';
  let result = '';
  let cursor = 0;

  while (cursor < sourceXml.length) {
    const start = sourceXml.indexOf(marker, cursor);
    if (start === -1) {
      result += sourceXml.slice(cursor);
      break;
    }

    result += sourceXml.slice(cursor, start);
    const end = sourceXml.indexOf(endMarker, start);
    if (end === -1) {
      result += sourceXml.slice(start);
      break;
    }

    const block = sourceXml.slice(start, end + endMarker.length);
    const hasTextBox = block.includes('<w:txbxContent>');
    const hasImage = block.includes('<a:blip') || block.includes('r:embed');
    if (!hasTextBox && hasImage) {
      result += block;
    }

    cursor = end + endMarker.length;
  }

  return result.replace(/<w:tblpPr[^/]*\/>/g, '');
}

const placeholders = [
  '{{COMPANY_NAME}}',
  '{{ADDR_LINE1}}',
  '{{ADDR_LINE3}}',
  '{{CHEMICAL_NAME}}',
  '{{CAS_NUMBER}}',
  '{{EC_NUMBER}}',
  '{{TONNAGE_BAND}}',
  '{{REGISTRATION_NUMBER}}',
  '{{UUID_NUMBER}}',
  '{{ISSUED_DATE}}',
  '{{VALIDATED_DATE}}',
];

for (const ph of placeholders) {
  if (!xml.includes(ph)) {
    console.warn(`Warning: missing placeholder in output: ${ph}`);
  }
}

const drawings = (xml.match(/<w:drawing>/g) || []).length;
const tblp = (xml.match(/<w:tblpPr/g) || []).length;
console.log(`Layout preserved: drawings=${drawings}, floatingTables=${tblp}`);

zip.file('word/document.xml', xml);
fs.writeFileSync(target, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`Template written to ${target}`);

const previewZip = new PizZip(fs.readFileSync(source));
previewZip.file('word/document.xml', flattenForBrowserPreview(xml));
fs.writeFileSync(previewTarget, previewZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
const previewDrawings = (flattenForBrowserPreview(xml).match(/<w:drawing>/g) || []).length;
console.log(`Browser preview template written to ${previewTarget} (drawings=${previewDrawings})`);
console.log('Run: node scripts/generate-rc-template-preview-pdf.mjs  (admin Settings PDF preview)');
