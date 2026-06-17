import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const root = process.cwd();
const templatePath = path.join(root, 'templates', 'EU_REACH_CERTIFICATE.docx');

const zip = new PizZip(fs.readFileSync(templatePath));
const xml = zip.files['word/document.xml'].asText();

const s1 = xml.indexOf('Jasstin');
const s2 = xml.indexOf('Sardhara');
const s3 = xml.indexOf('LITHUANIA');

console.log('Jasstin index:', s1);
console.log('Sardhara index:', s2);
console.log('LITHUANIA index:', s3);
