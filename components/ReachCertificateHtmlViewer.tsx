'use client';

import ReachCertificateHtmlDocument from '@/components/ReachCertificateHtmlDocument';
import type { ReachCertificateHtmlData } from '@/lib/reach-certificate-html-data';
import '@/components/reach-certificate-html.css';

type ReachCertificateHtmlViewerProps = {
  data: ReachCertificateHtmlData;
};

export default function ReachCertificateHtmlViewer({ data }: ReachCertificateHtmlViewerProps) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Tinos:wght@400;700&display=swap"
      />
      <div
        data-reach-cert-print-area
        className="min-h-[820px] bg-slate-100 overflow-auto p-[50px] print:min-h-0 print:h-auto print:bg-white print:p-0 print:overflow-visible"
      >
      <div className="mx-auto w-fit shadow-md print:mx-0 print:w-full print:shadow-none">
        <ReachCertificateHtmlDocument data={data} />
      </div>
    </div>
    </>
  );
}
