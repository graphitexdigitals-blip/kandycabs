const sharp = require('sharp');
const fs = require('fs');

async function testSmallDriverIcon() {
  const whiteMonoPath = 'apps/driver-app/assets/images/kc_white_only.png';
  const orangeBg = { r: 250, g: 79, b: 1, alpha: 1 };
  const size = 512;
  // Previously targetW was Math.round(size * 0.76) = 389px, which was too big and clipped on circular masks.
  // Let's test scale 0.50 (256px) and 0.46 (235px)
  for (const scale of [0.46, 0.50, 0.54]) {
    const targetW = Math.round(size * scale);
    const resized = await sharp(whiteMonoPath)
      .resize({ width: targetW, fit: 'inside' })
      .toBuffer();
      
    const meta = await sharp(resized).metadata();
    const top = Math.round((size - meta.height) / 2);
    const left = Math.round((size - meta.width) / 2);
    
    // Circular mask preview to see how it looks in Android launcher
    const circleMask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#fff"/></svg>`
    );
    
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
      
    const maskedIcon = await sharp(icon)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toBuffer();
      
    const outPath = `C:/Users/Rakshith/.gemini/antigravity/brain/54357793-1034-48f8-9da5-8eea2ab067b5/driver_circle_scale_${scale}.png`;
    fs.writeFileSync(outPath, maskedIcon);
    console.log(`Saved scale ${scale}: targetW=${targetW}, h=${meta.height} to ${outPath}`);
  }
}
testSmallDriverIcon();
