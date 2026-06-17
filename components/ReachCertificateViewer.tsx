'use client';

import { useState } from 'react';
import type { CertificateTemplateKey } from '@/lib/certificate-template-config';
import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import ReachCertificatePdfViewer from '@/components/ReachCertificatePdfViewer';

type ReachCertificateViewerProps = {
  templateKey?: CertificateTemplateKey;
  docxUrl: string;
  pdfUrl: string;
  preferPdf?: boolean;
};

/**
 * Template 1: DOCX preview.
 * Template 2: PDF when server can convert (Word/LibreOffice/Gotenberg), else DOCX preview.
 */
export default function ReachCertificateViewer({
  templateKey = 'template_1',
  docxUrl,
  pdfUrl,
  preferPdf = false,
}: ReachCertificateViewerProps) {
  const [useDocxFallback, setUseDocxFallback] = useState(false);

  const wantsPdf = preferPdf || templateKey === 'template_2';

  if (wantsPdf && pdfUrl && !useDocxFallback) {
    return (
      <ReachCertificatePdfViewer
        key={pdfUrl}
        pdfUrl={pdfUrl}
        fallbackDocxUrl={docxUrl}
        onFallback={() => setUseDocxFallback(true)}
      />
    );
  }

  return <ReachCertificateDocxViewer key={docxUrl} docxUrl={docxUrl} />;
}
