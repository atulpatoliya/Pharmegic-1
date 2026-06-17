import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const root = process.cwd();
const templatePath = path.join(root, 'templates', 'EU_REACH_CERTIFICATE.docx');

const zip = new PizZip(fs.readFileSync(templatePath));
const xml = zip.files['word/document.xml'].asText();

const tableEndIndex = xml.indexOf('</w:tbl>');
if (tableEndIndex !== -1) {
  console.log('XML AFTER TABLE END:');
  console.log(xml.substring(tableEndIndex, tableEndIndex + 4000));
} else {
  console.log('No table end found');
}
