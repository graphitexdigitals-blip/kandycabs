const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function createMasterIcon() {
  const root = path.join(__dirname, '..');
  const cutoutPath = path.join(root, 'apps', 'driver-app', 'assets', 'images', 'kc_navy_reference_cutout.png');
  const driverAssets = path.join(root, 'apps', 'driver-app', 'assets');
  const customerAssets = path.join(root, 'apps', 'customer-app', 'assets');

  const cutout = sharp(cutoutPath);
  const meta = await cutout.metadata();

  const capHeight = 26;
  const newHeight = meta.height + capHeight;
  const newWidth = meta.width;

  // The taxi light in reference is from x=138 to 232 (w=94).
  // Left pillar at x=74, w=24. Right pillar at x=278, w=24.
  const svgCap = Buffer.from(`
    <svg width="${newWidth}" height="${newHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Taxi light dome cap -->
      <rect x="138" y="6" width="94" height="28" rx="8" ry="8" fill="#ffffff" />
      <!-- Left roof pillar continuation -->
      <path d="M 73 20 Q 106 18 138 18 L 138 32 Q 106 28 73 32 Z" fill="#ffffff" />
      <!-- Right roof pillar continuation -->
      <path d="M 232 18 Q 266 18 303 20 L 303 32 Q 266 28 232 32 Z" fill="#ffffff" />
    </svg>
  `);

  const emblemWithCap = await sharp({
    create: {
      width: newWidth,
      height: newHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: svgCap, top: 0, left: 0 },
      { input: cutoutPath, top: capHeight, left: 0 }
    ])
    .trim()
    .png()
    .toBuffer();

  const emblemMeta = await sharp(emblemWithCap).metadata();
  console.log('Trimmed emblem size:', emblemMeta.width, 'x', emblemMeta.height);

  // Safe zone for 1024x1024 adaptive icon is 66% circle (radius ~340, width ~680)
  // Let emblem width be 640px
  const targetWidth = 640;
  const targetHeight = Math.round(emblemMeta.height * (targetWidth / emblemMeta.width));

  const resizedEmblem = await sharp(emblemWithCap)
    .resize(targetWidth, targetHeight, { fit: 'contain' })
    .toBuffer();

  const navyBg = { r: 1, g: 38, b: 67, alpha: 1 }; // #012643 official brand dark navy

  const topPos = Math.round((1024 - targetHeight) / 2);
  const leftPos = Math.round((1024 - targetWidth) / 2);

  const icon1024 = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: navyBg
    }
  })
    .composite([
      { input: resizedEmblem, top: topPos, left: leftPos }
    ])
    .png()
    .toBuffer();

  // Save to driver-app assets
  await sharp(icon1024).toFile(path.join(driverAssets, 'icon.png'));
  await sharp(icon1024).toFile(path.join(driverAssets, 'adaptive-icon.png'));

  // Save to customer-app assets
  await sharp(icon1024).toFile(path.join(customerAssets, 'icon.png'));
  await sharp(icon1024).toFile(path.join(customerAssets, 'adaptive-icon.png'));

  // Save trimmed emblem to assets
  await sharp(emblemWithCap).toFile(path.join(driverAssets, 'images', 'kc_emblem_trimmed.png'));
  await sharp(emblemWithCap).toFile(path.join(customerAssets, 'images', 'kc_emblem_trimmed.png'));

  console.log('Successfully generated 1024x1024 app icons for driver-app and customer-app!');
}

createMasterIcon().catch(console.error);
