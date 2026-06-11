'use client';

import { useState } from 'react';
import { downloadCertificatePdf } from '@/lib/download-pdf-from-docx-client';
import { toast } from '@/store/toast';

type CertificatePdfDownloadLinkProps = {
  pdfUrl: string;
  docxUrl: string;
  fileName: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
};

export function CertificatePdfDownloadLink({
  pdfUrl,
  docxUrl,
  fileName,
  className,
  children,
  title,
}: CertificatePdfDownloadLinkProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (event: React.MouseEvent | React.KeyboardEvent) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      await downloadCertificatePdf({ pdfUrl, docxUrl, fileName });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PDF download failed.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span
      role="button"
      tabIndex={loading ? -1 : 0}
      title={title}
      aria-disabled={loading}
      onClick={(event) => void handleClick(event)}
      onKeyDown={(event) => {
        if (loading) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void handleClick(event);
        }
      }}
      className={`cursor-pointer ${loading ? 'opacity-60 cursor-wait' : ''} ${className ?? ''}`}
    >
      {loading ? 'Preparing PDF…' : children}
    </span>
  );
}
