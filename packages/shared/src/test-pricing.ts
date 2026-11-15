import {
  calculateFare,
  isNightTimeWindow,
  VehicleCategory,
  FuelType,
  TripType,
  VEHICLE_RATES,
} from './index';

async function runPricingTests() {
  console.log('🧪 Starting Pricing Engine Unit Tests...');

  // 1. Test Night Window Logic
  console.log('1. Testing Night Window Logic...');
  const dayTime = new Date('2026-09-17T14:30:00'); // 2:30 PM
  const nightTime1 = new Date('2026-09-17T23:15:00'); // 11:15 PM
  const nightTime2 = new Date('2026-09-17T04:45:00'); // 4:45 AM

  if (isNightTimeWindow(dayTime)) throw new Error('14:30 should not be night time');
  if (!isNightTimeWindow(nightTime1)) throw new Error('23:15 should be night time');
  if (!isNightTimeWindow(nightTime2)) throw new Error('04:45 should be night time');
  console.log('   ✅ Night window tests passed');

  // 2. Test Daytime Oneway Sedan Fare (with Chauffeur Allowance included)
  console.log('2. Testing Daytime Oneway Sedan (100 km)...');
  const onewayQuote = calculateFare({
    category: VehicleCategory.SEDAN,
    fuelType: FuelType.DIESEL,
    tripType: TripType.ONEWAY,
    distanceKm: 100,
    scheduledAt: dayTime,
  });

  // Sedan diesel = 15/km -> baseFare = 1500, driverAllowance = 350 (Chauffeur Allowance included)
  // subtotal = 1850
  // GST 5% = 92.5
  // totalFare = 1942.5
  if (onewayQuote.baseFare !== 1500) throw new Error(`Base fare mismatch: expected 1500, got ${onewayQuote.baseFare}`);
  if (onewayQuote.driverAllowance !== 350) throw new Error(`Driver allowance mismatch: expected 350, got ${onewayQuote.driverAllowance}`);
  if (onewayQuote.gstAmount !== 92.5) throw new Error(`GST mismatch: expected 92.5, got ${onewayQuote.gstAmount}`);
  if (onewayQuote.totalFare !== 1942.5) throw new Error(`Total fare mismatch: expected 1942.5, got ${onewayQuote.totalFare}`);
  if (onewayQuote.advanceAmount + onewayQuote.balanceAmount !== onewayQuote.totalFare) {
    throw new Error('Advance + Balance must equal Total Fare');
  }
  console.log(`   ✅ Daytime oneway sedan: total ₹${onewayQuote.totalFare} (Adv: ₹${onewayQuote.advanceAmount}, Bal: ₹${onewayQuote.balanceAmount}, Driver Bata: ₹${onewayQuote.driverAllowance})`);

  // 3. Test Airport Transfer: strictly No Chauffeur Allowance
  console.log('3. Testing Airport Transfer (50 km)...');
  const airportQuote = calculateFare({
    category: VehicleCategory.SEDAN,
    fuelType: FuelType.DIESEL,
    tripType: TripType.AIRPORT,
    distanceKm: 50,
    scheduledAt: dayTime,
  });
  if (airportQuote.driverAllowance !== 0) throw new Error(`Airport driver allowance should be 0, got ${airportQuote.driverAllowance}`);
  console.log(`   ✅ Airport transfer: driver allowance ₹${airportQuote.driverAllowance} (No allowance rule verified)`);

  // 4. Test Local Rental Package: No day allowance
  console.log('4. Testing Local Rental Package (8hr/80km)...');
  const localQuote = calculateFare({
    category: VehicleCategory.SEDAN,
    fuelType: FuelType.DIESEL,
    tripType: TripType.LOCAL,
    distanceKm: 80,
    packageHours: 8,
    scheduledAt: dayTime,
  });
  if (localQuote.driverAllowance !== 0) throw new Error(`Local rental driver allowance should be 0, got ${localQuote.driverAllowance}`);
  console.log(`   ✅ Local rental package: driver allowance ₹${localQuote.driverAllowance} (No day allowance rule verified)`);

  // 4. Test Round-trip min 250km/day allowance
  console.log('4. Testing Round-trip 2-day SUV trip (Actual single distance: 100 km)...');
  const roundTripQuote = calculateFare({
    category: VehicleCategory.SUV,
    fuelType: FuelType.DIESEL,
    tripType: TripType.ROUND,
    distanceKm: 100, // 200 km total < 2 days * 250 = 500 km min
    durationDays: 2,
    scheduledAt: dayTime,
  });
  // Billable km must be 500 km (250*2)
  // SUV diesel = 18/km -> baseFare = 500 * 18 = 9000
  // Driver allowance = 2 * 400 = 800
  // subtotal = 9800
  // GST = 490
  // totalFare = 10290
  if (roundTripQuote.billableDistanceKm !== 500) {
    throw new Error(`Billable km mismatch: expected 500, got ${roundTripQuote.billableDistanceKm}`);
  }
  if (roundTripQuote.driverAllowance !== 800) {
    throw new Error(`Driver allowance mismatch: expected 800, got ${roundTripQuote.driverAllowance}`);
  }
  if (roundTripQuote.totalFare !== 10290) {
    throw new Error(`Total fare mismatch: expected 10290, got ${roundTripQuote.totalFare}`);
  }
  console.log(`   ✅ Round trip 2-day SUV: 500 km billable, ₹${roundTripQuote.driverAllowance} driver allowance, total ₹${roundTripQuote.totalFare}`);

  // 5. Test Coupon Discount
  console.log('5. Testing Coupon Code (KANDY10)...');
  const couponQuote = calculateFare({
    category: VehicleCategory.SEDAN,
    fuelType: FuelType.DIESEL,
    tripType: TripType.ONEWAY,
    distanceKm: 100,
    scheduledAt: dayTime,
    couponCode: 'KANDY10',
  });
  // Subtotal before coupon = 1850, discount 10% = 185 -> subtotal = 1665
  // GST = 83.25, total = 1748.25
  if (couponQuote.discount !== 185) throw new Error(`Discount mismatch: expected 185, got ${couponQuote.discount}`);
  if (couponQuote.totalFare !== 1748.25) throw new Error(`Total fare mismatch: expected 1748.25, got ${couponQuote.totalFare}`);
  console.log(`   ✅ Coupon discount applied: -₹${couponQuote.discount}, final total: ₹${couponQuote.totalFare}`);

  console.log('🎉 All Pricing Engine tests passed successfully!');
}

runPricingTests().catch((e) => {
  console.error('❌ Pricing tests failed:', e);
  process.exit(1);
});
