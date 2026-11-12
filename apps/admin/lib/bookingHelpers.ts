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
  petType?: string;
  petFee: number;
  flightNumber?: string;
  alternateEmail?: string;
  companyName?: string;
  gstin?: string;
  source?: string;
  // Customer Ride Preferences & Requirements
  isSeniorCitizen: boolean;
  needReturnJourney: boolean;
  needAirportDrop: boolean;
  needAirportPickup: boolean;
  isBabyOnBoard: boolean;
  isPregnancyFriendly: boolean;
  isAccessibilityAssistance: boolean;
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
  let petType = booking?.petType ? String(booking.petType).trim().toLowerCase() : undefined;
  let petFee = booking?.petFee ? Number(booking.petFee) : 0;
  let isSeniorCitizen = Boolean(booking?.isSeniorCitizen);
  let needReturnJourney = Boolean(booking?.needReturnJourney);
  let needAirportDrop = Boolean(booking?.needAirportDrop);
  let needAirportPickup = Boolean(booking?.needAirportPickup);
  let isBabyOnBoard = Boolean(booking?.isBabyOnBoard);
  let isPregnancyFriendly = Boolean(booking?.isPregnancyFriendly);
  let isAccessibilityAssistance = Boolean(booking?.isAccessibilityAssistance || booking?.isHandicapped);

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
        if (!petType && p.petType) petType = String(p.petType).trim().toLowerCase();
        if (!specialRequirements && p.specialRequirements) specialRequirements = p.specialRequirements;
        if (!notes && p.notes) notes = p.notes;
        if (!passengers && p.passengers) passengers = p.passengers;
        if (!luggage && p.luggage) luggage = p.luggage;
        if (!source && p.source) source = p.source;
        if (!flightNumber && p.flightNumber) flightNumber = String(p.flightNumber).trim().toUpperCase();
        if (!alternateEmail && p.alternateEmail) alternateEmail = String(p.alternateEmail).trim();
        if (!companyName && p.companyName) companyName = String(p.companyName).trim();
        if (!gstin && p.gstin) gstin = String(p.gstin).trim().toUpperCase();
        if (!isSeniorCitizen && p.isSeniorCitizen) isSeniorCitizen = true;
        if (!needReturnJourney && p.needReturnJourney) needReturnJourney = true;
        if (!needAirportDrop && p.needAirportDrop) needAirportDrop = true;
        if (!needAirportPickup && p.needAirportPickup) needAirportPickup = true;
        if (!isBabyOnBoard && p.isBabyOnBoard) isBabyOnBoard = true;
        if (!isPregnancyFriendly && p.isPregnancyFriendly) isPregnancyFriendly = true;
        if (!isAccessibilityAssistance && (p.isAccessibilityAssistance || p.isHandicapped)) isAccessibilityAssistance = true;
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

  if (hasPet && !petType) {
    if (/\b(?:cat|kitten)\b/i.test(combinedText)) {
      petType = 'cat';
    } else if (/\b(?:bird|parrot)\b/i.test(combinedText)) {
      petType = 'bird';
    } else if (/\b(?:dog|puppy)\b/i.test(combinedText)) {
      petType = 'dog';
    }
  }

  // Parse additional ride options / preferences from combined requirements & notes
  if (!isSeniorCitizen && /senior\s*citizen|elderly|age\s*60\+/i.test(combinedText)) {
    isSeniorCitizen = true;
  }
  if (!needReturnJourney && /return\s*journey/i.test(combinedText)) {
    needReturnJourney = true;
  }
  if (!needAirportDrop && /airport\s*drop/i.test(combinedText)) {
    needAirportDrop = true;
  }
  if (!needAirportPickup && /airport\s*pickup/i.test(combinedText)) {
    needAirportPickup = true;
  }
  if (!isBabyOnBoard && /baby\s*on\s*board|infant|child\s*safety/i.test(combinedText)) {
    isBabyOnBoard = true;
  }
  if (!isPregnancyFriendly && /pregnancy|pregnant/i.test(combinedText)) {
    isPregnancyFriendly = true;
  }
  if (!isAccessibilityAssistance && /accessibility|wheelchair|handicap/i.test(combinedText)) {
    isAccessibilityAssistance = true;
  }

  return {
    intermediateStops,
    specialRequirements,
    notes,
    passengers,
    luggage,
    hasCarrier,
    hasPet,
    petType,
    petFee,
    flightNumber,
    alternateEmail,
    companyName,
    gstin,
    source,
    isSeniorCitizen,
    needReturnJourney,
    needAirportDrop,
    needAirportPickup,
    isBabyOnBoard,
    isPregnancyFriendly,
    isAccessibilityAssistance,
  };
}

export interface TripVerificationPhotoItem {
  key: 'selfie' | 'front' | 'rear' | 'front_door' | 'back_door';
  label: string;
  sub: string;
  url: string | null;
  idx: number;
}

/**
 * Extracts and maps the 5 pre-trip verification photos captured by the driver:
 * 1. Driver Cabin Selfie (Driver Seat & Face)
 * 2. Front Angle (Front Bumper & Plate)
 * 3. Rear Angle (Rear Boot & Tail Lights)
 * 4. Front Door (Inside Front & Steering)
 * 5. Back Door (Inside Back Seats & Floor)
 *
 * Automatically filters out any legacy "Side Profile" angle and handles duplicate unshifted selfies.
 */
export function getTripVerificationPhotos(booking: any): {
  photos: TripVerificationPhotoItem[];
  uploadedCount: number;
  totalCount: number;
} {
  const defaultItems: TripVerificationPhotoItem[] = [
    { key: 'selfie', label: 'Driver Cabin Selfie', sub: 'Driver Seat & Face', url: null, idx: 0 },
    { key: 'front', label: 'Front Angle', sub: 'Front Bumper & Plate', url: null, idx: 1 },
    { key: 'rear', label: 'Rear Angle', sub: 'Rear Boot & Tail Lights', url: null, idx: 2 },
    { key: 'front_door', label: 'Front Door', sub: 'Inside Front & Steering', url: null, idx: 3 },
    { key: 'back_door', label: 'Back Door', sub: 'Inside Back Seats', url: null, idx: 4 },
  ];

  if (!booking) {
    return { photos: defaultItems, uploadedCount: 0, totalCount: 5 };
  }

  const rawList: string[] = Array.isArray(booking.vehicleInspectionPhotos)
    ? booking.vehicleInspectionPhotos.filter((p: any) => typeof p === 'string' && p.trim().length > 0)
    : [];

  // 1. Identify driver selfie (if passed directly or in tripEvents/metadata)
  let selfieUrl: string | null = null;
  if (booking.driverSelfie && typeof booking.driverSelfie === 'string' && booking.driverSelfie.trim()) {
    selfieUrl = booking.driverSelfie;
  }

  // Check if rawList has an explicit selfie URL or if rawList[0] is selfie
  let remainingPhotos = [...rawList];

  // If selfie is not set yet, check if any item has 'selfie' or 'driver'
  if (!selfieUrl) {
    const selfieIdx = remainingPhotos.findIndex(
      (p) => p.toLowerCase().includes('selfie') || p.toLowerCase().includes('driver')
    );
    if (selfieIdx !== -1) {
      selfieUrl = remainingPhotos[selfieIdx];
      remainingPhotos.splice(selfieIdx, 1);
    } else if (remainingPhotos.length === 5) {
      // In the new 5-photo flow: [0: Selfie, 1: Front, 2: Rear, 3: Front Door, 4: Back Door]
      selfieUrl = remainingPhotos[0];
      remainingPhotos = remainingPhotos.slice(1);
    }
  } else {
    // Remove selfie from remaining if present
    remainingPhotos = remainingPhotos.filter((p) => p !== selfieUrl && !p.toLowerCase().includes('driver_selfie'));
  }

  // 2. Filter out legacy "Side Profile" if present
  // If remaining has 5 items (front, rear, side, inside_front, inside_back)
  if (remainingPhotos.length >= 5) {
    const sideIdx = remainingPhotos.findIndex((p) => p.toLowerCase().includes('side'));
    if (sideIdx !== -1) {
      remainingPhotos.splice(sideIdx, 1);
    } else {
      // Legacy index 2 was side
      remainingPhotos = [
        remainingPhotos[0],
        remainingPhotos[1],
        remainingPhotos[3],
        remainingPhotos[4],
      ].filter(Boolean);
    }
  }

  // If remaining has 4 items or less, they map to: Front, Rear, Front Door, Back Door
  const frontUrl = remainingPhotos[0] || null;
  const rearUrl = remainingPhotos[1] || null;
  const frontDoorUrl = remainingPhotos[2] || null;
  const backDoorUrl = remainingPhotos[3] || null;

  const items: TripVerificationPhotoItem[] = [
    { key: 'selfie', label: 'Driver Cabin Selfie', sub: 'Driver Seat & Face', url: selfieUrl, idx: 0 },
    { key: 'front', label: 'Front Angle', sub: 'Front Bumper & Plate', url: frontUrl, idx: 1 },
    { key: 'rear', label: 'Rear Angle', sub: 'Rear Boot & Tail Lights', url: rearUrl, idx: 2 },
    { key: 'front_door', label: 'Front Door', sub: 'Inside Front & Steering', url: frontDoorUrl, idx: 3 },
    { key: 'back_door', label: 'Back Door', sub: 'Inside Back Seats', url: backDoorUrl, idx: 4 },
  ];

  const uploadedCount = items.filter((i) => Boolean(i.url)).length;

  return {
    photos: items,
    uploadedCount,
    totalCount: 5,
  };
}

export interface TripTimingMilestoneItem {
  id: 'photos_verified' | 'arrived_at_pickup' | 'customer_waiting' | 'trip_started' | 'trip_completed';
  label: string;
  sub: string;
  icon: string;
  timeStr: string | null;
  dateStr: string | null;
  rawIso: string | null;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  extraInfo?: string;
  badgeColor: string;
}

export interface TripTimingsSummary {
  milestones: TripTimingMilestoneItem[];
  photosTime: string | null;
  arrivedPickupTime: string | null;
  waitingMinutes: number;
  waitingTimeWindow: string | null;
  startedTime: string | null;
  completedTime: string | null;
  totalTripDuration: string | null;
  drivingDuration: string | null;
}

export function formatTimeAmPm(isoOrDate: string | Date | null | undefined): string | null {
  if (!isoOrDate) return null;
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return null;
  }
}

export function formatDateShort(isoOrDate: string | Date | null | undefined): string | null {
  if (!isoOrDate) return null;
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
}

/**
 * Extracts all chronological trip timings and milestones:
 * 1. Photos Attached / Verified Time
 * 2. Arrived at Pickup Time
 * 3. Customer Waiting Time (in minutes + time window)
 * 4. Odometer Image & Trip Start Time
 * 5. Reached Destination & Drop Time
 */
export function getTripTimingMilestones(booking: any): TripTimingsSummary {
  if (!booking) {
    return {
      milestones: [],
      photosTime: null,
      arrivedPickupTime: null,
      waitingMinutes: 0,
      waitingTimeWindow: null,
      startedTime: null,
      completedTime: null,
      totalTripDuration: null,
      drivingDuration: null,
    };
  }

  const events: any[] = Array.isArray(booking.tripEvents) ? booking.tripEvents : [];
  const getEvent = (type: string) => events.find((e) => e.type === type);
  const getPayload = (e: any) =>
    (typeof e?.payloadJson === 'string' ? safeJsonParse(e.payloadJson) : e?.payloadJson) || {};

  // 1. Photos Attached / Verified
  const inspectionEvt = getEvent('INSPECTION_SUBMITTED') || getEvent('DRIVER_INSPECTION_UPLOADED');
  const inspectionPayload = getPayload(inspectionEvt);
  const hasPhotos =
    Array.isArray(booking.vehicleInspectionPhotos) && booking.vehicleInspectionPhotos.filter(Boolean).length > 0;
  const rawPhotosIso =
    inspectionEvt?.createdAt ||
    inspectionPayload?.timestamp ||
    (hasPhotos ? booking.actualStartedAt || booking.createdAt : null);
  const photosCount = hasPhotos
    ? booking.vehicleInspectionPhotos.filter(Boolean).length
    : inspectionPayload?.photosCount || 0;

  // 2. Arrived at Pickup
  const arrivedEvt =
    getEvent('DRIVER_ARRIVED_AT_PICKUP') ||
    getEvent('DRIVER_ARRIVED') ||
    events.find(
      (e) =>
        (e.type === 'DRIVER_EN_ROUTE' || e.type === 'DRIVER_ARRIVED') &&
        getPayload(e)?.action === 'ARRIVED_AT_PICKUP'
    );
  const arrivedPayload = getPayload(arrivedEvt);
  let rawArrivedIso =
    arrivedEvt?.createdAt || arrivedPayload?.arrivedAt || arrivedPayload?.timestamp || null;

  // 3. Starting Odometer / Trip Started
  const startEvt = getEvent('TRIP_STARTED');
  const startPayload = getPayload(startEvt);
  const rawStartedIso = booking.actualStartedAt || startEvt?.createdAt || startPayload?.timestamp || null;

  // Fallback arrival timestamp if booking progressed to started
  if (!rawArrivedIso && (booking.status === 'DRIVER_EN_ROUTE' || booking.status === 'TRIP_STARTED' || booking.status === 'TRIP_COMPLETED')) {
    const enRouteEvt = getEvent('DRIVER_EN_ROUTE');
    if (enRouteEvt?.createdAt) {
      rawArrivedIso = enRouteEvt.createdAt;
    }
  }

  // 4. Waiting Time Calculation
  const waitEvt = getEvent('WAITING_RECORDED');
  const waitPayload = getPayload(waitEvt);
  const completeEvt = getEvent('TRIP_COMPLETED');
  const completePayload = getPayload(completeEvt);

  let recordedWaitMins = 0;
  if (typeof waitPayload?.waitingMinutes === 'number' && waitPayload.waitingMinutes > 0) {
    recordedWaitMins = waitPayload.waitingMinutes;
  } else if (typeof completePayload?.waitingMinutes === 'number' && completePayload.waitingMinutes > 0) {
    recordedWaitMins = completePayload.waitingMinutes;
  } else if (typeof waitPayload?.durationSeconds === 'number' && waitPayload.durationSeconds > 0) {
    recordedWaitMins = Math.round(waitPayload.durationSeconds / 60);
  } else if (rawArrivedIso && rawStartedIso) {
    const arrMs = new Date(rawArrivedIso).getTime();
    const strMs = new Date(rawStartedIso).getTime();
    if (!isNaN(arrMs) && !isNaN(strMs) && strMs > arrMs) {
      const diffMins = Math.round((strMs - arrMs) / 60000);
      if (diffMins >= 1 && diffMins <= 180) {
        recordedWaitMins = diffMins;
      }
    }
  }

  let waitTimeWindow: string | null = null;
  if (waitPayload?.startedAt && waitPayload?.stoppedAt) {
    waitTimeWindow = `${waitPayload.startedAt} – ${waitPayload.stoppedAt}`;
  } else if (rawArrivedIso && rawStartedIso && recordedWaitMins > 0) {
    const aTime = formatTimeAmPm(rawArrivedIso);
    const sTime = formatTimeAmPm(rawStartedIso);
    if (aTime && sTime) {
      waitTimeWindow = `${aTime} – ${sTime}`;
    }
  }

  // 5. Trip Completed / Drop
  const rawCompletedIso = booking.actualCompletedAt || completeEvt?.createdAt || completePayload?.timestamp || null;

  // Elapsed Calculations
  let drivingDuration: string | null = null;
  let totalTripDuration: string | null = null;

  if (rawStartedIso && rawCompletedIso) {
    const sMs = new Date(rawStartedIso).getTime();
    const cMs = new Date(rawCompletedIso).getTime();
    if (!isNaN(sMs) && !isNaN(cMs) && cMs > sMs) {
      const driveTotalMins = Math.round((cMs - sMs) / 60000);
      const hrs = Math.floor(driveTotalMins / 60);
      const mins = driveTotalMins % 60;
      drivingDuration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
    }
  }

  if (rawArrivedIso && rawCompletedIso) {
    const aMs = new Date(rawArrivedIso).getTime();
    const cMs = new Date(rawCompletedIso).getTime();
    if (!isNaN(aMs) && !isNaN(cMs) && cMs > aMs) {
      const tripTotalMins = Math.round((cMs - aMs) / 60000);
      const hrs = Math.floor(tripTotalMins / 60);
      const mins = tripTotalMins % 60;
      totalTripDuration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
    }
  }

  const milestones: TripTimingMilestoneItem[] = [
    {
      id: 'photos_verified',
      label: 'Vehicle Photos Verified',
      sub: `${photosCount || 5} Photos Verified & Attached`,
      icon: '',
      timeStr: formatTimeAmPm(rawPhotosIso),
      dateStr: formatDateShort(rawPhotosIso),
      rawIso: rawPhotosIso,
      status: rawPhotosIso || hasPhotos ? 'COMPLETED' : 'PENDING',
      extraInfo: photosCount > 0 ? `${photosCount} of 5 Photos` : 'Pending Upload',
      badgeColor: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
    {
      id: 'arrived_at_pickup',
      label: 'Arrived at Pickup',
      sub: booking.pickupAddress ? String(booking.pickupAddress).split(',')[0] : 'Customer Pickup Location',
      icon: '',
      timeStr: formatTimeAmPm(rawArrivedIso),
      dateStr: formatDateShort(rawArrivedIso),
      rawIso: rawArrivedIso,
      status: rawArrivedIso ? 'COMPLETED' : booking.status === 'DRIVER_EN_ROUTE' ? 'IN_PROGRESS' : 'PENDING',
      extraInfo: rawArrivedIso ? 'Driver on spot' : 'En Route to pickup',
      badgeColor: 'border-blue-200 bg-blue-50 text-blue-800',
    },
    {
      id: 'customer_waiting',
      label: 'Customer Waiting Time',
      sub: waitTimeWindow ? `Window: ${waitTimeWindow}` : 'Boarding & Pickup Window',
      icon: '',
      timeStr:
        recordedWaitMins > 0
          ? `${recordedWaitMins} Mins`
          : rawArrivedIso && !rawStartedIso
          ? 'Waiting...'
          : '0 Mins',
      dateStr: formatDateShort(rawArrivedIso || rawStartedIso),
      rawIso: rawArrivedIso,
      status: recordedWaitMins > 0 ? 'COMPLETED' : rawArrivedIso && !rawStartedIso ? 'IN_PROGRESS' : 'PENDING',
      extraInfo:
        recordedWaitMins > 0
          ? `${recordedWaitMins} mins waited`
          : rawArrivedIso && !rawStartedIso
          ? 'Driver waiting for customer'
          : 'No wait time recorded',
      badgeColor:
        recordedWaitMins > 0
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-slate-200 bg-slate-50 text-slate-600',
    },
    {
      id: 'trip_started',
      label: 'Odometer Image & Trip Start',
      sub: booking.startingOdometer ? `Start Odometer: ${booking.startingOdometer} KM` : 'OTP & Start Odometer',
      icon: '',
      timeStr: formatTimeAmPm(rawStartedIso),
      dateStr: formatDateShort(rawStartedIso),
      rawIso: rawStartedIso,
      status: rawStartedIso ? 'COMPLETED' : booking.status === 'TRIP_STARTED' ? 'IN_PROGRESS' : 'PENDING',
      extraInfo: booking.startingOdometer ? `${booking.startingOdometer} KM` : 'Pending OTP',
      badgeColor: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    },
    {
      id: 'trip_completed',
      label: 'Reached Destination & Drop',
      sub: booking.actualDropAddress
        ? String(booking.actualDropAddress).split(',')[0]
        : String(booking.dropAddress || '').split(',')[0],
      icon: '',
      timeStr: formatTimeAmPm(rawCompletedIso),
      dateStr: formatDateShort(rawCompletedIso),
      rawIso: rawCompletedIso,
      status:
        rawCompletedIso || booking.status === 'TRIP_COMPLETED'
          ? 'COMPLETED'
          : rawStartedIso
          ? 'IN_PROGRESS'
          : 'PENDING',
      extraInfo: booking.finalOdometer
        ? `${booking.finalOdometer} KM (${booking.actualDistanceKm || '0'} KM)`
        : 'In Transit',
      badgeColor: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    },
  ];

  return {
    milestones,
    photosTime: formatTimeAmPm(rawPhotosIso),
    arrivedPickupTime: formatTimeAmPm(rawArrivedIso),
    waitingMinutes: recordedWaitMins,
    waitingTimeWindow: waitTimeWindow,
    startedTime: formatTimeAmPm(rawStartedIso),
    completedTime: formatTimeAmPm(rawCompletedIso),
    totalTripDuration,
    drivingDuration,
  };
}

function safeJsonParse(val: string): any {
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}
