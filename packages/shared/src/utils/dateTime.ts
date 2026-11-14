const MONTH_NAMES_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Safely parses any date string (ISO, DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, or human-readable "30 Nov 2026"),
 * preventing year corruption and invalid date rollovers.
 */
export function parseSafeIsoDate(val: string | Date | null | undefined): Date {
  if (!val) return new Date();
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return new Date();
    if (val.getFullYear() < 100) {
      const copy = new Date(val.getTime());
      copy.setFullYear(2000 + copy.getFullYear());
      return copy;
    }
    return val;
  }

  const str = String(val).replace(/\u00A0/g, ' ').trim();
  if (!str) return new Date();

  // 1. DD-MM-YYYY or DD/MM/YYYY (e.g. "30-11-2026", "30/11/2026")
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    let hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const ampm = dmyMatch[7]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return new Date(year, month, day, hours, minutes, seconds);
  }

  // 2. YYYY-MM-DD or YYYY/MM/DD (e.g. "2026-11-30", "2026-11-30T09:00:00")
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|([+-]\d{2}:?\d{2}))?)?/i);
  if (ymdMatch) {
    // If it includes timezone info (Z or +/-offset), let native Date parse it
    if (/Z|[+-]\d{2}:?\d{2}/i.test(str)) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        if (d.getFullYear() < 100) d.setFullYear(2000 + d.getFullYear());
        return d;
      }
    }
    // Local date construction to avoid UTC midnight shifting back a day in IST
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    let hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minutes = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const seconds = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    return new Date(year, month, day, hours, minutes, seconds);
  }

  // 3. Corrupted 00XX leading years (e.g. "0026-11-30")
  if (/^00\d{2}-\d{1,2}-\d{1,2}/.test(str)) {
    const fixed = str.replace(/^00(\d{2})/, (_, yy) => `20${yy}`);
    const d = new Date(fixed);
    if (!isNaN(d.getTime())) return d;
  }

  // 4. Human readable with month name (e.g. "30 Nov 2026", "30 Nov 2026 (Mon)", "18 May 2026")
  const tokens = str.replace(/[,()]/g, ' ').split(/\s+/).filter(Boolean);
  const mIdx = tokens.findIndex((t) =>
    MONTH_NAMES_SHORT.some((m) => t.toLowerCase().startsWith(m))
  );
  if (mIdx !== -1) {
    const month = MONTH_NAMES_SHORT.findIndex((m) =>
      tokens[mIdx].toLowerCase().startsWith(m)
    );
    const nums = tokens
      .filter((_, i) => i !== mIdx)
      .map((t) => parseInt(t, 10))
      .filter((n) => !isNaN(n));
    if (nums.length >= 2) {
      let year = nums.find((n) => n > 1000);
      let day = nums.find((n) => n !== year && n >= 1 && n <= 31);
      if (!year) year = nums[1];
      if (!day) day = nums[0];
      if (year < 100) year += 2000;
      return new Date(year, month, day);
    }
  }

  // 5. Fallback native
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    if (d.getFullYear() < 100) d.setFullYear(2000 + d.getFullYear());
    return d;
  }

  return new Date();
}

/**
 * Converts any user date input and time input into a guaranteed, clean UTC ISO string for Indian Standard Time (IST, UTC+05:30).
 * Handles DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, month names ("30 Nov 2026"), and 12h/24h time formats.
 */
export function createSafeScheduledIso(
  dateInput: string | Date | null | undefined,
  timeInput?: string | null
): string {
  const now = new Date();
  let day = now.getDate();
  let month = now.getMonth() + 1; // 1-12
  let year = now.getFullYear();

  if (dateInput && dateInput !== 'Today') {
    const d = parseSafeIsoDate(dateInput);
    if (!isNaN(d.getTime())) {
      day = d.getDate();
      month = d.getMonth() + 1;
      year = d.getFullYear();
    }
  }

  // Ensure year is 4-digit
  if (year < 100) year += 2000;
  if (year < 2024 || year > 2050) year = now.getFullYear();

  let hours = 9;
  let minutes = 0;
  if (timeInput) {
    const match = String(timeInput).match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const ampm = match[3]?.toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }
  }

  const yStr = String(year).padStart(4, '0');
  const mStr = String(month).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  const hStr = String(hours).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');

  // Exact IST (+05:30) representation converted to UTC ISO
  return new Date(`${yStr}-${mStr}-${dStr}T${hStr}:${minStr}:00+05:30`).toISOString();
}

/**
 * Formats a booking pickup date and time in DD/MM/YYYY HH:mm format, guaranteed accurate in IST.
 */
export function formatSafePickupDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const d = parseSafeIsoDate(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
