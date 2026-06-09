export const REACH_CERTIFICATE_TYPE = 'REACH';

export type ReachCertificateRecord = {
  id: string;
  certificate_number: string;
  chemical_id?: string | null;
  issued_at: string;
  expires_at: string | null;
  status: string;
  file_url?: string | null;
  type?: string | null;
};

export function isActiveReachCertificate(
  cert: ReachCertificateRecord | null | undefined,
  asOf: Date = new Date()
): boolean {
  if (!cert) return false;
  if (cert.type && cert.type !== REACH_CERTIFICATE_TYPE) return false;
  if (cert.status !== 'active') return false;
  if (!cert.expires_at) return false;
  return new Date(cert.expires_at) > asOf;
}

export function getReachCertificateStatus(
  cert: ReachCertificateRecord | null | undefined,
  asOf: Date = new Date()
): 'valid' | 'expired' | 'revoked' | 'missing' {
  if (!cert) return 'missing';
  if (cert.status === 'revoked') return 'revoked';
  if (!cert.expires_at || new Date(cert.expires_at) <= asOf) return 'expired';
  if (cert.status === 'active') return 'valid';
  return 'expired';
}

/** Latest REACH certificate per chemical_id for a client. */
export function mapLatestReachByChemical(
  certificates: ReachCertificateRecord[]
): Map<string, ReachCertificateRecord> {
  const map = new Map<string, ReachCertificateRecord>();
  for (const cert of certificates) {
    if (cert.type !== REACH_CERTIFICATE_TYPE || !cert.chemical_id) continue;
    const existing = map.get(cert.chemical_id);
    if (!existing || new Date(cert.issued_at) > new Date(existing.issued_at)) {
      map.set(cert.chemical_id, cert);
    }
  }
  return map;
}

export function addOneYear(from: Date = new Date()): Date {
  const expiry = new Date(from);
  expiry.setFullYear(expiry.getFullYear() + 1);
  return expiry;
}
