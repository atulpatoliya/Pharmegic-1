import fs from 'fs';
import PizZip from 'pizzip';

const zip = new PizZip(fs.readFileSync('templates/EU_REACH_CERTIFICATE.docx'));

for (const name of ['word/header1.xml', 'word/footer1.xml']) {
  if (!zip.files[name]) continue;
  const xml = zip.files[name].asText();
  console.log(`\n======== ${name} ========`);
  const paras = [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
  paras.forEach((p) => {
    const texts = [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    if (!texts.trim()) return;
    const runs = [...p.matchAll(/<w:r[\s\S]*?<\/w:r>/g)];
    runs.forEach((r) => {
      const t = [...r[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
      if (!t.trim()) return;
      const rPr = r[0].match(/<w:rPr[\s\S]*?<\/w:rPr>/)?.[0] ?? '';
      const sz = rPr.match(/<w:sz w:val="(\d+)"/)?.[1];
      const font = rPr.match(/w:ascii="([^"]+)"/)?.[1];
      const color = rPr.match(/<w:color w:val="([^"]+)"/)?.[1];
      const bold = /<w:b(?:\s|\/|>)/.test(rPr);
      console.log(JSON.stringify({ t, sz: sz ? parseInt(sz) / 2 + 'pt' : null, font, color, bold }));
    });
  });
}

const xml = zip.files['word/document.xml'].asText();

// Extract anchored shapes with positions
const anchors = [...xml.matchAll(/<wp:anchor[\s\S]*?<\/wp:anchor>/g)];
console.log(`\n======== ANCHORS: ${anchors.length} ========`);
anchors.forEach((a, i) => {
  const posH = a[0].match(/<wp:positionH[^>]*>[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/)?.[1];
  const posV = a[0].match(/<wp:positionV[^>]*>[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/)?.[1];
  const cx = a[0].match(/<wp:extent cx="(\d+)"/)?.[1];
  const cy = a[0].match(/<wp:extent cy="(\d+)"/)?.[1];
  const texts = [...a[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(' ').trim();
  const fill = a[0].match(/<a:solidFill>[\s\S]*?w:val="([^"]+)"/)?.[1];
  const stroke = a[0].match(/<a:ln>[\s\S]*?w:val="([^"]+)"/)?.[1];
  const strokeColor = a[0].match(/<a:ln>[\s\S]*?<a:srgbClr val="([^"]+)"/)?.[1];
  console.log({
    i,
    posH: posH ? (parseInt(posH) / 914400 * 25.4).toFixed(1) + 'mm' : null,
    posV: posV ? (parseInt(posV) / 914400 * 25.4).toFixed(1) + 'mm' : null,
    w: cx ? (parseInt(cx) / 914400 * 25.4).toFixed(1) + 'mm' : null,
    h: cy ? (parseInt(cy) / 914400 * 25.4).toFixed(1) + 'mm' : null,
    fill,
    strokeColor,
    texts: texts.slice(0, 80),
  });
});

// Manufacturer shape fill
const manuShapes = xml.match(/E8EFDF/g)?.length;
console.log('\nE8EFDF occurrences in body:', manuShapes);
