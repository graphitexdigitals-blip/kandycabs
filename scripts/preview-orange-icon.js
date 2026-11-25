const sharp = require('sharp');
const fs = require('fs');

async function generatePreview() {
  const monogramPath = 'apps/customer-app/assets/images/customer_monogram_trimmed.png';
  const orangeBg = { r: 250, g: 79, b: 1, alpha: 1 }; // #FA4F01
  const size = 512;
  
  // In the reference image, the width ratio is ~0.72 - 0.75
  const targetW = Math.round(size * 0.72);
  const resized = await sharp(monogramPath)
    .resize({ width: targetW, fit: 'inside' })
    .toBuffer();
    
  const meta = await sharp(resized).metadata();
  const top = Math.round((size - meta.height) / 2);
  const left = Math.round((size - meta.width) / 2);
  
  const icon = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: orangeBg,
    }
  })
    .composite([{ input: resized, top, left }])
    .png()
    .toBuffer();
    
  const outPath = 'C:/Users/Rakshith/.gemini/antigravity/brain/54357793-1034-48f8-9da5-8eea2ab067b5/test_orange_driver_icon.png';
  fs.writeFileSync(outPath, icon);
  console.log('Saved preview to', outPath, 'targetW:', targetW, 'h:', meta.height);
}
generatePreview();
