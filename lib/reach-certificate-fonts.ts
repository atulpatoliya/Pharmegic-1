import fs from 'node:fs';
import path from 'node:path';

type FontFormat = 'truetype' | 'woff2';

type ReachCertificateFont = {
  family: string;
  file: string;
  weight: number;
  style: 'normal' | 'italic';
  format: FontFormat;
};

const PUBLIC_FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');

const REACH_CERTIFICATE_FONTS: ReachCertificateFont[] = [
  { family: 'Verdana', file: 'Verdana.ttf', weight: 400, style: 'normal', format: 'truetype' },
  { family: 'Verdana', file: 'Verdana-Bold.ttf', weight: 700, style: 'normal', format: 'truetype' },
  { family: 'Verdana', file: 'Verdana-Italic.ttf', weight: 400, style: 'italic', format: 'truetype' },
  { family: 'Verdana', file: 'Verdana-BoldItalic.ttf', weight: 700, style: 'italic', format: 'truetype' },
  {
    family: 'Times New Roman',
    file: 'Times-New-Roman.ttf',
    weight: 400,
    style: 'normal',
    format: 'truetype',
  },
  {
    family: 'Times New Roman',
    file: 'Times-New-Roman-Bold.ttf',
    weight: 700,
    style: 'normal',
    format: 'truetype',
  },
  {
    family: 'Times New Roman',
    file: 'Times-New-Roman-Italic.ttf',
    weight: 400,
    style: 'italic',
    format: 'truetype',
  },
  {
    family: 'Times New Roman',
    file: 'Times-New-Roman-BoldItalic.ttf',
    weight: 700,
    style: 'italic',
    format: 'truetype',
  },
];

function fontMimeType(format: FontFormat): string {
  return format === 'woff2' ? 'font/woff2' : 'font/ttf';
}

function fontFilePath(file: string): string {
  return path.join(PUBLIC_FONTS_DIR, file);
}

function toFontDataUrl(font: ReachCertificateFont): string {
  const buffer = fs.readFileSync(fontFilePath(font.file));
  return `data:${fontMimeType(font.format)};base64,${buffer.toString('base64')}`;
}

function buildFontFaceBlock(font: ReachCertificateFont, src: string): string {
  return `@font-face {
  font-family: '${font.family}';
  src: url('${src}') format('${font.format}');
  font-weight: ${font.weight};
  font-style: ${font.style};
  font-display: swap;
}`;
}

/** Inline @font-face rules with base64 data URLs — for Puppeteer setContent (no HTTP server). */
export function buildReachCertificateEmbeddedFontCss(): string {
  return REACH_CERTIFICATE_FONTS.map((font) =>
    buildFontFaceBlock(font, toFontDataUrl(font))
  ).join('\n');
}

/** Public URL paths — for browser preview and print pages served by Next.js. */
export function buildReachCertificatePublicFontCss(): string {
  return REACH_CERTIFICATE_FONTS.map((font) =>
    buildFontFaceBlock(font, `/fonts/${font.file}`)
  ).join('\n');
}
