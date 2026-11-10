const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  const root = path.join(__dirname, '..');
  const sourceIconPath = path.join(
    'C:', 'Users', 'Rakshith', '.gemini', 'antigravity', 'brain',
    '54357793-1034-48f8-9da5-8eea2ab067b5', '.user_uploaded',
    'media_1794297858113_92f920a5.jpg'
  );
  const outDir = path.join(root, 'apps', 'customer-app', 'android_icons');
  const assetsDir = path.join(root, 'apps', 'customer-app', 'assets');
  const imagesDir = path.join(assetsDir, 'images');

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

  console.log('Generating high-res master icon and adaptive-icon for customer-app...');

  // 1. Extract clean white KC letters
  const { data, info } = await sharp(sourceIconPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const kcBuf = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dstIdx = (y * w + x) * 4;
      if (x < 120 || x > 900 || y < 280 || y > 780) {
        kcBuf[dstIdx + 3] = 0;
        continue;
      }
      const srcIdx = (y * w + x) * 3;
      const b = data[srcIdx + 2];
      let alpha = 0;
      if (b > 15) {
        const t = (b - 8) / (235 - 8);
        alpha = Math.min(255, Math.max(0, Math.round(t * 255)));
      }
      kcBuf[dstIdx] = 255;
      kcBuf[dstIdx + 1] = 255;
      kcBuf[dstIdx + 2] = 255;
      kcBuf[dstIdx + 3] = alpha;
    }
  }

  const kcTrimmedPath = path.join(imagesDir, 'kc_white_trimmed.png');
  await sharp(kcBuf, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .toFile(kcTrimmedPath);

  // 2. Master full-bleed square icon.png (1024x1024, orange #F74A01 with white KC)
  const kcSquareW = Math.round(1024 * 0.68);
  const resizedKCSquare = await sharp(kcTrimmedPath).resize({ width: kcSquareW }).toBuffer();
  const squareMeta = await sharp(resizedKCSquare).metadata();
  const topSquare = Math.round((1024 - squareMeta.height) / 2);
  const leftSquare = Math.round((1024 - squareMeta.width) / 2);

  const masterSquare = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 247, g: 74, b: 1, alpha: 1 } // #F74A01
    }
  })
  .composite([{ input: resizedKCSquare, top: topSquare, left: leftSquare }])
  .png()
  .toBuffer();

  await sharp(masterSquare).toFile(path.join(assetsDir, 'icon.png'));
  console.log('Saved assets/icon.png');

  // 3. Master adaptive-icon.png (1024x1024, orange #F74A01 with white KC in 55% safe zone)
  const kcAdaptiveW = Math.round(1024 * 0.55);
  const resizedKCAdaptive = await sharp(kcTrimmedPath).resize({ width: kcAdaptiveW }).toBuffer();
  const adaptiveMeta = await sharp(resizedKCAdaptive).metadata();
  const topAdaptive = Math.round((1024 - adaptiveMeta.height) / 2);
  const leftAdaptive = Math.round((1024 - adaptiveMeta.width) / 2);

  const masterAdaptive = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 247, g: 74, b: 1, alpha: 1 } // #F74A01
    }
  })
  .composite([{ input: resizedKCAdaptive, top: topAdaptive, left: leftAdaptive }])
  .png()
  .toBuffer();

  await sharp(masterAdaptive).toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('Saved assets/adaptive-icon.png');

  // Helper for Adaptive Foregrounds (full bleed orange with centered white KC in safe zone)
  async function makeAdaptiveForeground(size) {
    const kcW = Math.round(size * 0.55);
    const resizedKC = await sharp(kcTrimmedPath).resize({ width: kcW }).toBuffer();
    const meta = await sharp(resizedKC).metadata();
    const top = Math.round((size - meta.height) / 2);
    const left = Math.round((size - meta.width) / 2);

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 247, g: 74, b: 1, alpha: 1 }
      }
    })
    .composite([{ input: resizedKC, top, left }])
    .png()
    .toBuffer();
  }

  // Helper for Legacy Square Icons (full bleed orange to prevent Samsung One UI from adding white frames)
  async function makeSquareIcon(size) {
    const kcW = Math.round(size * 0.65);
    const resizedKC = await sharp(kcTrimmedPath).resize({ width: kcW }).toBuffer();
    const meta = await sharp(resizedKC).metadata();
    const top = Math.round((size - meta.height) / 2);
    const left = Math.round((size - meta.width) / 2);

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 247, g: 74, b: 1, alpha: 1 }
      }
    })
    .composite([{ input: resizedKC, top, left }])
    .png()
    .toBuffer();
  }

  // Helper for Legacy Circular Icons
  async function makeRoundIcon(size) {
    const fg = await makeAdaptiveForeground(size);
    const radius = Math.round(size / 2);
    const circleMask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="#fff"/></svg>`
    );

    return sharp(fg)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }

  // Generate 5 Adaptive Foregrounds (distinct names on disk to avoid Windows NTFS case collision!)
  // mdpi: 108 -> res/QZ.png
  // hdpi: 162 -> res/zr.png
  // xhdpi: 216 -> res/Em.png
  // xxhdpi: 324 -> res/Lf.png
  // xxxhdpi: 432 -> res/as.png
  await sharp(await makeAdaptiveForeground(108)).toFile(path.join(outDir, 'fg_mdpi.png'));
  await sharp(await makeAdaptiveForeground(162)).toFile(path.join(outDir, 'fg_hdpi.png'));
  await sharp(await makeAdaptiveForeground(216)).toFile(path.join(outDir, 'fg_xhdpi.png'));
  await sharp(await makeAdaptiveForeground(324)).toFile(path.join(outDir, 'fg_xxhdpi.png'));
  await sharp(await makeAdaptiveForeground(432)).toFile(path.join(outDir, 'fg_xxxhdpi.png'));

  // Generate 5 Legacy Square Icons
  // mdpi: 48 -> res/9w.png
  // hdpi: 72 -> res/yn.png
  // xhdpi: 96 -> res/FS.png
  // xxhdpi: 144 -> res/RJ.png
  // xxxhdpi: 192 -> res/o-.png
  await sharp(await makeSquareIcon(48)).toFile(path.join(outDir, 'square_mdpi.png'));
  await sharp(await makeSquareIcon(72)).toFile(path.join(outDir, 'square_hdpi.png'));
  await sharp(await makeSquareIcon(96)).toFile(path.join(outDir, 'square_xhdpi.png'));
  await sharp(await makeSquareIcon(144)).toFile(path.join(outDir, 'square_xxhdpi.png'));
  await sharp(await makeSquareIcon(192)).toFile(path.join(outDir, 'square_xxxhdpi.png'));

  // Generate 5 Legacy Round Icons
  // mdpi: 48 -> res/zR.png
  // hdpi: 72 -> res/8c.png
  // xhdpi: 96 -> res/wb.png
  // xxhdpi: 144 -> res/fO.png
  // xxxhdpi: 192 -> res/Gc.png
  await sharp(await makeRoundIcon(48)).toFile(path.join(outDir, 'round_mdpi.png'));
  await sharp(await makeRoundIcon(72)).toFile(path.join(outDir, 'round_hdpi.png'));
  await sharp(await makeRoundIcon(96)).toFile(path.join(outDir, 'round_xhdpi.png'));
  await sharp(await makeRoundIcon(144)).toFile(path.join(outDir, 'round_xxhdpi.png'));
  await sharp(await makeRoundIcon(192)).toFile(path.join(outDir, 'round_xxxhdpi.png'));

  console.log('All 15 native Android launcher icon densities generated successfully with distinct filenames!');
}

main().catch(console.error);
