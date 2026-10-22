/**
 * Helper utilities for parsing booking details, intermediate stops, carrier, and customer notes in the Admin Panel.
 */

export interface BookingDetailsMetadata {
  intermediateStops: string[];
  specialRequirements?: string;
  notes?: string;
  passengers?: number;
  luggage?: string;
  hasCarrier: boolean;
  hasPet: boolean;
  petFee: number;
  flightNumber?: string;
  alternateEmail?: string;
  companyName?: string;
  gstin?: string;
  source?: string;
}

/**
 * Extracts intermediate drops / via stops from booking object or its tripEvents payload.
 */
export function parseIntermediateStops(booking: any): string[] {
  if (!booking) return [];

  const stops: string[] = [];

  // 1. Check if viaStops is directly an array on booking
  if (Array.isArray(booking.viaStops) && booking.viaStops.length > 0) {
    return booking.viaStops
      .map((s: any) => (typeof s === 'string' ? s : s?.label || s?.address || s?.name || ''))
      .filter((s: string) => s.trim().length > 0);
  }

  // 2. Look in tripEvents for BOOKING_CREATED or any payloadJson with stops/requirements
  const rawTexts: string[] = [];

  if (Array.isArray(booking.tripEvents)) {
    for (const evt of booking.tripEvents) {
      const payload = typeof evt.payloadJson === 'string' ? safeJsonParse(evt.payloadJson) : evt.payloadJson;
      if (payload) {
        if (Array.isArray(payload.viaStops) && payload.viaStops.length > 0) {
          return payload.viaStops
            .map((s: any) => (typeof s === 'string' ? s : s?.label || s?.address || s?.name || ''))
            .filter((s: string) => s.trim().length > 0);
        }
        if (payload.specialRequirements) rawTexts.push(String(payload.specialRequirements));
        if (payload.notes) rawTexts.push(String(payload.notes));
      }
    }
  }

  if (booking.specialRequirements) rawTexts.push(String(booking.specialRequirements));
  if (booking.notes) rawTexts.push(String(booking.notes));

  for (const text of rawTexts) {
    if (!text) continue;

    // Pattern 1: "Intermediate Stops: Stop 1 ➔ Stop 2" or "Via Stops (2): Stop 1 ➔ Stop 2" or "Via: Stop 1 ➔ Stop 2"
    const matchArrow = text.match(/(?:Intermediate Stops|Via Stops(?:\s*\(\d+\))?|Via)\s*:\s*([^|;\n]+)/i);
    if (matchArrow && matchArrow[1]) {
      const rawSegment = matchArrow[1].trim();
      const parts = rawSegment.includes('➔')
        ? rawSegment.split('➔')
        : rawSegment.includes('->')
        ? rawSegment.split('->')
        : rawSegment.split(',');

      for (const p of parts) {
        const clean = p.trim();
        if (clean && !stops.includes(clean)) {
          stops.push(clean);
        }
      }
      if (stops.length > 0) return stops;
    }
  }

  return stops;
}

/**
 * Extracts all booking metadata (passengers, luggage, carrier, pet friendly, notes, requirements) from tripEvents
 */
export function getBookingMetadata(booking: any): BookingDetailsMetadata {
  const intermediateStops = parseIntermediateStops(booking);
  let specialRequirements = booking?.specialRequirements;
  let notes = booking?.notes;
  let passengers = booking?.passengers;
  let luggage = booking?.luggage;
  let source = booking?.source;
  let flightNumber = booking?.flightNumber ? String(booking.flightNumber).trim().toUpperCase() : undefined;
  let alternateEmail = booking?.alternateEmail ? String(booking.alternateEmail).trim() : undefined;
  let companyName = booking?.companyName ? String(booking.companyName).trim() : undefined;
  let gstin = booking?.gstin ? String(booking.gstin).trim().toUpperCase() : undefined;
  let hasCarrier = Boolean(
    booking?.requestCarrier ||
    booking?.hasCarrier ||
    booking?.roofCarrier
  );
  let hasPet = Boolean(
    booking?.hasPet ||
    booking?.petFriendly ||
    booking?.isPetFriendly
  );
  let petFee = booking?.petFee ? Number(booking.petFee) : 0;

  if (Array.isArray(booking?.tripEvents)) {
    for (const evt of booking.tripEvents) {
      const p = typeof evt.payloadJson === 'string' ? safeJsonParse(evt.payloadJson) : evt.payloadJson;
      if (p) {
        if (!hasCarrier && (p.requestCarrier === true || p.hasCarrier === true || p.roofCarrier === true)) {
          hasCarrier = true;
        }
        if (!hasPet && (p.hasPet === true || p.petFriendly === true || p.isPetFriendly === true)) {
          hasPet = true;
          if (p.petFee) petFee = Number(p.petFee);
        }
        if (!specialRequirements && p.specialRequirements) specialRequirements = p.specialRequirements;
        if (!notes && p.notes) notes = p.notes;
        if (!passengers && p.passengers) passengers = p.passengers;
        if (!luggage && p.luggage) luggage = p.luggage;
        if (!source && p.source) source = p.source;
        if (!flightNumber && p.flightNumber) flightNumber = String(p.flightNumber).trim().toUpperCase();
        if (!alternateEmail && p.alternateEmail) alternateEmail = String(p.alternateEmail).trim();
        if (!companyName && p.companyName) companyName = String(p.companyName).trim();
        if (!gstin && p.gstin) gstin = String(p.gstin).trim().toUpperCase();
      }
    }
  }

  // Also check if text notes/requirements mention Roof Carrier, Pet Friendly, Flight Number, GST, or Alt Email
  const combinedText = `${specialRequirements || ''} ${notes || ''} ${luggage || ''} ${booking?.specialRequirements || ''} ${booking?.notes || ''}`;
  if (!hasCarrier && /roof\s*carrier|luggage\s*carrier|carrier\s*requested|roof\s*luggage/i.test(combinedText)) {
    hasCarrier = true;
  }
  if (!hasPet && /pet\s*friendly|pet\s*on\s*board|travelling\s*with\s*pet|pet\s*charge/i.test(combinedText)) {
    hasPet = true;
    if (!petFee) petFee = 500;
  }
  if (hasPet && !petFee) {
    petFee = 500;
  }
  if (!flightNumber) {
    const flightMatch = combinedText.match(/flight(?:\s*number|\s*no)?\s*[:#-]?\s*([A-Z0-9\s-]+)/i);
    if (flightMatch && flightMatch[1]) {
      const extracted = flightMatch[1].trim().split(/\s*[,|;\n]/)[0].trim().toUpperCase();
      if (extracted && extracted.length >= 2 && extracted.length <= 15) {
        flightNumber = extracted;
      }
    }
  }
  if (!gstin) {
    const gstMatch = combinedText.match(/GST(?:IN)?\s*[:#-]?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i) ||
                     combinedText.match(/GST(?:IN)?\s*[:#-]?\s*([A-Z0-9]{15})/i);
    if (gstMatch && gstMatch[1]) {
      gstin = gstMatch[1].trim().toUpperCase();
    }
  }
  if (!companyName && gstin) {
    const compMatch = combinedText.match(/GSTIN:\s*[A-Z0-9]{15}\s*\(([^)]+)\)/i) ||
                      combinedText.match(/GST Details:\s*[A-Z0-9]{15}\s*-\s*([^|;\n]+)/i);
    if (compMatch && compMatch[1]) {
      companyName = compMatch[1].trim();
    }
  }
  if (!alternateEmail) {
    const emailMatch = combinedText.match(/Alt(?:\s*Contact)?\s*Email\s*[:#-]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (emailMatch && emailMatch[1]) {
      alternateEmail = emailMatch[1].trim();
    }
  }

  return {
    intermediateStops,
    specialRequirements,
    notes,
    passengers,
    luggage,
    hasCarrier,
    hasPet,
    petFee,
    flightNumber,
    alternateEmail,
    companyName,
    gstin,
    source,
  };
}

function safeJsonParse(val: string): any {
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}
