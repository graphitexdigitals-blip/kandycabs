const sharp = require('sharp');
const fs = require('fs');

async function testIcon() {
  const whiteMonoPath = 'apps/driver-app/assets/images/kc_white_only.png';
  const orangeBg = { r: 250, g: 79, b: 1, alpha: 1 };
  const size = 512;
  const targetW = Math.round(size * 0.76); // ~76% width matches user squircle
  
  const resized = await sharp(whiteMonoPath)
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
    
  const outPath = 'C:/Users/Rakshith/.gemini/antigravity/brain/54357793-1034-48f8-9da5-8eea2ab067b5/driver_orange_white_kc_preview.png';
  fs.writeFileSync(outPath, icon);
  console.log('Saved preview to', outPath, 'targetW:', targetW, 'h:', meta.height);
}
testIcon();
