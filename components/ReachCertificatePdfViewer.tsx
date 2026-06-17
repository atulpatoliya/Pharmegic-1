'use client';

import { useEffect, useState } from 'react';

type ReachCertificatePdfViewerProps = {
  pdfUrl: string;
  fallbackDocxUrl?: string;
  onFallback?: () => void;
};

export default function ReachCertificatePdfViewer({
  pdfUrl,
  fallbackDocxUrl,
  onFallback,
}: ReachCertificatePdfViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      setError(null);
      setBlobUrl(null);

      try {
        const res = await fetch(pdfUrl, { credentials: 'same-origin' });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || 'Failed to load certificate preview.');
        }

        const contentType = res.headers.get('Content-Type') || '';
        if (!contentType.includes('application/pdf')) {
          throw new Error('Certificate preview is not available as PDF.');
        }

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(objectUrl);
      } catch (err: unknown) {
        if (!cancelled) {
          if (fallbackDocxUrl && onFallback) {
            onFallback();
            return;
          }
          setError(err instanceof Error ? err.message : 'Certificate preview failed.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfUrl, fallbackDocxUrl, onFallback]);

  return (
    <div className="relative min-h-[820px] bg-slate-100 overflow-auto">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
          Loading certificate preview…
        </div>
      )}
      {error && (
        <div className="p-8 text-center text-sm text-red-600 font-medium">{error}</div>
      )}
      {blobUrl && (
        <iframe
          src={blobUrl}
          title="Certificate preview"
          className="w-full min-h-[1100px] border-0 bg-white"
        />
      )}
    </div>
  );
}
