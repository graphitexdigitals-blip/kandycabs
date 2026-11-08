const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Ensuring isContactOnly column exists in FleetCategory table...');
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "FleetCategory" ADD COLUMN IF NOT EXISTS "isContactOnly" BOOLEAN DEFAULT false;');
  } catch (err) {
    console.log('Note on isContactOnly column:', err.message);
  }

  // Delete legacy generic categories
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "FleetCategory" WHERE category IN ('SEDAN', 'SUV', 'SUV_PREMIUM');`);
  } catch (err) {
    console.log('Note on cleanup:', err.message);
  }

  const categories = [
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

  for (const c of categories) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "FleetCategory" (
        id, category, name, description, "seatCount", "luggageCount",
        "cngEnabled", "petrolEnabled", "dieselEnabled", "hasCarrier",
        "carrierCapacityText", "carrierExcludedCars", "carrierExcludedReason",
        "isContactOnly", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), '${c.category}'::"VehicleCategory", '${c.name}', '${c.description}',
        ${c.seatCount}, ${c.luggageCount}, ${c.cngEnabled}, ${c.petrolEnabled}, ${c.dieselEnabled},
        ${c.hasCarrier}, ${c.carrierCapacityText ? `'${c.carrierCapacityText}'` : 'NULL'},
        ${c.carrierExcludedCars ? `'${c.carrierExcludedCars}'` : 'NULL'},
        ${c.carrierExcludedReason ? `'${c.carrierExcludedReason}'` : 'NULL'},
        ${c.isContactOnly}, ${c.isActive}, NOW(), NOW()
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
    console.log("Synchronized DB Fleet:", c.category, "->", c.name, `[ContactOnly: ${c.isContactOnly}]`);
  }
  console.log("All 9 fleet categories successfully synchronized!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
