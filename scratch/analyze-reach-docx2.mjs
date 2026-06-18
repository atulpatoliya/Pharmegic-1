import fs from 'fs';
import PizZip from 'pizzip';

const xml = new PizZip(fs.readFileSync('templates/EU_REACH_CERTIFICATE.docx')).files[
  'word/document.xml'
].asText();

// Extract color fills
const colors = [...xml.matchAll(/w:fill="([^"]+)"/g)].map((m) => m[1]);
console.log('fills', [...new Set(colors)]);

// borders
const borders = [...xml.matchAll(/w:val="single"[^/]*w:color="([^"]+)"/g)].map((m) => m[1]);
console.log('border colors', [...new Set(borders)].slice(0, 10));

// Find EU REACH title context
const idx = xml.indexOf('EU REACH');
console.log(xml.substring(idx - 800, idx + 1200).replace(/></g, '>\n<'));
