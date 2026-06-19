import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core'],
  outputFileTracingExcludes: {
    '/api/reach-certificate/pdf-html': [
      './node_modules/puppeteer-core/**',
      './node_modules/@puppeteer/**',
    ],
  },
};

export default nextConfig;
