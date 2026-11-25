const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.kkerjotsahmkwbldjdhf:DynxUycOEHAqxnZo@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
    }
  }
});

async function main() {
  const users = await prisma.user.findMany({
    where: { phone: { contains: '9481086058' } },
    include: {
      customer: {
        include: {
          bookings: true
        }
      },
      driver: true
    }
  });
  console.log('Users found:', JSON.stringify(users, null, 2));

  const allBookings = await prisma.booking.findMany({
    where: {
      OR: [
        { customerPhone: { contains: '9481086058' } },
        { customerName: { contains: 'Rakshith', mode: 'insensitive' } }
      ]
    }
  });
  console.log('Bookings found for 9481086058 / Rakshith:', JSON.stringify(allBookings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
