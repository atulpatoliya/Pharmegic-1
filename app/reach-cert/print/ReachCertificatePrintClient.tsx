'use client';

import { useEffect } from 'react';
import ReachCertificateHtmlDocument from '@/components/ReachCertificateHtmlDocument';
import type { ReachCertificateHtmlData } from '@/lib/reach-certificate-html-data';
import '@/components/reach-certificate-html.css';

type ReachCertificatePrintClientProps = {
  data: ReachCertificateHtmlData;
};

export default function ReachCertificatePrintClient({ data }: ReachCertificatePrintClientProps) {
  useEffect(() => {
    document.body.setAttribute('data-reach-pdf-ready', 'true');
    return () => {
      document.body.removeAttribute('data-reach-pdf-ready');
    };
  }, []);

  return (
    <div style={{ margin: 0, padding: 0, background: '#ffffff' }}>
      <ReachCertificateHtmlDocument data={data} />
    </div>
  );
}
