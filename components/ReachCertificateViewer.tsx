'use client';

import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import ReachCertificateHtmlViewer from '@/components/ReachCertificateHtmlViewer';
import TccCertificateHtmlViewer from '@/components/TccCertificateHtmlViewer';
import type { ReachCertificateHtmlData } from '@/lib/reach-certificate-html-data';
import type { TccCertificateHtmlData } from '@/lib/tcc-certificate-html-data';

type ReachCertificateViewerProps = {
  certificateType?: 'rc' | 'tcc';
  docxUrl: string;
  htmlData?: ReachCertificateHtmlData | TccCertificateHtmlData | null;
};

/**
 * RC/TCC: styled HTML preview when htmlData is provided.
 * Fallback: in-app DOCX preview.
 */
export default function ReachCertificateViewer({
  certificateType = 'tcc',
  docxUrl,
  htmlData,
}: ReachCertificateViewerProps) {
  if (certificateType === 'rc' && htmlData) {
    return (
      <ReachCertificateHtmlViewer
        key={JSON.stringify(htmlData)}
        data={htmlData as ReachCertificateHtmlData}
      />
    );
  }

  if (certificateType === 'tcc' && htmlData) {
    return (
      <TccCertificateHtmlViewer
        key={JSON.stringify(htmlData)}
        data={htmlData as TccCertificateHtmlData}
      />
    );
  }

  return <ReachCertificateDocxViewer key={docxUrl} docxUrl={docxUrl} />;
}
