'use client';

import { useState } from 'react';
import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import ReachCertificatePdfViewer from '@/components/ReachCertificatePdfViewer';

type ReachCertificateViewerProps = {
  certificateType?: 'rc' | 'tcc';
  docxUrl: string;
  pdfUrl: string;
};

/** RC: PDF preview from current template; falls back to DOCX if PDF unavailable. */
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
        fallbackDocxUrl={docxUrl}
        onFallback={() => setUseDocxFallback(true)}
      />
    );
  }

  return <ReachCertificateDocxViewer key={docxUrl} docxUrl={docxUrl} />;
}
