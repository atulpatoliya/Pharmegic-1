import type { NextConfig } from 'next';

const PDF_FONT_TRACE = ['./public/fonts/**'];

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium-min'],
  outputFileTracingIncludes: {
    '/api/reach-certificate/pdf-html': [
      './node_modules/@sparticuz/chromium-min/**',
      ...PDF_FONT_TRACE,
    ],
    '/api/reach-certificate/pdf': PDF_FONT_TRACE,
    '/api/reach-certificate/preview/pdf': PDF_FONT_TRACE,
    '/api/reach-certificate/convert-pdf': PDF_FONT_TRACE,
    '/api/certificate-template/rc-preview/pdf': PDF_FONT_TRACE,
  },
};

export default nextConfig;
