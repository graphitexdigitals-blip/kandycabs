const { PrismaClient, UserRole, DriverVerificationStatus, VehicleCategory, FuelType } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const MOHAN_PHOTO = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80';
  const AADHAAR_DOC = 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80';
  const PAN_DOC = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80';
  const RC_DOC = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80';
  const LICENSE_DOC = 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80';
  const INSURANCE_DOC = 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80';

  const docDates = {
    license: { docNumber: 'KA-01-2023-0089745', validFrom: '15/03/2023', validTo: '14/03/2043' },
    aadhaar: { docNumber: '5412 8890 4892', validFrom: '2015', validTo: 'Permanent' },
    pan: { docNumber: 'ABCDE1234F', validFrom: '2018', validTo: 'Permanent' },
    rc: { docNumber: 'KA-01-SD-2045', validFrom: '10/01/2022', validTo: '09/01/2037' },
    insurance: { docNumber: 'POL-98765432-00', validFrom: '15/01/2026', validTo: '14/01/2029' },
    fitness: { docNumber: 'FC-KA01-2024-88', validFrom: '20/02/2024', validTo: '14/11/2028' },
    tax: { docNumber: 'TAX-KA-2024-410', validFrom: '01/04/2025', validTo: '09/12/2028' },
    permit: { docNumber: 'KA-CC-2023-7721', validFrom: '01/06/2023', validTo: '31/05/2028' },
    puc: { docNumber: 'PUC-KA-881920', validFrom: '01/09/2026', validTo: '28/02/2028' }
  };

  const extraDocs = {
    aadhaarDocUrl: AADHAAR_DOC,
    panDocUrl: PAN_DOC,
    fitnessDocUrl: INSURANCE_DOC,
    taxDocUrl: RC_DOC,
    permitDocUrl: INSURANCE_DOC,
    pucDocUrl: RC_DOC
  };

  const adminNotes = `[Car Model: Maruti Suzuki Dzire] [Luggage/Carriage: Yes] [ExtraDocs: ${JSON.stringify(extraDocs)}] [DocDates: ${JSON.stringify(docDates)}]`;

  // 1. Update or create driver for 9900447660
  const phone99 = '+919900447660';
  let user99 = await prisma.user.findUnique({ where: { phone: phone99 }, include: { driver: { include: { vehicles: true } } } });

  if (!user99) {
    user99 = await prisma.user.create({
      data: {
        phone: phone99,
        fullName: 'Mohan Kumar',
        roles: ['DRIVER'],
        driver: {
          create: {
            licenseNumber: 'KA-01-2023-0089745',
            profilePhotoUrl: MOHAN_PHOTO,
            licenseDocUrl: LICENSE_DOC,
            rcDocUrl: RC_DOC,
            insuranceDocUrl: INSURANCE_DOC,
            verificationStatus: 'APPROVED',
            adminNotes: adminNotes,
            payoutMethod: 'BANK',
            payoutStatus: 'VERIFIED',
            vehicles: {
              create: {
                category: 'SEDAN',
                fuelType: 'DIESEL',
                seatCount: 4,
                baseFarePerKm: 14.0,
                extraKmRate: 15.0,
                driverAllowance: 300.0,
                plateNumber: 'KA-01-SD-2045',
              }
            }
          }
        }
      },
      include: { driver: { include: { vehicles: true } } }
    });
    console.log('Created driver for 9900447660:', user99.fullName);
  } else {
    // Update existing user & driver
    await prisma.user.update({
      where: { id: user99.id },
      data: { fullName: 'Mohan Kumar' }
    });
    if (user99.driver) {
      await prisma.driver.update({
        where: { id: user99.driver.id },
        data: {
          licenseNumber: 'KA-01-2023-0089745',
          profilePhotoUrl: MOHAN_PHOTO,
          licenseDocUrl: LICENSE_DOC,
          rcDocUrl: RC_DOC,
          insuranceDocUrl: INSURANCE_DOC,
          verificationStatus: 'APPROVED',
          adminNotes: adminNotes,
          payoutStatus: 'VERIFIED',
        }
      });
      if (user99.driver.vehicles?.length) {
        await prisma.vehicle.update({
          where: { id: user99.driver.vehicles[0].id },
          data: {
            category: 'SEDAN',
            fuelType: 'DIESEL',
            plateNumber: 'KA-01-SD-2045',
          }
        });
      } else {
        await prisma.vehicle.create({
          data: {
            driverId: user99.driver.id,
            category: 'SEDAN',
            fuelType: 'DIESEL',
            seatCount: 4,
            baseFarePerKm: 14.0,
            extraKmRate: 15.0,
            driverAllowance: 300.0,
            plateNumber: 'KA-01-SD-2045',
          }
        });
      }
      console.log('Updated driver for 9900447660 to APPROVED with all valid docs.');
    }
  }

  // 2. Also update Mohan 9880933504 to ensure documents are not expired
  const phone98 = '+919880933504';
  const user98 = await prisma.user.findUnique({ where: { phone: phone98 }, include: { driver: { include: { vehicles: true } } } });
  if (user98?.driver) {
    await prisma.driver.update({
      where: { id: user98.driver.id },
      data: {
        adminNotes: adminNotes,
        verificationStatus: 'APPROVED',
        licenseDocUrl: LICENSE_DOC,
        rcDocUrl: RC_DOC,
        insuranceDocUrl: INSURANCE_DOC,
        profilePhotoUrl: MOHAN_PHOTO,
        payoutStatus: 'VERIFIED',
      }
    });
    console.log('Updated Mohan 9880933504 with fresh non-expiring documents.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

