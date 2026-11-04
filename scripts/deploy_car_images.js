const sharp = require('sharp');
const fs = require('fs');

const basePath = 'C:/Users/Rakshith/.gemini/antigravity/brain/54357793-1034-48f8-9da5-8eea2ab067b5/.user_uploaded/';

async function deploy() {
  console.log('Deploying Glanza (Hatchback)...');
  const glanzaBuf = await sharp(basePath + 'media_1793339062822_9eebb636.png').png().toBuffer();
  fs.writeFileSync('apps/customer-app/assets/images/fleet-hatchback.png', glanzaBuf);
  fs.writeFileSync('apps/web/public/images/fleet-hatchback.png', glanzaBuf);
  await sharp(glanzaBuf).webp({ quality: 90 }).toFile('apps/web/public/images/fleet-hatchback.webp');
  if (fs.existsSync('apps/admin/public/images/fleet-hatchback.png')) {
    fs.writeFileSync('apps/admin/public/images/fleet-hatchback.png', glanzaBuf);
  }

  console.log('Deploying Swift Dzire with all 4 wheels (Sedan)...');
  const dzireBuf = fs.readFileSync('dzire_full_wheels.png');
  fs.writeFileSync('apps/customer-app/assets/images/fleet-sedan.png', dzireBuf);
  fs.writeFileSync('apps/web/public/images/fleet-sedan.png', dzireBuf);
  await sharp(dzireBuf).webp({ quality: 90 }).toFile('apps/web/public/images/fleet-sedan.webp');
  if (fs.existsSync('apps/admin/public/images/fleet-sedan.png')) {
    fs.writeFileSync('apps/admin/public/images/fleet-sedan.png', dzireBuf);
  }

  console.log('Deploying Toyota Etios with all 4 wheels (fleet-4-sedan)...');
  const etiosBuf = fs.readFileSync('etios_full_wheels.png');
  fs.writeFileSync('apps/customer-app/assets/images/fleet-4-sedan.png', etiosBuf);

  console.log('Deploying SUVs Ertiga with all 4 wheels (fleet-suv & fleet-4-ertiga)...');
  const ertigaBuf = fs.readFileSync('ertiga_full_wheels.png');
  fs.writeFileSync('apps/customer-app/assets/images/fleet-suv.png', ertigaBuf);
  fs.writeFileSync('apps/customer-app/assets/images/fleet-4-ertiga.png', ertigaBuf);
  fs.writeFileSync('apps/web/public/images/fleet-suv.png', ertigaBuf);
  await sharp(ertigaBuf).webp({ quality: 90 }).toFile('apps/web/public/images/fleet-suv.webp');
  if (fs.existsSync('apps/admin/public/images/fleet-suv.png')) {
    fs.writeFileSync('apps/admin/public/images/fleet-suv.png', ertigaBuf);
  }

  console.log('Successfully deployed all fleet car images with full front and back right wheels!');
}

deploy().catch(err => {
  console.error('Error during deployment:', err);
  process.exit(1);
});
