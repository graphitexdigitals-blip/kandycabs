const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Ensuring isContactOnly column exists in FleetCategory table...');
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "FleetCategory" ADD COLUMN IF NOT EXISTS "isContactOnly" BOOLEAN DEFAULT false;');
    console.log('Column isContactOnly verified/added.');
  } catch (err) {
    console.log('Note on isContactOnly column:', err.message);
  }

  // Delete obsolete categories SEDAN and SUV_PREMIUM (and generic SUV) so we have exactly the 9 specific fleets
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "FleetCategory" WHERE category IN ('SEDAN', 'SUV', 'SUV_PREMIUM');`);
    console.log('Cleaned up legacy generic categories.');
  } catch (err) {
    console.log('Note on cleanup:', err.message);
  }

  const fleets = [
    {
      category: 'HATCHBACK',
      name: 'Compact',
      description: 'Toyota Glanza, WagonR, Tiago or equivalent',
      seatCount: 4,
      luggageCount: 2,
      cngEnabled: true,
      petrolEnabled: true,
      dieselEnabled: false,
      hasCarrier: true,
      carrierCapacityText: 'Roof Carrier Available (Up to 45 kg space)',
      carrierExcludedCars: 'Tata Tiago (No Roof Carrier - Boot space only)',
      carrierExcludedReason: null,
      isContactOnly: false,
      isActive: true,
    },
    {
      category: 'SWIFT_DZIRE',
      name: 'Sedan – Swift Dzire',
      description: 'Maruti Suzuki Dzire or equivalent',
      seatCount: 4,
      luggageCount: 3,
      cngEnabled: false,
      petrolEnabled: false,
      dieselEnabled: true,
      hasCarrier: false,
      carrierCapacityText: null,
      carrierExcludedCars: null,
      carrierExcludedReason: 'Sedan Class (Large Dedicated Boot Trunk - No Roof Carrier)',
      isContactOnly: false,
      isActive: true,
    },
    {
      category: 'TOYOTA_ETIOS',
      name: 'Sedan – Toyota Etios',
      description: 'Toyota Etios Diesel with Large Boot Space',
      seatCount: 4,
      luggageCount: 4,
      cngEnabled: false,
      petrolEnabled: false,
      dieselEnabled: true,
      hasCarrier: false,
      carrierCapacityText: null,
      carrierExcludedCars: null,
      carrierExcludedReason: 'Sedan Class (Large Dedicated Boot Trunk - No Roof Carrier)',
      isContactOnly: false,
      isActive: true,
    },
    {
      category: 'SUV_ERTIGA',
      name: 'SUVs Ertiga',
      description: 'Maruti Suzuki Ertiga or equivalent',
      seatCount: 6,
      luggageCount: 4,
      cngEnabled: true,
      petrolEnabled: true,
      dieselEnabled: true,
      hasCarrier: true,
      carrierCapacityText: 'Roof Carrier Available (Up to 50 kg space)',
      carrierExcludedCars: null,
      carrierExcludedReason: null,
      isContactOnly: false,
      isActive: true,
    },
    {
      category: 'SUV_CARENS',
      name: 'SUVs Kia Carens',
      description: 'Kia Carens Diesel Luxury 6+1',
      seatCount: 6,
      luggageCount: 4,
      cngEnabled: false,
      petrolEnabled: false,
      dieselEnabled: true,
      hasCarrier: true,
      carrierCapacityText: 'Roof Carrier Available (Up to 50 kg space)',
      carrierExcludedCars: null,
      carrierExcludedReason: null,
      isContactOnly: false,
      isActive: true,
    },
    {
      category: 'SUV_INNOVA',
      name: 'SUVs Toyota Innova',
      description: 'Toyota Innova Diesel 7+1 Touring',
      seatCount: 7,
      luggageCount: 5,
      cngEnabled: false,
      petrolEnabled: false,
      dieselEnabled: true,
      hasCarrier: true,
      carrierCapacityText: 'Roof Carrier Available (Up to 60 kg space)',
      carrierExcludedCars: null,
      carrierExcludedReason: null,
      isContactOnly: false,
      isActive: true,
    },
    {
      category: 'SUV_CRYSTA',
      name: 'SUVs Innova Crysta',
      description: 'Toyota Innova Crysta Diesel Luxury',
      seatCount: 7,
      luggageCount: 5,
      cngEnabled: false,
      petrolEnabled: false,
      dieselEnabled: true,
      hasCarrier: true,
      carrierCapacityText: 'Roof Carrier Available (Up to 60 kg space)',
      carrierExcludedCars: null,
      carrierExcludedReason: null,
      isContactOnly: false,
      isActive: true,
    },
    {
      category: 'TEMPO_TRAVELER',
      name: 'Tempo Traveller',
      description: '12-17 Seater Force Traveller AC Luxury',
      seatCount: 14,
      luggageCount: 10,
      cngEnabled: false,
      petrolEnabled: false,
      dieselEnabled: true,
      hasCarrier: true,
      carrierCapacityText: 'Heavy Roof Carrier Available (Up to 150 kg space)',
      carrierExcludedCars: null,
      carrierExcludedReason: null,
      isContactOnly: true,
      isActive: true,
    },
    {
      category: 'URBANIA',
      name: 'Force Urbania',
      description: '10/13/17 Seater Force Urbania AC Luxury Van',
      seatCount: 17,
      luggageCount: 10,
      cngEnabled: false,
      petrolEnabled: false,
      dieselEnabled: true,
      hasCarrier: true,
      carrierCapacityText: 'Spacious Boot & Roof Luggage Space',
      carrierExcludedCars: null,
      carrierExcludedReason: null,
      isContactOnly: true,
      isActive: true,
    },
  ];

  for (const f of fleets) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "FleetCategory" (
        id, category, name, description, "seatCount", "luggageCount",
        "cngEnabled", "petrolEnabled", "dieselEnabled", "hasCarrier",
        "carrierCapacityText", "carrierExcludedCars", "carrierExcludedReason",
        "isContactOnly", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), '${f.category}'::"VehicleCategory", '${f.name}', '${f.description}',
        ${f.seatCount}, ${f.luggageCount}, ${f.cngEnabled}, ${f.petrolEnabled}, ${f.dieselEnabled},
        ${f.hasCarrier}, ${f.carrierCapacityText ? `'${f.carrierCapacityText}'` : 'NULL'},
        ${f.carrierExcludedCars ? `'${f.carrierExcludedCars}'` : 'NULL'},
        ${f.carrierExcludedReason ? `'${f.carrierExcludedReason}'` : 'NULL'},
        ${f.isContactOnly}, ${f.isActive}, NOW(), NOW()
      )
      ON CONFLICT (category) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        "seatCount" = EXCLUDED."seatCount",
        "luggageCount" = EXCLUDED."luggageCount",
        "cngEnabled" = EXCLUDED."cngEnabled",
        "petrolEnabled" = EXCLUDED."petrolEnabled",
        "dieselEnabled" = EXCLUDED."dieselEnabled",
        "hasCarrier" = EXCLUDED."hasCarrier",
        "carrierCapacityText" = EXCLUDED."carrierCapacityText",
        "carrierExcludedCars" = EXCLUDED."carrierExcludedCars",
        "carrierExcludedReason" = EXCLUDED."carrierExcludedReason",
        "isContactOnly" = EXCLUDED."isContactOnly",
        "isActive" = EXCLUDED."isActive",
        "updatedAt" = NOW();
    `);
    console.log(`Synced Fleet: ${f.category} (${f.name}) - ContactOnly: ${f.isContactOnly}`);
  }

  const allInDb = await prisma.$queryRawUnsafe(`SELECT category, name, "isContactOnly", "cngEnabled", "petrolEnabled", "dieselEnabled", "hasCarrier" FROM "FleetCategory" ORDER BY "seatCount" ASC, name ASC;`);
  console.log(`\nTotal Fleets currently in DB (${allInDb.length}):\n`, allInDb);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
