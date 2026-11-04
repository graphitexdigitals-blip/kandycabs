const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const categories = [
    {
      category: "HATCHBACK",
      name: "Swift or equivalent",
      description: "Swift, WagonR, Tiago, Celerio",
      seatCount: 4,
      luggageCount: 2,
      cngEnabled: true,
      petrolEnabled: true,
      dieselEnabled: false,
      hasCarrier: true,
      carrierCapacityText: "Roof Carrier on Swift/WagonR (Up to 45 kg space)",
      carrierExcludedCars: "Tata Tiago (No Roof Carrier - Boot space only)",
      carrierExcludedReason: null,
      isActive: true,
    },
    {
      category: "SEDAN",
      name: "Dzire or equivalent",
      description: "Dzire, Etios, Aura, Amaze",
      seatCount: 4,
      luggageCount: 3,
      cngEnabled: true,
      petrolEnabled: true,
      dieselEnabled: true,
      hasCarrier: false,
      carrierCapacityText: null,
      carrierExcludedCars: null,
      carrierExcludedReason: "Sedan Class (Boot Trunk Space Only - No Roof Carrier)",
      isActive: true,
    },
    {
      category: "SUV",
      name: "Ertiga or equivalent",
      description: "Ertiga, Carens, XL6, Triber",
      seatCount: 6,
      luggageCount: 4,
      cngEnabled: true,
      petrolEnabled: true,
      dieselEnabled: true,
      hasCarrier: true,
      carrierCapacityText: "Roof Carrier Available (Up to 50 kg space)",
      carrierExcludedCars: null,
      carrierExcludedReason: null,
      isActive: true,
    },
    {
      category: "SUV_PREMIUM",
      name: "Innova Crysta or equivalent",
      description: "Innova Crysta, Hycross, Safari",
      seatCount: 7,
      luggageCount: 5,
      cngEnabled: false,
      petrolEnabled: true,
      dieselEnabled: true,
      hasCarrier: true,
      carrierCapacityText: "Roof Carrier Available (Up to 60 kg space)",
      carrierExcludedCars: null,
      carrierExcludedReason: null,
      isActive: true,
    },
    {
      category: "TEMPO_TRAVELER",
      name: "Tempo Traveller or equivalent",
      description: "12-17 Seater Force Traveller AC Luxury",
      seatCount: 14,
      luggageCount: 10,
      cngEnabled: false,
      petrolEnabled: false,
      dieselEnabled: true,
      hasCarrier: true,
      carrierCapacityText: "Heavy Roof Carrier Available (Up to 150 kg space)",
      carrierExcludedCars: null,
      carrierExcludedReason: null,
      isActive: true,
    }
  ];

  for (const c of categories) {
    await prisma.fleetCategory.upsert({
      where: { category: c.category },
      update: c,
      create: c,
    });
    console.log("Synchronized DB Fleet:", c.category, "->", c.name);
  }
  console.log("All fleet categories successfully synchronized!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
