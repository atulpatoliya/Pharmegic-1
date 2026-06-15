export function buildTccCertificatePdfDownloadUrl(certificateId: string): string {
  return `/api/tcc-certificate/pdf?certificateId=${encodeURIComponent(certificateId)}`;
}

export function buildTccCertificateDocxPreviewUrl(certificateId: string): string {
  return `/api/tcc-certificate/docx?certificateId=${encodeURIComponent(certificateId)}`;
}

export function buildTccCertificateApplicationPreviewUrl(applicationId: string): string {
  return `/api/tcc-certificate/docx?applicationId=${encodeURIComponent(applicationId)}`;
}
