'use client';

import { useState } from 'react';
import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import ReachCertificatePdfViewer from '@/components/ReachCertificatePdfViewer';

type ReachCertificateViewerProps = {
  certificateType?: 'rc' | 'tcc';
  docxUrl: string;
  pdfUrl?: string;
};

/**
 * RC: server PDF when available (exact print layout); falls back to DOCX preview on live
 * servers without LibreOffice/Gotenberg — same approach as TCC.
 */
export default function ReachCertificateViewer({
  certificateType = 'rc',
  docxUrl,
  pdfUrl,
}: ReachCertificateViewerProps) {
  const [useDocxFallback, setUseDocxFallback] = useState(false);

  if (certificateType === 'rc' && pdfUrl && !useDocxFallback) {
    return (
      <ReachCertificatePdfViewer
        key={pdfUrl}
        pdfUrl={pdfUrl}
        onUnavailable={() => setUseDocxFallback(true)}
      />
    );
  }

  return <ReachCertificateDocxViewer key={docxUrl} docxUrl={docxUrl} />;
}
