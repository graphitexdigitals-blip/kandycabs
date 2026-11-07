export interface DocumentDates {
  docNumber?: string;
  validFrom?: string;
  validTo?: string;
}

export type ExpirableDocKey = 'license' | 'insurance' | 'fitness' | 'tax' | 'permit' | 'puc';

export interface ExpiringDocInfo {
  docKey: ExpirableDocKey;
  docName: string;
  docNumber?: string;
  validTo: string;
  expiryDateFormatted: string;
  daysLeft: number;
  status: 'EXPIRED' | 'EXPIRES_TODAY' | 'EXPIRING_SOON';
  urgency: 'CRITICAL' | 'HIGH' | 'WARNING';
  label: string;
}

export const EXPIRABLE_DOCS: Record<ExpirableDocKey, { name: string; shortName: string }> = {
  license: { name: 'Driving License (DL)', shortName: 'Driving License' },
  insurance: { name: 'Vehicle Insurance Policy', shortName: 'Insurance' },
  fitness: { name: 'Fitness Certificate (FC Book)', shortName: 'Fitness (FC)' },
  tax: { name: 'Road Tax Receipt', shortName: 'Road Tax' },
  permit: { name: 'Commercial / Tourist Permit', shortName: 'Permit' },
  puc: { name: 'Pollution (PUC) Certificate', shortName: 'PUC / Emission' },
};

/**
 * Parses dates formatted as DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, or ISO.
 */
export function parseDocExpiryDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const str = dateStr.trim();
  if (!str) return null;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Evaluates all documents for a driver and returns those expiring within `thresholdDays` (default 5 days) or already expired.
 */
export function getExpiringDocuments(
  docDates: Record<string, DocumentDates> | null | undefined,
  thresholdDays = 5
): ExpiringDocInfo[] {
  if (!docDates || typeof docDates !== 'object') return [];

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const results: ExpiringDocInfo[] = [];

  for (const [key, meta] of Object.entries(EXPIRABLE_DOCS)) {
    const docData = docDates[key];
    if (!docData || !docData.validTo || !docData.validTo.trim()) {
      continue;
    }

    const expiryDate = parseDocExpiryDate(docData.validTo);
    if (!expiryDate) continue;

    const expiryMidnight = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate()).getTime();
    const diffMs = expiryMidnight - todayMidnight;
    const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysLeft <= thresholdDays) {
      const isExpired = daysLeft < 0;
      const isToday = daysLeft === 0;

      let status: 'EXPIRED' | 'EXPIRES_TODAY' | 'EXPIRING_SOON' = 'EXPIRING_SOON';
      let urgency: 'CRITICAL' | 'HIGH' | 'WARNING' = 'WARNING';
      let label = `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

      if (isExpired) {
        status = 'EXPIRED';
        urgency = 'CRITICAL';
        const absDays = Math.abs(daysLeft);
        label = `Expired ${absDays} day${absDays === 1 ? '' : 's'} ago`;
      } else if (isToday) {
        status = 'EXPIRES_TODAY';
        urgency = 'HIGH';
        label = 'Expires today';
      }

      const dStr = String(expiryDate.getDate()).padStart(2, '0');
      const mStr = String(expiryDate.getMonth() + 1).padStart(2, '0');
      const yStr = String(expiryDate.getFullYear());

      results.push({
        docKey: key as ExpirableDocKey,
        docName: meta.name,
        docNumber: docData.docNumber,
        validTo: docData.validTo,
        expiryDateFormatted: `${dStr}/${mStr}/${yStr}`,
        daysLeft,
        status,
        urgency,
        label,
      });
    }
  }

  // Sort: most critical (expired first, then nearest to expiry)
  return results.sort((a, b) => a.daysLeft - b.daysLeft);
}

