'use client';

import { useEffect, useState } from 'react';
import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';

type ReachCertificatePdfViewerProps = {
  pdfUrl: string;
  docxFallbackUrl: string;
};

/**
 * RC preview — embeds server PDF (Word layout). Falls back to DOCX when PDF is unavailable.
 */
export default function ReachCertificatePdfViewer({
  pdfUrl,
  docxFallbackUrl,
}: ReachCertificatePdfViewerProps) {
  const [mode, setMode] = useState<'loading' | 'pdf' | 'docx'>('loading');
  const [docxUrl, setDocxUrl] = useState(docxFallbackUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolvePreview = async () => {
      setMode('loading');
      setError(null);
      setDocxUrl(docxFallbackUrl);

      try {
        const res = await fetch(pdfUrl, { cache: 'no-store', credentials: 'same-origin' });
        const contentType = res.headers.get('content-type') || '';

        if (res.ok && contentType.includes('application/pdf')) {
          if (!cancelled) setMode('pdf');
          return;
        }

        if (contentType.includes('application/json')) {
          const body = (await res.json()) as {
            previewMode?: string;
            docxUrl?: string;
            error?: string;
          };
          if (body.previewMode === 'docx' && body.docxUrl) {
            if (!cancelled) {
              setDocxUrl(body.docxUrl);
              setMode('docx');
            }
            return;
          }
          throw new Error(body.error || 'PDF preview is not available.');
        }

        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || 'PDF preview is not available.');
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'PDF preview failed.');
          setMode('docx');
        }
      }
    };

    void resolvePreview();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, docxFallbackUrl]);

  if (mode === 'docx') {
    return (
      <div>
        {error && (
          <p className="px-4 py-2 text-xs font-medium text-amber-700 bg-amber-50 border-b border-amber-100">
            {error} Showing DOCX preview — layout may differ from print PDF.
          </p>
        )}
        <ReachCertificateDocxViewer key={docxUrl} docxUrl={docxUrl} />
      </div>
    );
  }

  return (
    <div className="relative min-h-[820px] bg-slate-100">
      {mode === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
          Loading certificate preview…
        </div>
      )}
      {mode === 'pdf' && (
        <iframe
          title="EU REACH certificate preview"
          src={`${pdfUrl}#toolbar=0&navpanes=0`}
          className="block w-full min-h-[820px] border-0 bg-white"
        />
      )}
    </div>
  );
}
