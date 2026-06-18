'use client';

import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import ReachCertificatePdfViewer from '@/components/ReachCertificatePdfViewer';

type ReachCertificateViewerProps = {
  certificateType?: 'rc' | 'tcc';
  docxUrl: string;
  pdfUrl?: string;
};

/**
 * RC: PDF embed (exact Word/print layout) → DOCX fallback.
 * TCC: in-app DOCX preview.
 */
export default function ReachCertificateViewer({
  certificateType = 'tcc',
  docxUrl,
  pdfUrl,
}: ReachCertificateViewerProps) {
  if (certificateType === 'rc' && pdfUrl) {
    return (
      <ReachCertificatePdfViewer
        key={pdfUrl}
        pdfUrl={pdfUrl}
        docxFallbackUrl={docxUrl}
      />
    );
  }

  return <ReachCertificateDocxViewer key={docxUrl} docxUrl={docxUrl} />;
}
