'use client';

import { renderAsync } from 'docx-preview';

function triggerBlobDownload(blob: Blob, fileName: string) {
  const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}


async function convertDocxBlobToPdfAndDownload(blob: Blob, fileName: string): Promise<void> {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:0;top:0;width:794px;max-width:100vw;opacity:0;pointer-events:none;z-index:-1;overflow:hidden;background:#fff;';
  document.body.appendChild(host);

  try {
    await renderAsync(blob, host, undefined, {
      className: 'docx-preview',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
    });

    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const wrapper = host.querySelector('.docx-wrapper') as HTMLElement | null;
    if (!wrapper) throw new Error('Certificate preview failed to render.');

    const pageElements = Array.from(wrapper.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement
    );
    const targets = pageElements.length > 0 ? pageElements : [wrapper];

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < targets.length; i++) {
      const canvas = await html2canvas(targets[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
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

export async function downloadCertificatePdf(params: {
  pdfUrl: string;
  docxUrl: string;
  fileName: string;
}): Promise<void> {
  let serverError: string | undefined;

  try {
    const pdfRes = await fetch(params.pdfUrl, { credentials: 'same-origin' });
    const contentType = pdfRes.headers.get('Content-Type') || '';

    if (pdfRes.ok) {
      const blob = await pdfRes.blob();

      if (contentType.includes('application/pdf')) {
        triggerBlobDownload(blob, params.fileName);
        return;
      }

      if (isDocxContentType(contentType)) {
        await convertDocxBlobToPdfAndDownload(blob, params.fileName);
        return;
      }
    } else {
      const body = (await pdfRes.json().catch(() => null)) as { error?: string } | null;
      serverError = body?.error;
    }
  } catch {
    // Fall through to DOCX conversion.
  }

  try {
    await downloadPdfFromDocxUrl(params.docxUrl, params.fileName);
    return;
  } catch (docxErr) {
    const docxMessage = docxErr instanceof Error ? docxErr.message : 'PDF download failed.';

    // Last resort: download the DOCX file directly when client-side PDF conversion fails.
    try {
      const docxRes = await fetch(params.docxUrl, { credentials: 'same-origin' });
      if (docxRes.ok) {
        const docxBlob = await docxRes.blob();
        const docxName = params.fileName.replace(/\.pdf$/i, '.docx');
        triggerBlobDownload(docxBlob, docxName);
        return;
      }
    } catch {
      // Fall through to error below.
    }

    throw new Error(serverError || docxMessage);
  }
}
