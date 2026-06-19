import type { Browser } from 'puppeteer-core';

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

async function resolveChromeExecutable(): Promise<string> {
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

let browserPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  const [puppeteer, executablePath] = await Promise.all([
    import('puppeteer-core'),
    resolveChromeExecutable(),
  ]);

  return puppeteer.default.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
    ],
  });
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

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
  }
}

export function isReachPuppeteerPdfAvailable(): boolean {
  return process.env.REACH_PDF_DISABLED !== '1';
}
