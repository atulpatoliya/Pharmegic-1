import fs from 'node:fs';
import path from 'node:path';
import type { ReachCertificateHtmlData } from '@/lib/reach-certificate-html-data';

const CERTIFICATE_CSS_PATH = path.join(process.cwd(), 'components', 'reach-certificate-html.css');

const FONT_LINKS = [
  '<link rel="preconnect" href="https://fonts.googleapis.com" />',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
  '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Tinos:wght@400;700&display=swap" rel="stylesheet" />',
].join('\n');

const PRINT_OVERRIDES = `
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
[data-reach-cert-root] {
  font-family: 'Noto Sans', Verdana, Geneva, Tahoma, sans-serif;
}
[data-reach-cert-root] .reach-cert-title {
  font-family: 'Tinos', 'Times New Roman', Times, serif !important;
}
`;

function loadCertificateCss(): string {
  return fs.readFileSync(CERTIFICATE_CSS_PATH, 'utf8');
}

/** Full HTML document for Puppeteer — static markup, no client hydration. */
export async function renderReachCertificateHtmlDocument(
  data: ReachCertificateHtmlData
): Promise<string> {
  const [{ renderToStaticMarkup }, { createElement }, { default: ReachCertificateHtmlDocument }] =
    await Promise.all([
      import('react-dom/server'),
      import('react'),
      import('@/components/ReachCertificateHtmlDocument'),
    ]);

  const markup = renderToStaticMarkup(createElement(ReachCertificateHtmlDocument, { data }));
  const css = loadCertificateCss();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=794, initial-scale=1" />
${FONT_LINKS}
<style>${css}</style>
<style>${PRINT_OVERRIDES}</style>
</head>
<body data-reach-pdf-ready="true">
${markup}
</body>
</html>`;
}
