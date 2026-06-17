/** Candidate Gotenberg base URLs — tried in order until conversion succeeds. */
export function getGotenbergBaseUrls(): string[] {
  const candidates = [
    process.env.GOTENBERG_URL,
    process.env.GOTENBERG_INTERNAL_URL,
    'http://127.0.0.1:3001',
    'http://localhost:3001',
    'http://gotenberg:3000',
  ];

  return [
    ...new Set(
      candidates
        .filter((url): url is string => Boolean(url?.trim()))
        .map((url) => url.trim().replace(/\/$/, ''))
    ),
  ];
}

export async function convertDocxBufferWithGotenberg(docxBuffer: Buffer): Promise<Buffer> {
  const urls = getGotenbergBaseUrls();
  if (urls.length === 0) {
    throw new Error('Gotenberg not configured.');
  }

  let lastError: Error | null = null;

  for (const baseUrl of urls) {
    try {
      const formData = new FormData();
      formData.append('files', new Blob([new Uint8Array(docxBuffer)]), 'certificate.docx');

      const res = await fetch(`${baseUrl}/forms/libreoffice/convert`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(180_000),
      });

      if (!res.ok) {
        lastError = new Error(`Gotenberg conversion failed (${res.status}) at ${baseUrl}.`);
        continue;
      }

      const pdfBuffer = Buffer.from(await res.arrayBuffer());
      if (
        pdfBuffer.length >= 4 &&
        pdfBuffer[0] === 0x25 &&
        pdfBuffer[1] === 0x50 &&
        pdfBuffer[2] === 0x44 &&
        pdfBuffer[3] === 0x46
      ) {
        return pdfBuffer;
      }

      lastError = new Error(`Gotenberg returned an invalid PDF from ${baseUrl}.`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('Gotenberg conversion failed.');
}

export async function isGotenbergReachable(): Promise<boolean> {
  for (const baseUrl of getGotenbergBaseUrls()) {
    try {
      const res = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return true;
    } catch {
      // try next candidate
    }
  }
  return false;
}
