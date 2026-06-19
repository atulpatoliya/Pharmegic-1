import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium-min'],
  outputFileTracingIncludes: {
    '/api/reach-certificate/pdf-html': ['./node_modules/@sparticuz/chromium-min/**'],
  },
};

export default nextConfig;
