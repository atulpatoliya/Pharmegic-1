'use client';

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

async function downloadDocxFromUrl(docxUrl: string, fileName: string): Promise<CertificateDownloadResult> {
  const res = await fetch(appendCacheBuster(docxUrl), {
    credentials: docxUrl.startsWith('/') ? 'same-origin' : 'omit',
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Failed to load certificate document.');
  }
  const docxName = fileName.replace(/\.pdf$/i, '.docx');
  triggerBlobDownload(await res.blob(), docxName);
  return { format: 'docx', fileName: docxName };
}

function findDocxWrapper(host: HTMLElement): HTMLElement | null {
  return (
    host.querySelector(`.${DOCX_PREVIEW_CLASS}-wrapper`) ??
    host.querySelector('.docx-wrapper') ??
    host.querySelector('.docx-preview-wrapper')
  );
}

function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 200);
      });
    });
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
  ].join(';');
  document.body.appendChild(host);

  try {
    await renderAsync(blob, host, host, {
      className: DOCX_PREVIEW_CLASS,
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
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

    for (let i = 0; i < targets.length; i++) {
      const canvas = await html2canvas(targets[i], {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: targets[i].scrollWidth,
        height: targets[i].scrollHeight,
        onclone: (_doc, clonedElement) => {
          clonedElement.style.opacity = '1';
          clonedElement.style.visibility = 'visible';
          clonedElement.style.transform = 'none';
          clonedElement.style.clip = 'auto';
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

export type CertificateDownloadResult = {
  format: 'pdf' | 'docx';
  fileName: string;
};

function appendCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_=${Date.now()}`;
}

export async function downloadCertificatePdf(params: {
  pdfUrl: string;
  docxUrl: string;
  fileName: string;
  /** Same public DOCX URL shown in Office Online preview (full layout). */
  previewDocxUrl?: string | null;
  /** RC certificates must not use browser DOCX→PDF (broken layout on live). */
  certificateType?: 'rc' | 'tcc';
}): Promise<CertificateDownloadResult> {
  let serverError: string | undefined;

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
          fileName?: string;
          error?: string;
        };
        if (body.downloadMode === 'docx' && body.docxUrl) {
          return downloadDocxFromUrl(body.docxUrl, body.fileName || params.fileName);
        }
        throw new Error(body.error || 'Certificate download failed.');
      }

      const blob = await pdfRes.blob();

      if (contentType.includes('application/pdf')) {
        triggerBlobDownload(blob, params.fileName);
        return { format: 'pdf', fileName: params.fileName };
      }

      if (isDocxContentType(contentType)) {
        if (params.certificateType === 'rc') {
          const docxName = params.fileName.replace(/\.pdf$/i, '.docx');
          triggerBlobDownload(blob, docxName);
          return { format: 'docx', fileName: docxName };
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

  const docxSources = [params.previewDocxUrl, params.docxUrl].filter(
    (url): url is string => Boolean(url?.trim())
  );

  if (params.certificateType === 'rc') {
    for (const docxUrl of docxSources) {
      try {
        return await downloadDocxFromUrl(docxUrl, params.fileName);
      } catch (err) {
        if (err instanceof Error) {
          serverError = err.message;
        }
      }
    }
    throw new Error(
      serverError ||
        'PDF conversion is not available on this server. Install LibreOffice or set GOTENBERG_URL, or download the Word file.'
    );
  }

  let lastError = serverError;
  for (const docxUrl of docxSources) {
    try {
      const docxRes = await fetch(appendCacheBuster(docxUrl), {
        credentials: docxUrl.startsWith('/') ? 'same-origin' : 'omit',
        cache: 'no-store',
      });
      if (!docxRes.ok) {
        const body = (await docxRes.json().catch(() => null)) as { error?: string } | null;
        lastError = body?.error || serverError;
        continue;
      }
      await convertDocxBlobToPdfAndDownload(await docxRes.blob(), params.fileName);
      return { format: 'pdf', fileName: params.fileName };
    } catch (err) {
      if (err instanceof Error) {
        lastError = err.message;
      }
    }
  }

  throw new Error(lastError || 'Failed to load certificate document.');
}
