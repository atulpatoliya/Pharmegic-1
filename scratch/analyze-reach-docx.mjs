import fs from 'fs';
import PizZip from 'pizzip';

const xml = new PizZip(fs.readFileSync('templates/EU_REACH_CERTIFICATE.docx')).files[
  'word/document.xml'
].asText();

const fonts = [...xml.matchAll(/w:ascii="([^"]+)"/g)].map((m) => m[1]);
const sizes = [...xml.matchAll(/w:sz w:val="(\d+)"/g)].map((m) => +m[1] / 2);
console.log('fonts', [...new Set(fonts)]);
console.log('sizes pt', [...new Set(sizes)].sort((a, b) => a - b));
const texts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
  .map((m) => m[1])
  .filter((t) => t.trim());
console.log('texts', texts.join(' | '));
