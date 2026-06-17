'use client';

import { useState } from 'react';
import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import ReachCertificatePdfViewer from '@/components/ReachCertificatePdfViewer';

type ReachCertificateViewerProps = {
  docxUrl: string;
  pdfUrl?: string;
  preferPdf?: boolean;
};

export default function ReachCertificateViewer({
  docxUrl,
  pdfUrl,
  preferPdf = false,
}: ReachCertificateViewerProps) {
  const [useDocxFallback, setUseDocxFallback] = useState(false);

  if (preferPdf && pdfUrl && !useDocxFallback) {
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
