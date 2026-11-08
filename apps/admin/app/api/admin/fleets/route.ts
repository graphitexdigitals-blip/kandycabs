import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { VehicleCategory, VEHICLE_RATES } from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let fleetCategories = await prisma.fleetCategory.findMany({
      orderBy: [{ seatCount: 'asc' }, { createdAt: 'asc' }],
    });

    // If database table is empty, seed defaults from VEHICLE_RATES with carrier metadata
    if (fleetCategories.length === 0) {
      const defaults = Object.values(VehicleCategory).map((cat) => {
        const conf = VEHICLE_RATES[cat];
        const isCarrierSuited =
          cat === VehicleCategory.HATCHBACK ||
          cat === VehicleCategory.SUV ||
          cat === VehicleCategory.SUV_PREMIUM ||
          cat === VehicleCategory.TEMPO_TRAVELER;

        return {
          category: cat,
          name: conf.name,
          description: conf.description,
          seatCount: conf.seats,
          luggageCount: conf.luggage,
          cngEnabled: cat === VehicleCategory.HATCHBACK || cat === VehicleCategory.SEDAN || cat === VehicleCategory.SUV,
          petrolEnabled: true,
          dieselEnabled: true,
          hasCarrier: isCarrierSuited,
          carrierCapacityText:
            cat === VehicleCategory.TEMPO_TRAVELER
              ? 'Heavy Roof Carrier Available (Up to 150 kg space)'
              : cat === VehicleCategory.SUV_PREMIUM || cat === VehicleCategory.SUV
              ? 'Roof Carrier Available (Up to 60 kg space)'
              : 'Roof Carrier Available on WagonR & Swift (Up to 45 kg space)',
          carrierExcludedCars:
            cat === VehicleCategory.HATCHBACK
              ? 'Tata Tiago (No Roof Carrier - Boot space only)'
              : cat === VehicleCategory.SEDAN
              ? 'Sedan Class (Boot Trunk Space Only - No Roof Carrier)'
              : null,
          carrierExcludedReason:
            cat === VehicleCategory.SEDAN
              ? 'Sedan trunks provide large boot space (No roof carrier needed)'
              : null,
          isActive: true,
        };
      });

      await prisma.fleetCategory.createMany({
        data: defaults,
        skipDuplicates: true,
      });

      fleetCategories = await prisma.fleetCategory.findMany({
        orderBy: { createdAt: 'asc' },
      });
    }

    const formatted = fleetCategories.map((f: any) => ({
      id: f.id,
      category: f.category,
      name: f.name,
      description: f.description,
      seatCount: f.seatCount,
      luggageCount: f.luggageCount,
      cngEnabled: f.cngEnabled ?? true,
      petrolEnabled: f.petrolEnabled ?? true,
      dieselEnabled: f.dieselEnabled ?? true,
      hasCarrier: Boolean(f.hasCarrier),
      carrierCapacityText: f.carrierCapacityText || 'Up to 50 kg / 2 extra bags',
      carrierExcludedCars: f.carrierExcludedCars || (f.category === 'HATCHBACK' ? 'Tata Tiago (No Carrier / Boot Space Only)' : ''),
      carrierExcludedReason: f.carrierExcludedReason || 'No Roof Carrier Allowed (Boot Space Only)',
      isContactOnly: Boolean(f.isContactOnly || f.category === 'TEMPO_TRAVELER' || f.category === 'URBANIA'),
      imageUrl: f.imageUrl,
      isActive: f.isActive,
    }));

    return NextResponse.json({ success: true, fleets: formatted });
  } catch (error: any) {
    console.error('Error fetching fleet categories:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch fleet categories' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      category,
      name,
      description,
      seatCount = 4,
      luggageCount = 2,
      cngEnabled = true,
      petrolEnabled = true,
      dieselEnabled = true,
      hasCarrier = false,
      carrierCapacityText,
      carrierExcludedCars,
      carrierExcludedReason,
      isContactOnly = false,
      imageUrl,
      isActive = true,
    } = body;

    const contactOnlyValue = Boolean(
      isContactOnly || category === 'TEMPO_TRAVELER' || category === 'URBANIA'
    );

    const fleet = await prisma.fleetCategory.upsert({
      where: { category },
      update: {
        name,
        description,
        seatCount: Number(seatCount),
        luggageCount: Number(luggageCount),
        cngEnabled: Boolean(cngEnabled),
        petrolEnabled: Boolean(petrolEnabled),
        dieselEnabled: Boolean(dieselEnabled),
        hasCarrier: Boolean(hasCarrier),
        carrierCapacityText: hasCarrier ? carrierCapacityText || 'Up to 50 kg / 2 extra bags' : null,
        carrierExcludedCars: carrierExcludedCars ? carrierExcludedCars.trim() : null,
        carrierExcludedReason: !hasCarrier ? carrierExcludedReason || 'No Roof Carrier Allowed (Boot Space Only)' : null,
        isContactOnly: contactOnlyValue,
        imageUrl,
        isActive: Boolean(isActive),
      },
      create: {
        category,
        name,
        description,
        seatCount: Number(seatCount),
        luggageCount: Number(luggageCount),
        cngEnabled: Boolean(cngEnabled),
        petrolEnabled: Boolean(petrolEnabled),
        dieselEnabled: Boolean(dieselEnabled),
        hasCarrier: Boolean(hasCarrier),
        carrierCapacityText: hasCarrier ? carrierCapacityText || 'Up to 50 kg / 2 extra bags' : null,
        carrierExcludedCars: carrierExcludedCars ? carrierExcludedCars.trim() : null,
        carrierExcludedReason: !hasCarrier ? carrierExcludedReason || 'No Roof Carrier Allowed (Boot Space Only)' : null,
        isContactOnly: contactOnlyValue,
        imageUrl,
        isActive: Boolean(isActive),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'FLEET_CATEGORY_UPDATED',
        entityType: 'FleetCategory',
        entityId: fleet.id,
        reason: `Admin updated fleet specs for ${category}: Seats=${seatCount}, BootLuggage=${luggageCount}, Carrier=${hasCarrier ? 'YES' : 'NO/EXCLUDED'}, ExcludedCars=${carrierExcludedCars || 'None'}, CNG=${cngEnabled}, Petrol=${petrolEnabled}, Diesel=${dieselEnabled}`,
      },
    });

    return NextResponse.json({ success: true, fleet });
  } catch (error: any) {
    console.error('Error saving fleet category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save fleet category' },
      { status: 500 }
    );
  }
}
