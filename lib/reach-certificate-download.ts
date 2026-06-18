import { REACH_CERTIFICATE_TYPE } from '@/lib/reach-certificate';
import { buildTccCertificatePdfDownloadUrl } from '@/lib/tcc-certificate-download';

export function buildReachCertificatePdfDownloadUrl(certificateId: string): string {
  return buildReachCertificatePdfPreviewUrlByCertificateId(certificateId);
}

export function buildReachCertificateHtmlDataUrl(params: {
  certificateId?: string;
  clientId?: string;
  chemicalId?: string;
  registrationNumber?: string;
  issuedDate?: string;
  validatedDate?: string;
  tonnageBand?: string | null;
}): string {
  const search = new URLSearchParams();
  if (params.certificateId) search.set('certificateId', params.certificateId);
  if (params.clientId) search.set('clientId', params.clientId);
  if (params.chemicalId) search.set('chemicalId', params.chemicalId);
  if (params.registrationNumber) search.set('registrationNumber', params.registrationNumber);
  if (params.issuedDate) search.set('issuedDate', params.issuedDate);
  if (params.validatedDate) search.set('validatedDate', params.validatedDate);
  if (params.tonnageBand !== undefined && params.tonnageBand !== null) {
    search.set('tonnageBand', params.tonnageBand);
  }
  return `/api/reach-certificate/html-data?${search.toString()}`;
}

export function buildReachCertificateConvertPdfUrl(params: {
  docxUrl?: string;
  certificateId?: string;
  fileName?: string;
  clientId?: string;
  chemicalId?: string;
  registrationNumber?: string;
  issuedDate?: string;
  validatedDate?: string;
  tonnageBand?: string | null;
}): string {
  const search = new URLSearchParams();
  if (params.docxUrl) search.set('docxUrl', params.docxUrl);
  if (params.certificateId) search.set('certificateId', params.certificateId);
  if (params.fileName) search.set('fileName', params.fileName);
  if (params.clientId) search.set('clientId', params.clientId);
  if (params.chemicalId) search.set('chemicalId', params.chemicalId);
  if (params.registrationNumber) search.set('registrationNumber', params.registrationNumber);
  if (params.issuedDate) search.set('issuedDate', params.issuedDate);
  if (params.validatedDate) search.set('validatedDate', params.validatedDate);
  if (params.tonnageBand !== undefined && params.tonnageBand !== null) {
    search.set('tonnageBand', params.tonnageBand);
  }
  return `/api/reach-certificate/convert-pdf?${search.toString()}`;
}

export function buildReachCertificateDocxPreviewUrl(certificateId: string): string {
  return `/api/reach-certificate/docx?certificateId=${encodeURIComponent(certificateId)}`;
}

export function buildReachCertificatePdfPreviewUrlByCertificateId(certificateId: string): string {
  return `/api/reach-certificate/preview/pdf?certificateId=${encodeURIComponent(certificateId)}`;
}

export function buildReachCertificatePdfPreviewUrl(params: {
  clientId: string;
  chemicalId: string;
  registrationNumber?: string;
  issuedDate?: string;
  validatedDate?: string;
  tonnageBand?: string | null;
}): string {
  const search = new URLSearchParams({
    clientId: params.clientId,
    chemicalId: params.chemicalId,
  });
  if (params.registrationNumber) search.set('registrationNumber', params.registrationNumber);
  if (params.issuedDate) search.set('issuedDate', params.issuedDate);
  if (params.validatedDate) search.set('validatedDate', params.validatedDate);
  if (params.tonnageBand !== undefined && params.tonnageBand !== null) {
    search.set('tonnageBand', params.tonnageBand);
  }
  return `/api/reach-certificate/preview/pdf?${search.toString()}`;
}

export function buildReachCertificatePdfDownloadUrlByClientChemical(params: {
  clientId: string;
  chemicalId: string;
  registrationNumber?: string;
  issuedDate?: string;
  validatedDate?: string;
  tonnageBand?: string | null;
}): string {
  return buildReachCertificatePdfPreviewUrl(params);
}

export function buildReachCertificateDocxPreviewUrlByClientChemical(params: {
  clientId: string;
  chemicalId: string;
  registrationNumber?: string;
  issuedDate?: string;
  validatedDate?: string;
  tonnageBand?: string | null;
}): string {
  const search = new URLSearchParams({
    clientId: params.clientId,
    chemicalId: params.chemicalId,
  });
  if (params.registrationNumber) search.set('registrationNumber', params.registrationNumber);
  if (params.issuedDate) search.set('issuedDate', params.issuedDate);
  if (params.validatedDate) search.set('validatedDate', params.validatedDate);
  if (params.tonnageBand !== undefined && params.tonnageBand !== null) {
    search.set('tonnageBand', params.tonnageBand);
  }
  return `/api/reach-certificate/docx?${search.toString()}`;
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
