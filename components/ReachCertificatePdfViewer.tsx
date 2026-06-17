'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleFallback = useCallback(() => {
    onFallback?.();
  }, [onFallback]);

  const renderPdf = useCallback(async (url: string, container: HTMLDivElement) => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || 'Failed to load certificate preview.');
    }

    const contentType = res.headers.get('Content-Type') || '';
    if (!contentType.includes('application/pdf')) {
      throw new Error('Certificate preview is not available as PDF.');
    }

    const data = await res.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;

    container.innerHTML = '';
    const shell = document.createElement('div');
    shell.className = 'docx-wrapper bg-white shadow-md';
    shell.style.width = '794px';
    shell.style.maxWidth = '100%';
    container.appendChild(shell);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.className = 'block w-full h-auto';
      shell.appendChild(canvas);

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas rendering is not supported in this browser.');
      }

      await page.render({ canvasContext: context, viewport }).promise;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      container.innerHTML = '';

      try {
        await renderPdf(pdfUrl, container);
      } catch (err: unknown) {
        if (cancelled) return;
        if (fallbackDocxUrl && onFallback) {
          handleFallback();
          return;
        }
        setError(err instanceof Error ? err.message : 'Certificate preview failed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, fallbackDocxUrl, onFallback, handleFallback, renderPdf]);

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
      <div
        ref={containerRef}
        className="docx-preview-container flex justify-center py-6 [&_.docx-wrapper]:bg-white [&_.docx-wrapper]:shadow-md"
      />
    </div>
  );
}
