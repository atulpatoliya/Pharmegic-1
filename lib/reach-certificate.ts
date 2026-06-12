export const REACH_CERTIFICATE_TYPE = 'REACH';

export function isReachCertificateType(cert: {
  type?: string | null;
  certificate_number?: string | null;
}): boolean {
  const type = cert.type?.trim().toUpperCase();
  if (type === REACH_CERTIFICATE_TYPE || type === 'RC') return true;
  const number = cert.certificate_number?.trim().toUpperCase() ?? '';
  return number.startsWith('RC-');
}

export function getLatestReachCertForChemical(
  certificates: ReachCertificateRecord[],
  chemicalId: string,
  casNumber?: string | null
): ReachCertificateRecord | null {
  let matches = certificates.filter(
    (cert) =>
      cert.chemical_id === chemicalId &&
      isReachCertificateType(cert) &&
      cert.status !== 'revoked'
  );

  if (matches.length === 0 && casNumber?.trim()) {
    const cas = casNumber.trim().toLowerCase();
    matches = certificates.filter((cert) => {
      if (!isReachCertificateType(cert) || cert.status === 'revoked') return false;
      const certCas =
        (cert as { chemicals?: { cas_number?: string | null } }).chemicals?.cas_number ??
        (cert as { chemical?: { cas_number?: string | null } }).chemical?.cas_number;
      return certCas?.trim().toLowerCase() === cas;
    });
  }

  if (matches.length === 0) return null;
  return [...matches].sort(
    (a, b) =>
      new Date(b.issued_at || 0).getTime() - new Date(a.issued_at || 0).getTime()
  )[0];
}

export type ReachCertificateRecord = {
  id: string;
  certificate_number: string;
  registration_number?: string | null;
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

/** RC badge status for substance table — falls back to client_chemicals.validity_date when no cert exists. */
export function getSubstanceRcBadgeStatus(
  cert: ReachCertificateRecord | null | undefined,
  validityDate: string | null | undefined,
  asOf: Date = new Date()
): 'valid' | 'expired' | 'revoked' | 'missing' {
  if (cert) return getReachCertificateStatus(cert, asOf);
  if (validityDate?.trim()) {
    const end = endOfDay(new Date(validityDate.trim().split('T')[0] + 'T12:00:00'));
    if (!Number.isNaN(end.getTime()) && end < asOf) return 'expired';
  }
  return 'missing';
}

export function hasNewerReachCertificate(
  certs: ReachCertificateRecord[],
  cert: ReachCertificateRecord
): boolean {
  const issuedAt = new Date(cert.issued_at).getTime();
  return certs.some(
    (other) => other.id !== cert.id && new Date(other.issued_at).getTime() > issuedAt
  );
}

/** True when admin may issue a renewed RC (no active cert; at least one expired or past validity). */
export function canRenewReachForChemical(
  certs: ReachCertificateRecord[],
  validityDate: string | null | undefined
): boolean {
  if (certs.some((c) => isActiveReachCertificate(c))) return false;
  if (certs.some((c) => getReachCertificateStatus(c) === 'expired')) return true;
  return getSubstanceRcBadgeStatus(null, validityDate) === 'expired';
}

/** Latest REACH certificate per chemical_id for a client. */
export function mapLatestReachByChemical(
  certificates: ReachCertificateRecord[]
): Map<string, ReachCertificateRecord> {
  const map = new Map<string, ReachCertificateRecord>();
  for (const cert of certificates) {
    if (!isReachCertificateType(cert) || !cert.chemical_id) continue;
    const existing = map.get(cert.chemical_id);
    if (!existing || new Date(cert.issued_at) > new Date(existing.issued_at)) {
      map.set(cert.chemical_id, cert);
    }
  }
  return map;
}

/** All REACH certificates grouped by chemical_id (newest first per chemical). */
export function mapAllReachByChemical(
  certificates: ReachCertificateRecord[]
): Map<string, ReachCertificateRecord[]> {
  const map = new Map<string, ReachCertificateRecord[]>();
  for (const cert of certificates) {
    if (!isReachCertificateType(cert) || !cert.chemical_id) continue;
    if (cert.status === 'revoked') continue;
    const list = map.get(cert.chemical_id) ?? [];
    list.push(cert);
    map.set(cert.chemical_id, list);
  }
  for (const [chemicalId, list] of map) {
    list.sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime());
    map.set(chemicalId, list);
  }
  return map;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Whether a calendar date falls within an RC validity window (inclusive). */
export function isDateInReachWindow(
  date: string | Date,
  issuedAt: string,
  expiresAt: string | null
): boolean {
  const d = startOfDay(new Date(date));
  const issued = startOfDay(new Date(issuedAt));
  if (d < issued) return false;
  if (!expiresAt) return true;
  const expires = endOfDay(new Date(expiresAt));
  return d <= expires;
}

/** RC certificate whose validity window contains the export shipment date. */
export function findReachCertificateForExportDate(
  certificates: ReachCertificateRecord[],
  chemicalId: string,
  exportDate: string | Date
): ReachCertificateRecord | null {
  const matches = certificates
    .filter(
      (cert) =>
        cert.chemical_id === chemicalId &&
        isReachCertificateType(cert) &&
        cert.status !== 'revoked' &&
        isDateInReachWindow(exportDate, cert.issued_at, cert.expires_at)
    )
    .sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime());

  return matches[0] ?? null;
}

export function doReachValidityPeriodsOverlap(
  issuedA: string | Date,
  expiresA: string | Date | null,
  issuedB: string | Date,
  expiresB: string | Date | null
): boolean {
  const startA = startOfDay(new Date(issuedA)).getTime();
  const endA = expiresA ? endOfDay(new Date(expiresA)).getTime() : Number.POSITIVE_INFINITY;
  const startB = startOfDay(new Date(issuedB)).getTime();
  const endB = expiresB ? endOfDay(new Date(expiresB)).getTime() : Number.POSITIVE_INFINITY;
  return startA <= endB && startB <= endA;
}

export function addOneYear(from: Date = new Date()): Date {
  const expiry = new Date(from);
  expiry.setFullYear(expiry.getFullYear() + 1);
  return expiry;
}

/** YYYY-MM-DD for December 31 of the given year (defaults to current year). */
export function getLastDateOfYear(year: number = new Date().getFullYear()): string {
  return `${year}-12-31`;
}

/** YYYY-MM-DD for today (local date). */
export function getTodayDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
