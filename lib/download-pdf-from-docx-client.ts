'use client';

import { buildReachCertificateConvertPdfUrl } from '@/lib/reach-certificate-download';
import { renderAsync } from 'docx-preview';

const DOCX_PREVIEW_CLASS = 'docx';

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function findDocxWrapper(host: HTMLElement): HTMLElement | null {
  return (
    host.querySelector('.docx-preview-wrapper') ??
    host.querySelector(`.${DOCX_PREVIEW_CLASS}-wrapper`) ??
    host.querySelector('.docx-wrapper')
  );
}

function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 500);
      });
    });
  });
}

function sanitizeDocxCloneForPdf(root: HTMLElement): void {
  root.querySelectorAll('*').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.textDecoration = 'none';
    node.style.textDecorationLine = 'none';
    node.style.opacity = '1';
    node.style.visibility = 'visible';
    node.style.transform = 'none';
    node.style.clip = 'auto';
    node.style.backgroundClip = 'padding-box';
    node.style.boxDecorationBreak = 'clone';
  });

  root.querySelectorAll('table').forEach((table) => {
    if (!(table instanceof HTMLElement)) return;
    table.style.borderCollapse = 'collapse';
    table.style.borderSpacing = '0';
  });

  root.querySelectorAll('td, th').forEach((cell) => {
    if (!(cell instanceof HTMLElement)) return;
    cell.style.textDecoration = 'none';
    cell.style.borderCollapse = 'collapse';
    cell.style.verticalAlign = 'middle';
  });
}

async function convertDocxBlobToPdfAndDownload(blob: Blob, fileName: string): Promise<void> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:794px',
    'background:#ffffff',
    'pointer-events:none',
    'clip:rect(0,0,0,0)',
    'overflow:visible',
    'z-index:-1',
  ].join(';');
  document.body.appendChild(host);

  try {
    await renderAsync(blob, host, host, {
      className: 'docx-preview',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
    });

    await waitForLayout();

    const wrapper = findDocxWrapper(host);
    if (!wrapper) {
      throw new Error('Certificate preview failed to render.');
    }

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const pageElements = Array.from(wrapper.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.offsetHeight > 0
    );
    const targets = pageElements.length > 0 ? pageElements : [wrapper];

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const scale = Math.max(2, Math.min(3, window.devicePixelRatio || 2));

    for (let i = 0; i < targets.length; i++) {
      const canvas = await html2canvas(targets[i], {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: targets[i].scrollWidth,
        height: targets[i].scrollHeight,
        onclone: (_doc, clonedElement) => {
          sanitizeDocxCloneForPdf(clonedElement);
        },
      });

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Certificate preview failed to render.');
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      let imgWidth = pageWidth;
      let imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight > pageHeight) {
        imgHeight = pageHeight;
        imgWidth = (canvas.width * imgHeight) / canvas.height;
      }

      const x = (pageWidth - imgWidth) / 2;
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', x, 0, imgWidth, imgHeight);
    }

    triggerBlobDownload(pdf.output('blob'), fileName);
  } finally {
    document.body.removeChild(host);
  }
}

export async function downloadPdfFromDocxUrl(docxUrl: string, fileName: string): Promise<void> {
  const res = await fetch(docxUrl, { credentials: 'same-origin' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Failed to load certificate document.');
  }

  await convertDocxBlobToPdfAndDownload(await res.blob(), fileName);
}

function isDocxContentType(contentType: string) {
  return (
    contentType.includes('wordprocessingml') ||
    contentType.includes('officedocument') ||
    contentType.includes('application/vnd.openxmlformats')
  );
}

function isPdfContentType(contentType: string, bytes: Uint8Array) {
  return (
    contentType.includes('application/pdf') ||
    contentType.includes('application/octet-stream') ||
    (bytes.length >= 4 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46)
  );
}

export type CertificateDownloadResult = {
  format: 'pdf';
  fileName: string;
};

function appendCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_=${Date.now()}`;
}

async function fetchDocxBlob(docxUrl: string): Promise<Blob> {
  const res = await fetch(appendCacheBuster(docxUrl), {
    credentials: docxUrl.startsWith('/') ? 'same-origin' : 'omit',
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Failed to load certificate document.');
  }
  return res.blob();
}

async function downloadPdfFromDocxSources(
  docxUrls: string[],
  fileName: string
): Promise<CertificateDownloadResult> {
  let lastError: string | undefined;

  for (const docxUrl of docxUrls) {
    try {
      await convertDocxBlobToPdfAndDownload(await fetchDocxBlob(docxUrl), fileName);
      return { format: 'pdf', fileName };
    } catch (err) {
      if (err instanceof Error) {
        lastError = err.message;
      }
    }
  }

  throw new Error(lastError || 'Failed to generate certificate PDF.');
}

function extractCertificateIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.searchParams.get('certificateId');
  } catch {
    return null;
  }
}

/** RC download: server PDF first, then browser DOCX→PDF when LibreOffice/Gotenberg is unavailable. */
async function downloadRcPdfViaServerConvert(params: {
  docxUrl: string;
  fileName: string;
  pdfUrl: string;
  docxFallbackUrls: string[];
  clientId?: string;
  chemicalId?: string;
  registrationNumber?: string;
  issuedDate?: string;
  validatedDate?: string;
  tonnageBand?: string | null;
}): Promise<CertificateDownloadResult> {
  const certificateId = extractCertificateIdFromUrl(params.pdfUrl);
  const convertUrls = [
    buildReachCertificateConvertPdfUrl({
      docxUrl: params.docxUrl,
      fileName: params.fileName,
    }),
    certificateId
      ? buildReachCertificateConvertPdfUrl({
          certificateId,
          fileName: params.fileName,
        })
      : null,
    params.clientId && params.chemicalId
      ? buildReachCertificateConvertPdfUrl({
          clientId: params.clientId,
          chemicalId: params.chemicalId,
          registrationNumber: params.registrationNumber,
          issuedDate: params.issuedDate,
          validatedDate: params.validatedDate,
          tonnageBand: params.tonnageBand,
          fileName: params.fileName,
        })
      : null,
  ].filter((url): url is string => Boolean(url));

  for (const convertUrl of convertUrls) {
    try {
      const res = await fetch(appendCacheBuster(convertUrl), {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) {
        continue;
      }
      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        continue;
      }
      const blob = await res.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (!isPdfContentType(contentType, bytes)) {
        continue;
      }
      triggerBlobDownload(new Blob([bytes], { type: 'application/pdf' }), params.fileName);
      return { format: 'pdf', fileName: params.fileName };
    } catch {
      // try next server route or browser fallback
    }
  }

  const browserDocxUrls = [...new Set(params.docxFallbackUrls.filter(Boolean))];
  if (browserDocxUrls.length > 0) {
    return downloadPdfFromDocxSources(browserDocxUrls, params.fileName);
  }

  throw new Error('Failed to generate certificate PDF.');
}

function collectRcDocxFallbackUrls(params: {
  docxUrl: string;
  previewDocxUrl?: string | null;
  officeDocxUrl?: string | null;
}): string[] {
  const urls = [params.docxUrl, params.previewDocxUrl, params.officeDocxUrl].filter(
    (url): url is string => Boolean(url?.trim())
  );
  const apiUrls = urls.filter((url) => url.startsWith('/'));
  const externalUrls = urls.filter((url) => !url.startsWith('/'));
  return [...new Set([...apiUrls, ...externalUrls])];
}

export async function downloadCertificatePdf(params: {
  pdfUrl: string;
  docxUrl: string;
  fileName: string;
  previewDocxUrl?: string | null;
  officeDocxUrl?: string | null;
  certificateType?: 'rc' | 'tcc';
  clientId?: string;
  chemicalId?: string;
  registrationNumber?: string;
  issuedDate?: string;
  validatedDate?: string;
  tonnageBand?: string | null;
}): Promise<CertificateDownloadResult> {
  const isRc = params.certificateType === 'rc';
  let serverError: string | undefined;
  const docxFallbackUrls = collectRcDocxFallbackUrls(params);

  const tryRcDownload = async (docxUrl: string) =>
    downloadRcPdfViaServerConvert({
      docxUrl,
      fileName: params.fileName,
      pdfUrl: params.pdfUrl,
      docxFallbackUrls,
      clientId: params.clientId,
      chemicalId: params.chemicalId,
      registrationNumber: params.registrationNumber,
      issuedDate: params.issuedDate,
      validatedDate: params.validatedDate,
      tonnageBand: params.tonnageBand,
    });

  try {
    const pdfRes = await fetch(appendCacheBuster(params.pdfUrl), {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const contentType = pdfRes.headers.get('Content-Type') || '';

    if (pdfRes.ok) {
      if (contentType.includes('application/json')) {
        const body = (await pdfRes.json()) as {
          downloadMode?: string;
          docxUrl?: string;
          error?: string;
        };
        if (body.downloadMode === 'docx' && body.docxUrl) {
          if (isRc) {
            return tryRcDownload(body.docxUrl);
          }
          return downloadPdfFromDocxSources([body.docxUrl], params.fileName);
        }
        throw new Error(body.error || 'Certificate download failed.');
      }

      const blob = await pdfRes.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());

      if (isPdfContentType(contentType, bytes)) {
        triggerBlobDownload(new Blob([bytes], { type: 'application/pdf' }), params.fileName);
        return { format: 'pdf', fileName: params.fileName };
      }

      if (isDocxContentType(contentType)) {
        if (isRc) {
          return tryRcDownload(params.officeDocxUrl || params.previewDocxUrl || params.docxUrl);
        }
        await convertDocxBlobToPdfAndDownload(blob, params.fileName);
        return { format: 'pdf', fileName: params.fileName };
      }
    } else {
      const body = (await pdfRes.json().catch(() => null)) as { error?: string } | null;
      serverError = body?.error;
    }
  } catch (err) {
    if (err instanceof Error && !serverError) {
      serverError = err.message;
    }
  }

  const docxSources = docxFallbackUrls;

  if (docxSources.length > 0) {
    try {
      if (isRc) {
        return await tryRcDownload(docxSources[0]);
      }
      return await downloadPdfFromDocxSources(docxSources, params.fileName);
    } catch (err) {
      if (err instanceof Error) {
        serverError = err.message;
      }
    }
  }

  throw new Error(serverError || 'Failed to generate certificate PDF.');
}
