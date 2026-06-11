'use client';

import { renderAsync } from 'docx-preview';

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadPdfFromDocxUrl(docxUrl: string, fileName: string): Promise<void> {
  const res = await fetch(docxUrl);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Failed to load certificate document.');
  }

  const blob = await res.blob();
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;';
  document.body.appendChild(host);

  try {
    await renderAsync(blob, host, undefined, {
      className: 'docx-preview',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
    });

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
      });

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

export async function downloadCertificatePdf(params: {
  pdfUrl: string;
  docxUrl: string;
  fileName: string;
}): Promise<void> {
  try {
    const pdfRes = await fetch(params.pdfUrl);
    const contentType = pdfRes.headers.get('Content-Type') || '';
    if (pdfRes.ok && contentType.includes('application/pdf')) {
      triggerBlobDownload(await pdfRes.blob(), params.fileName);
      return;
    }
  } catch {
    // Fall through to browser-side conversion.
  }

  await downloadPdfFromDocxUrl(params.docxUrl, params.fileName);
}
