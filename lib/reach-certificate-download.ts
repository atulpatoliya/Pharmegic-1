import { REACH_CERTIFICATE_TYPE } from '@/lib/reach-certificate';
import { buildTccCertificatePdfDownloadUrl } from '@/lib/tcc-certificate-download';

export function buildReachCertificatePdfDownloadUrl(certificateId: string): string {
  return `/api/reach-certificate/pdf?certificateId=${encodeURIComponent(certificateId)}`;
}

export function buildReachCertificatePdfPreviewUrl(params: {
  clientId: string;
  chemicalId: string;
  registrationNumber?: string;
  issuedDate?: string;
  validatedDate?: string;
}): string {
  const search = new URLSearchParams({
    clientId: params.clientId,
    chemicalId: params.chemicalId,
  });
  if (params.registrationNumber) search.set('registrationNumber', params.registrationNumber);
  if (params.issuedDate) search.set('issuedDate', params.issuedDate);
  if (params.validatedDate) search.set('validatedDate', params.validatedDate);
  return `/api/reach-certificate/pdf?${search.toString()}`;
}

export function resolveReachCertificateDownloadUrl(cert: {
  id: string;
  type?: string | null;
  file_url?: string | null;
}): string {
  if (cert.type === REACH_CERTIFICATE_TYPE || cert.type === 'REACH') {
    return buildReachCertificatePdfDownloadUrl(cert.id);
  }
  if (cert.type === 'TCC') {
    return buildTccCertificatePdfDownloadUrl(cert.id);
  }
  return cert.file_url || '#';
}
