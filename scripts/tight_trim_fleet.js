const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const cars = ['out_swift.png', 'out_etios.png', 'out_ertiga.png', 'out_innova.png', 'out_traveller.png', 'out_urbania.png'];

async function tightTrim() {
  console.log('Tightly trimming all fleet car images to maximize car presence...');
  for (const car of cars) {
    const filePath = path.join(rootDir, car);
    const trimmedBuffer = await sharp(filePath)
      .trim()
      .extend({
        top: 4,
        bottom: 4,
        left: 6,
        right: 6,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    fs.writeFileSync(filePath, trimmedBuffer);
    const meta = await sharp(filePath).metadata();
    console.log(`Trimmed ${car} -> ${meta.width}x${meta.height}`);
  }
}

tightTrim().catch(console.error);
