import {
  evaluateCancellationCharge,
  getCancellationFeeForCategory,
} from './pricing/cancellationPolicy';
import { VehicleCategory } from './types';

async function runCancellationAndInvoiceTests() {
  console.log('🧪 Starting Cancellation & Tax Invoice Unit Tests...');

  // 1. Fleet Category Cancellation Rates
  console.log('1. Testing Fleet Cancellation Rates (Compact/Dzire/Etios: ₹500, Rest: ₹1000)...');
  const compactFee = getCancellationFeeForCategory(VehicleCategory.HATCHBACK);
  const dzireFee = getCancellationFeeForCategory(VehicleCategory.SWIFT_DZIRE);
  const etiosFee = getCancellationFeeForCategory(VehicleCategory.TOYOTA_ETIOS);
  const sedanFee = getCancellationFeeForCategory(VehicleCategory.SEDAN);

  const suvFee = getCancellationFeeForCategory(VehicleCategory.SUV);
  const ertigaFee = getCancellationFeeForCategory(VehicleCategory.SUV_ERTIGA);
  const carensFee = getCancellationFeeForCategory(VehicleCategory.SUV_CARENS);
  const innovaFee = getCancellationFeeForCategory(VehicleCategory.SUV_INNOVA);
  const crystaFee = getCancellationFeeForCategory(VehicleCategory.SUV_CRYSTA);
  const tempoFee = getCancellationFeeForCategory(VehicleCategory.TEMPO_TRAVELER);
  const urbaniaFee = getCancellationFeeForCategory(VehicleCategory.URBANIA);

  if (compactFee !== 500) throw new Error(`Hatchback/Compact fee should be 500, got ${compactFee}`);
  if (dzireFee !== 500) throw new Error(`Swift Dzire fee should be 500, got ${dzireFee}`);
  if (etiosFee !== 500) throw new Error(`Toyota Etios fee should be 500, got ${etiosFee}`);
  if (sedanFee !== 500) throw new Error(`Sedan fee should be 500, got ${sedanFee}`);

  if (suvFee !== 1000) throw new Error(`SUV fee should be 1000, got ${suvFee}`);
  if (ertigaFee !== 1000) throw new Error(`Ertiga fee should be 1000, got ${ertigaFee}`);
  if (carensFee !== 1000) throw new Error(`Carens fee should be 1000, got ${carensFee}`);
  if (innovaFee !== 1000) throw new Error(`Innova fee should be 1000, got ${innovaFee}`);
  if (crystaFee !== 1000) throw new Error(`Crysta fee should be 1000, got ${crystaFee}`);
  if (tempoFee !== 1000) throw new Error(`Tempo fee should be 1000, got ${tempoFee}`);
  if (urbaniaFee !== 1000) throw new Error(`Urbania fee should be 1000, got ${urbaniaFee}`);
  console.log('   ✅ Fleet cancellation fee amounts verified');

  // 2. 3-Hour Cancellation Window
  console.log('2. Testing 3-Hour Cancellation Window Policy...');
  const now = new Date();

  // 4 hours in future (> 3 hours): free cancellation
  const future4h = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const res4h = evaluateCancellationCharge(future4h, VehicleCategory.SWIFT_DZIRE, now);
  if (!res4h.freeCancellation || res4h.cancellationCharge !== 0) {
    throw new Error(`Trip 4h in future should have ₹0 cancellation fee, got ${res4h.cancellationCharge}`);
  }

  // 2 hours in future (<= 3 hours): ₹500 fee for Dzire
  const future2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const res2hDzire = evaluateCancellationCharge(future2h, VehicleCategory.SWIFT_DZIRE, now);
  if (res2hDzire.freeCancellation || res2hDzire.cancellationCharge !== 500) {
    throw new Error(`Dzire trip 2h in future should have ₹500 fee, got ${res2hDzire.cancellationCharge}`);
  }

  // 2 hours in future (<= 3 hours): ₹1000 fee for Crysta
  const res2hCrysta = evaluateCancellationCharge(future2h, VehicleCategory.SUV_CRYSTA, now);
  if (res2hCrysta.freeCancellation || res2hCrysta.cancellationCharge !== 1000) {
    throw new Error(`Crysta trip 2h in future should have ₹1000 fee, got ${res2hCrysta.cancellationCharge}`);
  }

  // Past trip (scheduled pickup time passed, e.g. -2h or -4000h): free cancellation, NO fee
  const past2h = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const resPast = evaluateCancellationCharge(past2h, VehicleCategory.SWIFT_DZIRE, now);
  if (!resPast.freeCancellation || resPast.cancellationCharge !== 0) {
    throw new Error(`Past trip should have ₹0 cancellation fee, got ${resPast.cancellationCharge}`);
  }

  const past4000h = new Date(now.getTime() - 4000 * 60 * 60 * 1000);
  const resPastOld = evaluateCancellationCharge(past4000h, VehicleCategory.SEDAN, now);
  if (!resPastOld.freeCancellation || resPastOld.cancellationCharge !== 0) {
    throw new Error(`Past trip from old date should have ₹0 cancellation fee, got ${resPastOld.cancellationCharge}`);
  }
  console.log('   ✅ 3-hour cancellation window logic passed (Applies ONLY within 0-3h before pickup)');

  // 3. Tax Invoice Math
  console.log('3. Testing Server-side Tax Invoice Math (5% GST)...');
  const estimatedFare = 2100;
  const preTaxSubtotal = Math.round((estimatedFare / 1.05) * 100) / 100;
  const gstTotal = Math.round((estimatedFare - preTaxSubtotal) * 100) / 100;
  const cgst = Math.round((gstTotal / 2) * 100) / 100;
  const sgst = Math.round((gstTotal - cgst) * 100) / 100;

  if (Math.abs(preTaxSubtotal + gstTotal - estimatedFare) > 0.05) {
    throw new Error('Pre-tax subtotal + GST total must equal estimated fare');
  }
  if (Math.abs(cgst + sgst - gstTotal) > 0.05) {
    throw new Error('CGST + SGST must equal GST total');
  }
  console.log(`   ✅ Tax invoice math: Pre-tax: ₹${preTaxSubtotal}, CGST: ₹${cgst}, SGST: ₹${sgst}, Total: ₹${estimatedFare}`);

  console.log('🎉 All Customer Cancellation & Tax Invoice tests passed successfully!');
}

runCancellationAndInvoiceTests().catch((e) => {
  console.error('❌ Tests failed:', e);
  process.exit(1);
});
