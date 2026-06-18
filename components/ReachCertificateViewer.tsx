'use client';

import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import ReachCertificateHtmlViewer from '@/components/ReachCertificateHtmlViewer';
import type { ReachCertificateHtmlData } from '@/lib/reach-certificate-html-data';

type ReachCertificateViewerProps = {
  certificateType?: 'rc' | 'tcc';
  docxUrl: string;
  htmlData?: ReachCertificateHtmlData | null;
};

/**
 * RC: styled HTML preview (exact certificate design).
 * TCC: in-app DOCX preview.
 */
export default function ReachCertificateViewer({
  certificateType = 'tcc',
  docxUrl,
  htmlData,
}: ReachCertificateViewerProps) {
  if (certificateType === 'rc' && htmlData) {
    return <ReachCertificateHtmlViewer key={JSON.stringify(htmlData)} data={htmlData} />;
  }

  return <ReachCertificateDocxViewer key={docxUrl} docxUrl={docxUrl} />;
}
