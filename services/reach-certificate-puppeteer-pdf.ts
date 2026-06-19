import type { Browser, LaunchOptions } from 'puppeteer-core';
import { isVercelHosting } from '@/lib/reach-gotenberg';

function isServerlessHosting(): boolean {
  return isVercelHosting() || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function chromeCandidates(): string[] {
  const fromEnv = [process.env.PUPPETEER_EXECUTABLE_PATH, process.env.CHROME_PATH].filter(
    (value): value is string => Boolean(value?.trim())
  );

  if (process.platform === 'win32') {
    return [
      ...fromEnv,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
  }

  return [
    ...fromEnv,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];
}

async function resolveSystemChromeExecutable(): Promise<string> {
  const { access } = await import('node:fs/promises');

  for (const candidate of chromeCandidates()) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next path
    }
  }

  throw new Error(
    'Chromium/Chrome not found for PDF generation. Install Google Chrome or set PUPPETEER_EXECUTABLE_PATH.'
  );
}

async function buildLaunchOptions(): Promise<LaunchOptions> {
  if (isServerlessHosting()) {
    const [puppeteer, chromium] = await Promise.all([
      import('puppeteer-core'),
      import('@sparticuz/chromium'),
    ]);

    chromium.default.setGraphicsMode = false;

    const args = await puppeteer.default.defaultArgs({
      args: chromium.default.args,
      headless: 'shell',
    });

    return {
      args,
      defaultViewport: {
        width: 794,
        height: 1123,
        deviceScaleFactor: 1,
      },
      executablePath: await chromium.default.executablePath(),
      headless: 'shell',
    };
  }

  const executablePath = await resolveSystemChromeExecutable();
  return {
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
    ],
  };
}

let browserPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import('puppeteer-core');
  const options = await buildLaunchOptions();
  return puppeteer.default.launch(options);
}

async function getBrowser(): Promise<Browser> {
  if (isServerlessHosting()) {
    return launchBrowser();
  }

  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

async function closeBrowserIfNeeded(browser: Browser): Promise<void> {
  if (isServerlessHosting()) {
    await browser.close();
  }
}

export async function generateReachHtmlPdfFromHtml(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForSelector('[data-reach-cert-root]', { timeout: 30_000 });
    await page.waitForSelector('[data-reach-pdf-ready="true"]', { timeout: 30_000 });

    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = Array.from(document.images);
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
    await closeBrowserIfNeeded(browser);
  }
}

/** @deprecated Prefer generateReachHtmlPdfFromHtml for consistent preview/PDF parity. */
export async function generateReachHtmlPdfWithPuppeteer(printUrl: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 60_000 });
    await page.waitForSelector('[data-reach-cert-root]', { timeout: 30_000 });
    await page.waitForSelector('[data-reach-pdf-ready="true"]', { timeout: 30_000 });

    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
    await closeBrowserIfNeeded(browser);
  }
}

export function isReachPuppeteerPdfAvailable(): boolean {
  return process.env.REACH_PDF_DISABLED !== '1';
}

export function usesServerlessChromium(): boolean {
  return isServerlessHosting();
}
