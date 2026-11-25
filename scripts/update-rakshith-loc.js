const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.driver.update({
    where: { id: 'cmw9c3fso0006hr1dfr3qd5sa' },
    data: {
      currentLat: 12.8700,
      currentLng: 74.8500,
      onlineStatus: true,
      lastPingAt: new Date()
    },
    include: { user: true }
  });
  console.log('Driver updated successfully:');
  console.log(JSON.stringify({
    name: updated.user?.fullName,
    phone: updated.user?.phone,
    lat: updated.currentLat,
    lng: updated.currentLng,
    onlineStatus: updated.onlineStatus,
    lastPingAt: updated.lastPingAt
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
