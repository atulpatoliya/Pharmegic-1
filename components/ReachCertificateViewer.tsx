'use client';

import type { CertificateTemplateKey } from '@/lib/certificate-template-config';
import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import ReachCertificatePdfViewer from '@/components/ReachCertificatePdfViewer';

type ReachCertificateViewerProps = {
  templateKey?: CertificateTemplateKey;
  docxUrl: string;
  pdfUrl: string;
};

/** Template 1: DOCX preview. Template 2: server PDF (matches Word/print layout). */
export default function ReachCertificateViewer({
  templateKey = 'template_1',
  docxUrl,
  pdfUrl,
}: ReachCertificateViewerProps) {
  if (templateKey === 'template_2') {
    return <ReachCertificatePdfViewer key={pdfUrl} pdfUrl={pdfUrl} />;
  }

  return <ReachCertificateDocxViewer key={docxUrl} docxUrl={docxUrl} />;
}
