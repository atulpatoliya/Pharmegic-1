'use client';

import { useState } from 'react';
import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import ReachCertificateOfficeViewer from '@/components/ReachCertificateOfficeViewer';
import ReachCertificatePdfViewer from '@/components/ReachCertificatePdfViewer';

type ReachCertificateViewerProps = {
  certificateType?: 'rc' | 'tcc';
  docxUrl: string;
  pdfUrl?: string;
};

/**
 * RC: server PDF (exact layout) → Office Online embed (exact Word file on live) → DOCX preview last resort.
 * TCC: in-app DOCX preview.
 */
export default function ReachCertificateViewer({
  certificateType = 'rc',
  docxUrl,
  pdfUrl,
}: ReachCertificateViewerProps) {
  const [officeDocxUrl, setOfficeDocxUrl] = useState<string | null>(null);
  const [useDocxFallback, setUseDocxFallback] = useState(false);

  if (certificateType === 'rc') {
    if (officeDocxUrl) {
      return <ReachCertificateOfficeViewer key={officeDocxUrl} docxUrl={officeDocxUrl} />;
    }

    if (pdfUrl && !useDocxFallback) {
      return (
        <ReachCertificatePdfViewer
          key={pdfUrl}
          pdfUrl={pdfUrl}
          onOfficeDocxUrl={setOfficeDocxUrl}
          onUnavailable={() => setUseDocxFallback(true)}
        />
      );
    }
  }

  return <ReachCertificateDocxViewer key={docxUrl} docxUrl={docxUrl} />;
}
