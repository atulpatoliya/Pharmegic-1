import { createRequire } from 'node:module';
import type { Browser, LaunchOptions } from 'puppeteer-core';
import { getVercelChromiumPackUrl } from '@/lib/vercel-chromium-config';

const require = createRequire(`${process.cwd()}/`);

type SparticuzChromium = {
  args: string[];
  setGraphicsMode: boolean;
  executablePath(input?: string): Promise<string>;
};

type PuppeteerCore = {
  launch(options: LaunchOptions): Promise<Browser>;
  defaultArgs(options?: { args?: string[]; headless?: boolean | 'shell' }): Promise<string[]>;
};

/** Launch Puppeteer on Vercel using @sparticuz/chromium-min + remote pack (not bundled). */
export async function launchVercelPuppeteerBrowser(): Promise<Browser> {
  const puppeteer = require('puppeteer-core') as PuppeteerCore;
  const chromium = require('@sparticuz/chromium-min') as SparticuzChromium;

  chromium.setGraphicsMode = false;

  const executablePath = await chromium.executablePath(getVercelChromiumPackUrl());
  const args = await puppeteer.defaultArgs({
    args: chromium.args,
    headless: 'shell',
  });

  return puppeteer.launch({
    args,
    defaultViewport: {
      width: 794,
      height: 1123,
      deviceScaleFactor: 1,
    },
    executablePath,
    headless: 'shell',
  });
}
