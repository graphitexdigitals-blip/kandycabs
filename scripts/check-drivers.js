const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const drivers = await prisma.driver.findMany({
    include: { user: true, vehicles: true }
  });
  console.log('Total drivers in DB:', drivers.length);
  drivers.forEach(d => {
    console.log(JSON.stringify({
      id: d.id,
      name: d.user?.fullName,
      phone: d.user?.phone,
      onlineStatus: d.onlineStatus,
      verificationStatus: d.verificationStatus,
      currentLat: d.currentLat,
      currentLng: d.currentLng,
      lastPingAt: d.lastPingAt
    }, null, 2));
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
