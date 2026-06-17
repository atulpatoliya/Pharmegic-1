import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const root = process.cwd();
const templatePath = path.join(root, 'templates', 'EU_REACH_CERTIFICATE.docx');

const zip = new PizZip(fs.readFileSync(templatePath));
const xml = zip.files['word/document.xml'].asText();

const chemIndex = xml.indexOf('{{CHEMICAL_NAME}}');
if (chemIndex !== -1) {
  console.log('XML AROUND CHEMICAL NAME:');
  console.log(xml.substring(chemIndex - 500, chemIndex + 500));
} else {
  console.log('Chemical name placeholder not found');
}
