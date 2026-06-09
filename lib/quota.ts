const TONNAGE_BAND_QUOTA: Record<string, number> = {
  '1-10 tonnes': 10,
  '10-100 tonnes': 100,
  '100-1000 tonnes': 1000,
  '1000+ tonnes': 2000,
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

export function resolveQuotaConsumption(
  availableQuantity: number,
  exportedMt: number,
  tonnageBand: string | null | undefined
) {
  const calculatedTotal = Number(availableQuantity || 0) + Number(exportedMt || 0);
  const bandMax = getTonnageBandMaxQuota(tonnageBand);
  const totalQuota = bandMax != null ? bandMax : calculatedTotal;
  const exported = Math.min(Number(exportedMt || 0), totalQuota);
  const percentUsed = totalQuota > 0 ? (exported / totalQuota) * 100 : 0;

  return { exported, totalQuota, percentUsed };
}
