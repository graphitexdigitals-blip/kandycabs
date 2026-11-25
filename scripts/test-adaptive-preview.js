const sharp = require('sharp');
const fs = require('fs');

async function testAdaptivePreview() {
  const whiteMonoPath = 'apps/driver-app/assets/images/kc_white_only.png';
  const orangeBg = { r: 250, g: 79, b: 1, alpha: 1 };
  const size = 1024;
  
  const fgScale = 0.35;
  const targetW = Math.round(size * fgScale);
  const resized = await sharp(whiteMonoPath).resize({ width: targetW, fit: 'inside' }).toBuffer();
  const meta = await sharp(resized).metadata();
  const top = Math.round((size - meta.height) / 2);
  const left = Math.round((size - meta.width) / 2);

  const adaptiveCanvas = await sharp({
    create: { width: size, height: size, channels: 4, background: orangeBg }
  }).composite([{ input: resized, top, left }]).png().toBuffer();

  const maskRadius = Math.round(size * 0.3333);
  const circleMask = await sharp(Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${maskRadius}" fill="#fff"/></svg>`
  )).png().toBuffer();

  const launcherPreview = await sharp(adaptiveCanvas)
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .trim()
    .png()
    .toBuffer();

  fs.writeFileSync('C:/Users/Rakshith/.gemini/antigravity/brain/54357793-1034-48f8-9da5-8eea2ab067b5/driver_launcher_masked_preview.png', launcherPreview);
  console.log('Saved launcher preview to driver_launcher_masked_preview.png, monogram W:', targetW, 'H:', meta.height);
}
testAdaptivePreview();
