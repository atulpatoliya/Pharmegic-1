import fs from 'fs';
import PizZip from 'pizzip';

const zip = new PizZip(fs.readFileSync('templates/EU_REACH_CERTIFICATE.docx'));
const xml = zip.files['word/document.xml'].asText();

function halfPtToPt(h) {
  return `${parseInt(h, 10) / 2}pt`;
}

function twipsToMm(t) {
  return `${((parseInt(t, 10) / 1440) * 25.4).toFixed(2)}mm`;
}

const sect = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
if (sect) {
  const pgMar = sect[0].match(/<w:pgMar[^/]+\/>/);
  console.log('PAGE MARGINS:', pgMar?.[0] ?? 'none');
  const pgSz = sect[0].match(/<w:pgSz[^/]+\/>/);
  console.log('PAGE SIZE:', pgSz?.[0] ?? 'none');
}

const fills = [...new Set([...xml.matchAll(/w:fill="([^"]+)"/g)].map((m) => m[1]))];
console.log('\nFILLS:', fills);

const borderColors = [
  ...new Set([...xml.matchAll(/w:color="([A-F0-9]{6})"/gi)].map((m) => m[1])),
];
console.log('COLORS:', borderColors);

const paras = [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
console.log('\nPARAGRAPHS WITH TEXT:');

paras.forEach((p, i) => {
  const texts = [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  if (!texts.trim()) return;

  const pPr = p.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] ?? '';
  const jc = pPr.match(/<w:jc w:val="([^"]+)"/)?.[1];
  const spacing = pPr.match(/<w:spacing[^/]+\/>/)?.[0];
  const ind = pPr.match(/<w:ind[^/]+\/>/)?.[0];
  const shd = pPr.match(/<w:shd[^/]+\/>/)?.[0];

  const runs = [...p.matchAll(/<w:r[\s\S]*?<\/w:r>/g)];
  const runInfo = runs
    .map((r) => {
      const t = [...r[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
      if (!t) return null;
      const rPr = r[0].match(/<w:rPr[\s\S]*?<\/w:rPr>/)?.[0] ?? '';
      const sz = rPr.match(/<w:sz w:val="(\d+)"/)?.[1];
      const font = rPr.match(/w:ascii="([^"]+)"/)?.[1];
      const color = rPr.match(/<w:color w:val="([^"]+)"/)?.[1];
      const bold = /<w:b(?:\s|\/|>)/.test(rPr);
      const u = rPr.match(/<w:u w:val="([^"]+)"/)?.[1];
      return { t, sz: sz ? halfPtToPt(sz) : null, font, color, bold, u };
    })
    .filter(Boolean);

  console.log(`\n--- [${i}] ${texts.slice(0, 90)}`);
  if (jc) console.log('  align:', jc);
  if (spacing) console.log('  spacing:', spacing);
  if (ind) console.log('  indent:', ind);
  if (shd) console.log('  shading:', shd);
  runInfo.forEach((ri) => console.log('  ', JSON.stringify(ri)));
});

// Table analysis
const tables = [...xml.matchAll(/<w:tbl[\s\S]*?<\/w:tbl>/g)];
console.log(`\n\nTABLES: ${tables.length}`);
tables.forEach((tbl, ti) => {
  const tblPr = tbl[0].match(/<w:tblPr[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
  console.log(`\nTable ${ti} props:`, tblPr.slice(0, 500));
  const rows = [...tbl[0].matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)];
  rows.forEach((row, ri) => {
    const cells = [...row[0].matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)];
    const cellTexts = cells.map((c) => {
      const t = [...c[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
      const tcPr = c[0].match(/<w:tcPr[\s\S]*?<\/w:tcPr>/)?.[0] ?? '';
      const shd = tcPr.match(/w:fill="([^"]+)"/)?.[1];
      const borders = [...tcPr.matchAll(/w:color="([^"]+)"/g)].map((m) => m[1]);
      return { t, shd, borders };
    });
    if (cellTexts.some((c) => c.t.trim())) {
      console.log(`  row ${ri}:`, JSON.stringify(cellTexts));
    }
  });
});

// Drawing/shape for date boxes
const drawings = xml.includes('wps:') || xml.includes('v:shape');
console.log('\nHas drawings:', drawings);
const drawingSnippets = [...xml.matchAll(/<w:drawing[\s\S]*?<\/w:drawing>/g)].length;
console.log('Drawing count:', drawingSnippets);
