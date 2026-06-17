'use client';

import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import ReachCertificatePdfViewer from '@/components/ReachCertificatePdfViewer';

type ReachCertificateViewerProps = {
  certificateType?: 'rc' | 'tcc';
  docxUrl: string;
  pdfUrl?: string;
};

/**
 * RC: server PDF (exact Word/print layout). TCC: in-app DOCX preview.
 */
export default function ReachCertificateViewer({
  certificateType = 'rc',
  docxUrl,
  pdfUrl,
}: ReachCertificateViewerProps) {
  if (certificateType === 'rc' && pdfUrl) {
    return <ReachCertificatePdfViewer key={pdfUrl} pdfUrl={pdfUrl} />;
  }

  return <ReachCertificateDocxViewer key={docxUrl} docxUrl={docxUrl} />;
}
