const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  const root = path.join(__dirname, '..');
  const logoPath = path.join(root, 'apps', 'customer-app', 'assets', 'images', 'logo.png');
  const outDir = path.join(root, 'apps', 'customer-app', 'android_icons');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Generating high-res master icon and adaptive-icon for customer-app...');
  
  // 1. Master icon (1024x1024, white background, logo width: 720px)
  const logoBuffer = await sharp(logoPath).resize({ width: 720 }).toBuffer();
  const logoMeta = await sharp(logoBuffer).metadata();
  const top1024 = Math.round((1024 - logoMeta.height) / 2);
  const left1024 = Math.round((1024 - logoMeta.width) / 2);

  const masterSquare = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .composite([{ input: logoBuffer, top: top1024, left: left1024 }])
  .png()
  .toBuffer();

  // Save to assets/icon.png
  await sharp(masterSquare).toFile(path.join(root, 'apps', 'customer-app', 'assets', 'icon.png'));
  console.log('Saved assets/icon.png');

  // Master adaptive-icon (1024x1024, transparent background, logo width: 680px for safe zone)
  const adaptiveLogoBuf = await sharp(logoPath).resize({ width: 680 }).toBuffer();
  const adaptiveMeta = await sharp(adaptiveLogoBuf).metadata();
  const topAdaptive = Math.round((1024 - adaptiveMeta.height) / 2);
  const leftAdaptive = Math.round((1024 - adaptiveMeta.width) / 2);

  const masterAdaptive = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([{ input: adaptiveLogoBuf, top: topAdaptive, left: leftAdaptive }])
  .png()
  .toBuffer();

  // Save to assets/adaptive-icon.png
  await sharp(masterAdaptive).toFile(path.join(root, 'apps', 'customer-app', 'assets', 'adaptive-icon.png'));
  console.log('Saved assets/adaptive-icon.png');

  // Helper function to create adaptive foreground at specific canvas size
  async function makeAdaptiveForeground(size) {
    const logoW = Math.round(size * 0.70); // 70% of canvas width
    const resizedLogo = await sharp(logoPath).resize({ width: logoW }).toBuffer();
    const meta = await sharp(resizedLogo).metadata();
    const top = Math.round((size - meta.height) / 2);
    const left = Math.round((size - meta.width) / 2);

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{ input: resizedLogo, top, left }])
    .png()
    .toBuffer();
  }

  // Helper function to create legacy square icon
  async function makeSquareIcon(size) {
    const logoW = Math.round(size * 0.78);
    const resizedLogo = await sharp(logoPath).resize({ width: logoW }).toBuffer();
    const meta = await sharp(resizedLogo).metadata();
    const top = Math.round((size - meta.height) / 2);
    const left = Math.round((size - meta.width) / 2);

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .composite([{ input: resizedLogo, top, left }])
    .png()
    .toBuffer();
  }

  // Helper function to create legacy circular icon
  async function makeRoundIcon(size) {
    const squareBuf = await makeSquareIcon(size);
    const radius = Math.round(size / 2);
    const circleMask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="#fff"/></svg>`
    );

    return sharp(squareBuf)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }

  // Generate 5 Adaptive Foregrounds
  // mdpi: 108 -> res/QZ.png
  // hdpi: 162 -> res/zr.png
  // xhdpi: 216 -> res/Em.png
  // xxhdpi: 324 -> res/Lf.png
  // xxxhdpi: 432 -> res/as.png
  await sharp(await makeAdaptiveForeground(108)).toFile(path.join(outDir, 'res_QZ.png'));
  await sharp(await makeAdaptiveForeground(162)).toFile(path.join(outDir, 'res_zr.png'));
  await sharp(await makeAdaptiveForeground(216)).toFile(path.join(outDir, 'res_Em.png'));
  await sharp(await makeAdaptiveForeground(324)).toFile(path.join(outDir, 'res_Lf.png'));
  await sharp(await makeAdaptiveForeground(432)).toFile(path.join(outDir, 'res_as.png'));

  // Generate 5 Legacy Square Icons
  // mdpi: 48 -> res/9w.png
  // hdpi: 72 -> res/yn.png
  // xhdpi: 96 -> res/FS.png
  // xxhdpi: 144 -> res/RJ.png
  // xxxhdpi: 192 -> res/o-.png
  await sharp(await makeSquareIcon(48)).toFile(path.join(outDir, 'res_9w.png'));
  await sharp(await makeSquareIcon(72)).toFile(path.join(outDir, 'res_yn.png'));
  await sharp(await makeSquareIcon(96)).toFile(path.join(outDir, 'res_FS.png'));
  await sharp(await makeSquareIcon(144)).toFile(path.join(outDir, 'res_RJ.png'));
  await sharp(await makeSquareIcon(192)).toFile(path.join(outDir, 'res_o-.png'));

  // Generate 5 Legacy Round Icons
  // mdpi: 48 -> res/zR.png
  // hdpi: 72 -> res/8c.png
  // xhdpi: 96 -> res/wb.png
  // xxhdpi: 144 -> res/fO.png
  // xxxhdpi: 192 -> res/Gc.png
  await sharp(await makeRoundIcon(48)).toFile(path.join(outDir, 'res_zR.png'));
  await sharp(await makeRoundIcon(72)).toFile(path.join(outDir, 'res_8c.png'));
  await sharp(await makeRoundIcon(96)).toFile(path.join(outDir, 'res_wb.png'));
  await sharp(await makeRoundIcon(144)).toFile(path.join(outDir, 'res_fO.png'));
  await sharp(await makeRoundIcon(192)).toFile(path.join(outDir, 'res_Gc.png'));

  console.log('All 15 native Android launcher icon densities generated successfully in android_icons!');
}

main().catch(console.error);

