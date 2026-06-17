import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const root = process.cwd();
const templatePath = path.join(root, 'templates', 'EU_REACH_CERTIFICATE.docx');

const zip = new PizZip(fs.readFileSync(templatePath));
const xml = zip.files['word/document.xml'].asText();

// Search for the paragraphs after the table (table ends with </w:tbl>)
const tableIndex = xml.indexOf('</w:tbl>');
const sealIndex = xml.indexOf('PHARMEGIC HEALTHCARE');

console.log('Table index:', tableIndex);
console.log('Seal index:', sealIndex);

if (tableIndex !== -1 && sealIndex !== -1) {
  const middle = xml.substring(tableIndex, sealIndex);
  // Count paragraph tags <w:p>
  const pCount = (middle.match(/<w:p\b/g) || []).length;
  console.log('Paragraphs count between table and seal:', pCount);
  
  // Let's print the middle XML to see the paragraphs
  console.log('--- MIDDLE XML ---');
  console.log(middle.substring(0, 2000));
}
