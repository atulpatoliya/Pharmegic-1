'use client';

import { useEffect, useState } from 'react';
import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import ReachCertificateOfficeViewer from '@/components/ReachCertificateOfficeViewer';
import ReachCertificatePdfViewer from '@/components/ReachCertificatePdfViewer';

type ReachCertificateViewerProps = {
  certificateType?: 'rc' | 'tcc';
  docxUrl: string;
  pdfUrl: string;
  directPdfUrl?: string | null;
  directDocxUrl?: string | null;
  onPreviewDocxUrl?: (docxUrl: string) => void;
};

/**
 * RC preview: PDF when available; otherwise full-layout Word via Office Online embed.
 * Never shows a broken flattened DOCX layout.
 */
export default function ReachCertificateViewer({
  certificateType = 'rc',
  docxUrl,
  pdfUrl,
  directPdfUrl,
  directDocxUrl,
  onPreviewDocxUrl,
}: ReachCertificateViewerProps) {
  const [officeDocxUrl, setOfficeDocxUrl] = useState<string | null>(directDocxUrl || null);
  const [preferDirectPdf, setPreferDirectPdf] = useState(Boolean(directPdfUrl && !directDocxUrl));

  useEffect(() => {
    if (directDocxUrl) {
      onPreviewDocxUrl?.(directDocxUrl);
    }
  }, [directDocxUrl, onPreviewDocxUrl]);

  const handleDocxPreview = (url: string) => {
    setPreferDirectPdf(false);
    setOfficeDocxUrl(url);
    onPreviewDocxUrl?.(url);
  };

  if (certificateType === 'rc') {
    if (officeDocxUrl) {
      return <ReachCertificateOfficeViewer key={officeDocxUrl} docxUrl={officeDocxUrl} />;
    }

    const activePdfUrl = preferDirectPdf && directPdfUrl ? directPdfUrl : pdfUrl;

    return (
      <ReachCertificatePdfViewer
        key={activePdfUrl}
        pdfUrl={activePdfUrl}
        fallbackPdfUrl={preferDirectPdf ? pdfUrl : directPdfUrl}
        onDocxPreview={handleDocxPreview}
      />
    );
  }

  return <ReachCertificateDocxViewer key={docxUrl} docxUrl={docxUrl} />;
}
