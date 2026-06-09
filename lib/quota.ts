const TONNAGE_BAND_QUOTA: Record<string, number> = {
  '1-10 tonnes': 10,
  '10-100 tonnes': 100,
  '100-1000 tonnes': 1000,
  '1000+ tonnes': 20000,
};

export type TccExportRecord = {
  chemical_id?: string;
  quantity_mt?: number | string | null;
  status?: string;
  export_date?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  certificates?:
    | { issued_at?: string | null }
    | { issued_at?: string | null }[]
    | null;
};

export function getTonnageBandMaxQuota(tonnageBand: string | null | undefined): number | null {
  if (!tonnageBand?.trim()) return null;

  const known = TONNAGE_BAND_QUOTA[tonnageBand.trim()];
  if (known != null) return known;

  const rangeMatch = tonnageBand.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) return Number(rangeMatch[2]);

  const plusMatch = tonnageBand.match(/(\d+(?:\.\d+)?)\s*\+/);
  if (plusMatch) return Number(plusMatch[1]);

  return null;
}

export function getTccCertificateDate(app: TccExportRecord): Date | null {
  const cert = app.certificates;
  const resolved = Array.isArray(cert) ? cert[0] : cert;
  const raw = resolved?.issued_at || app.export_date || app.updated_at || app.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Sum approved certificate tonnage for a chemical, optionally filtered to a calendar year. */
export function sumApprovedExports(
  applications: TccExportRecord[],
  chemicalId: string,
  year: number | null = new Date().getFullYear()
): number {
  return applications
    .filter((app) => app.chemical_id === chemicalId && app.status === 'approved')
    .filter((app) => {
      if (year === null) return true;
      const d = getTccCertificateDate(app);
      return d?.getFullYear() === year;
    })
    .reduce((sum, app) => sum + Number(app.quantity_mt ?? 0), 0);
}

export function resolveQuotaConsumption(
  exportedMt: number,
  tonnageBand: string | null | undefined,
  availableQuantity = 0
) {
  const bandMax = getTonnageBandMaxQuota(tonnageBand);
  const exported = Number(exportedMt || 0);
  const calculatedTotal = Number(availableQuantity || 0) + exported;
  const totalQuota = bandMax != null ? bandMax : calculatedTotal;
  const isExceeded = totalQuota > 0 && exported > totalQuota;
  const percentUsed = totalQuota > 0 ? (exported / totalQuota) * 100 : 0;
  const remaining = Math.max(0, totalQuota - exported);

  return { exported, totalQuota, percentUsed, isExceeded, remaining };
}

export function getRemainingQuota(
  availableQuantity: number,
  exportedMt: number,
  tonnageBand: string | null | undefined
): number {
  const bandMax = getTonnageBandMaxQuota(tonnageBand);
  if (bandMax != null) {
    return Math.max(0, bandMax - Number(exportedMt || 0));
  }
  return Math.max(0, Number(availableQuantity || 0));
}

export function computeAssignableQuota(
  bandMax: number,
  exportedMt: number
): { assignable: number; error?: string } {
  const remaining = bandMax - Number(exportedMt || 0);
  if (remaining <= 0) {
    return {
      assignable: 0,
      error: `${exportedMt} MT already issued this year. Tonnage band limit is ${bandMax} MT — no quota left to assign.`,
    };
  }
  return { assignable: remaining };
}
