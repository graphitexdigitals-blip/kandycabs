/**
 * Helper utilities to extract and format Trip Date & Customer Requirements for Driver App
 */

export interface RequirementPill {
  icon: string;
  label: string;
  type?: 'default' | 'highlight' | 'warning' | 'info';
}

export function formatTripDateTime(dateStr?: string | null): {
  dateText: string;
  timeText: string;
  fullText: string;
  isToday: boolean;
  isTomorrow: boolean;
} {
  if (!dateStr) {
    return {
      dateText: 'Immediate Pickup',
      timeText: 'Now',
      fullText: 'Immediate Pickup',
      isToday: true,
      isTomorrow: false,
    };
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return {
      dateText: String(dateStr),
      timeText: '',
      fullText: String(dateStr),
      isToday: false,
      isTomorrow: false,
    };
  }
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tripStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const isToday = tripStart === todayStart;
  const isTomorrow = tripStart === todayStart + oneDayMs;

  const dateFormatted = d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let datePrefix = dateFormatted;
  if (isToday) datePrefix = `Today, ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  else if (isTomorrow) datePrefix = `Tomorrow, ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;

  return {
    dateText: datePrefix,
    timeText: timeFormatted,
    fullText: `${datePrefix} • ${timeFormatted}`,
    isToday,
    isTomorrow,
  };
}

export function parseCustomerRequirements(booking: any): RequirementPill[] {
  if (!booking) return [];
  const pills: RequirementPill[] = [];

  // 1. Passengers / Travellers
  const pax = booking.passengers || booking.passengerCount;
  if (pax && Number(pax) > 0) {
    pills.push({
      icon: 'people',
      label: `${pax} ${Number(pax) === 1 ? 'Traveller' : 'Travellers'}`,
      type: 'default',
    });
  }

  // 2. Luggage Load
  const lug = booking.luggage || booking.luggageDetails;
  if (lug) {
    if (typeof lug === 'string' && lug.trim().length > 0) {
      const cleanLug = lug.replace(/^Luggage:\s*/i, '').trim();
      pills.push({
        icon: 'briefcase',
        label: cleanLug,
        type: 'default',
      });
    } else if (typeof lug === 'object') {
      const parts: string[] = [];
      if (lug.small) parts.push(`${lug.small} Small`);
      if (lug.medium) parts.push(`${lug.medium} Med`);
      if (lug.large) parts.push(`${lug.large} Large`);
      if (parts.length > 0) {
        pills.push({
          icon: 'briefcase',
          label: parts.join(', '),
          type: 'default',
        });
      }
    }
  }

  // Search through specialRequirements, notes, and direct fields
  const texts: string[] = [];
  if (booking.specialRequirements) texts.push(String(booking.specialRequirements));
  if (booking.notes) texts.push(String(booking.notes));
  if (Array.isArray(booking.tripEvents)) {
    for (const evt of booking.tripEvents) {
      try {
        const p = typeof evt.payloadJson === 'string' ? JSON.parse(evt.payloadJson) : evt.payloadJson;
        if (p?.specialRequirements) texts.push(String(p.specialRequirements));
        if (p?.notes) texts.push(String(p.notes));
      } catch (_) {}
    }
  }
  const combinedText = texts.join(' | ').toLowerCase();

  // 3. Senior Citizens
  if (
    booking.hasSeniorCitizen ||
    booking.isSeniorCitizen ||
    combinedText.includes('senior citizen') ||
    combinedText.includes('elderly') ||
    combinedText.includes('age 60+')
  ) {
    pills.push({
      icon: 'body',
      label: 'Senior Citizen (60+)',
      type: 'highlight',
    });
  }

  // 4. Return Journey Later
  if (
    booking.needReturnJourney ||
    booking.returnJourney ||
    combinedText.includes('return journey') ||
    combinedText.includes('return trip') ||
    booking.tripType === 'ROUND' ||
    booking.tripType === 'ROUND_TRIP'
  ) {
    pills.push({
      icon: 'repeat',
      label: 'Return / Round Trip',
      type: 'info',
    });
  }

  // 5. Roof Luggage Carrier
  if (
    booking.requestCarrier ||
    booking.hasCarrier ||
    booking.roofCarrier ||
    combinedText.includes('carrier')
  ) {
    pills.push({
      icon: 'cube',
      label: 'Roof Carrier',
      type: 'default',
    });
  }

  // 6. Pet Friendly
  if (
    booking.hasPet ||
    booking.isPetFriendly ||
    booking.petFriendly ||
    combinedText.includes('pet friendly') ||
    combinedText.includes('pet')
  ) {
    const petType = booking.petType ? ` (${booking.petType})` : '';
    pills.push({
      icon: 'paw',
      label: `Pet Friendly${petType}`,
      type: 'warning',
    });
  }

  // 7. Child / Baby on board
  if (combinedText.includes('baby on board') || combinedText.includes('child safety')) {
    pills.push({
      icon: 'shield-checkmark',
      label: 'Baby on Board',
      type: 'info',
    });
  }

  // 8. Pregnancy Friendly
  if (combinedText.includes('pregnancy')) {
    pills.push({
      icon: 'heart',
      label: 'Pregnancy Friendly',
      type: 'highlight',
    });
  }

  // 9. Accessibility / Wheelchair
  if (combinedText.includes('accessibility') || combinedText.includes('handicapped') || combinedText.includes('wheelchair')) {
    pills.push({
      icon: 'accessibility',
      label: 'Special Assistance',
      type: 'highlight',
    });
  }

  // 10. Flight Number
  if (booking.flightNumber) {
    pills.push({
      icon: 'airplane',
      label: `Flight ${booking.flightNumber}`,
      type: 'info',
    });
  } else {
    const flightMatch = combinedText.match(/flight(?:\s*number)?:\s*([a-z0-9\-]+)/i);
    if (flightMatch && flightMatch[1]) {
      pills.push({
        icon: 'airplane',
        label: `Flight ${flightMatch[1].toUpperCase()}`,
        type: 'info',
      });
    }
  }

  return pills;
}

export function extractCustomerNotes(booking: any): string | null {
  if (!booking) return null;
  const notes = booking.notes || booking.specialRequirements;
  if (!notes || typeof notes !== 'string') return null;

  const lines = notes.split('|').map((s) => s.trim()).filter(Boolean);
  const userNotes: string[] = [];
  for (const l of lines) {
    if (
      l.startsWith('[FLEET') ||
      l.startsWith('[CORPORATE') ||
      l.startsWith('Payment') ||
      l.startsWith('Intermediate Stops:') ||
      l.startsWith('Via Stops') ||
      l.startsWith('Alt Contact:') ||
      l.startsWith('Alt Email:') ||
      l.startsWith('GSTIN:') ||
      l.startsWith('GST Details:') ||
      l.startsWith('Luggage:') ||
      l.startsWith('Roof Luggage Carrier') ||
      l.startsWith('Senior Citizen') ||
      l.startsWith('Return Journey') ||
      l.startsWith('Airport Drop') ||
      l.startsWith('Airport Pickup') ||
      l.startsWith('Pet Friendly') ||
      l.startsWith('Baby on Board') ||
      l.startsWith('Pregnancy Friendly') ||
      l.startsWith('Accessibility Assistance') ||
      l.startsWith('Flight:') ||
      l.startsWith('Flight Number:')
    ) {
      continue;
    }
    userNotes.push(l);
  }
  return userNotes.length > 0 ? userNotes.join(' • ') : null;
}

/**
 * Sort trips (dispatches, assigned bookings, queued trips) chronologically by scheduled date/time ascending.
 * Trips with the earliest pickup date and time will be placed first.
 */
export function sortTripsByDateTimeAscending<T>(trips: T[]): T[] {
  if (!Array.isArray(trips)) return [];
  return [...trips].sort((a: any, b: any) => {
    const bA = a?.booking || a;
    const bB = b?.booking || b;

    const getMs = (item: any) => {
      const val = item?.scheduledAt || item?.pickupDateTime;
      if (!val) {
        const created = item?.createdAt;
        if (!created) return Number.MAX_SAFE_INTEGER;
        const cMs = new Date(created).getTime();
        return isNaN(cMs) ? Number.MAX_SAFE_INTEGER : cMs;
      }
      const t = new Date(val).getTime();
      return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
    };

    const timeA = getMs(bA);
    const timeB = getMs(bB);

    if (timeA !== timeB) {
      return timeA - timeB; // Earliest first
    }

    const broadcastA = new Date(a?.broadcastAt || bA?.createdAt || 0).getTime() || 0;
    const broadcastB = new Date(b?.broadcastAt || bB?.createdAt || 0).getTime() || 0;
    return broadcastA - broadcastB;
  });
}


