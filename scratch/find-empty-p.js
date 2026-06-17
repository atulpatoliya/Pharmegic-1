import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const root = process.cwd();
const templatePath = path.join(root, 'templates', 'EU_REACH_CERTIFICATE.docx');

const zip = new PizZip(fs.readFileSync(templatePath));
const xml = zip.files['word/document.xml'].asText();

const tableEndIndex = xml.indexOf('</w:tbl>');
const sealIndex = xml.indexOf('PHARMEGIC HEALTHCARE');

if (tableEndIndex !== -1 && sealIndex !== -1) {
  const middle = xml.substring(tableEndIndex, sealIndex);
  
  // Find all <w:p> elements in middle
  // A paragraph starts with <w:p and ends with </w:p>
  const matches = middle.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  console.log('Total paragraphs found:', matches.length);
  
  matches.forEach((p, idx) => {
    // Check if paragraph contains text (<w:t>)
    const hasText = p.includes('<w:t');
    console.log(`Paragraph ${idx}: hasText=${hasText}, length=${p.length}`);
    if (!hasText) {
      console.log('--- EMPTY PARAGRAPH XML ---');
      console.log(p);
    }
  });
}
