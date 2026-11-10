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

  // 2. Extract squircle with transparent corners
  const squircleBuf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 3;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];

      const isCornerArea = (x < 220 || x > 804) && (y < 220 || y > 804);
      let alpha = 255;
      if (isCornerArea) {
        const whiteness = Math.min(r, g, b);
        if (whiteness > 245) {
          alpha = 0;
        } else if (whiteness > 10) {
          const t = (248 - whiteness) / (248 - 10);
          alpha = Math.min(255, Math.max(0, Math.round(t * 255)));
        }
      }

      squircleBuf[dstIdx] = r;
      squircleBuf[dstIdx + 1] = g;
      squircleBuf[dstIdx + 2] = b;
      squircleBuf[dstIdx + 3] = alpha;
    }
  }

  const squirclePath = path.join(imagesDir, 'kc_squircle_transparent.png');
  await sharp(squircleBuf, { raw: { width: w, height: h, channels: 4 } }).toFile(squirclePath);

  // 3. Save master icon.png (1024x1024)
  await sharp(squirclePath)
    .resize(1024, 1024)
    .toFile(path.join(assetsDir, 'icon.png'));
  console.log('Saved assets/icon.png');

  // 4. Save master adaptive-icon.png (1024x1024, full bleed orange #F74A01 with white KC in 66% safe zone)
  const kcAdaptiveW = Math.round(1024 * 0.55); // 563px
  const resizedKCBuff = await sharp(kcTrimmedPath).resize({ width: kcAdaptiveW }).toBuffer();
  const kcMeta = await sharp(resizedKCBuff).metadata();
  const topAdaptive = Math.round((1024 - kcMeta.height) / 2);
  const leftAdaptive = Math.round((1024 - kcMeta.width) / 2);

  const masterAdaptive = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 247, g: 74, b: 1, alpha: 1 } // #F74A01
    }
  })
  .composite([{ input: resizedKCBuff, top: topAdaptive, left: leftAdaptive }])
  .png()
  .toBuffer();

  await sharp(masterAdaptive).toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('Saved assets/adaptive-icon.png');

  // Helper for Adaptive Foregrounds (full bleed orange with centered white KC)
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

  // Helper for Legacy Square Icons (squircle with smooth transparent corners)
  async function makeSquareIcon(size) {
    return sharp(squirclePath)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
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

  // Generate 5 Adaptive Foregrounds
  // mdpi: 108 -> res/QZ.png
  // hdpi: 162 -> res/zr.png (Wait, in APK res/zr.png was 48x48 or 162x162, let's make it match the exact APK dimension!)
  await sharp(await makeAdaptiveForeground(108)).toFile(path.join(outDir, 'res_QZ.png'));
  // Note: in customer APK, res/zr.png was 48x48. Let's make sure it matches 48 or 162. Let's check size in APK.
  await sharp(await makeAdaptiveForeground(48)).toFile(path.join(outDir, 'res_zr.png'));
  await sharp(await makeAdaptiveForeground(216)).toFile(path.join(outDir, 'res_Em.png'));
  await sharp(await makeAdaptiveForeground(324)).toFile(path.join(outDir, 'res_Lf.png'));
  await sharp(await makeAdaptiveForeground(432)).toFile(path.join(outDir, 'res_as.png'));

  // Generate 5 Legacy Square Icons
  await sharp(await makeSquareIcon(48)).toFile(path.join(outDir, 'res_9w.png'));
  await sharp(await makeSquareIcon(72)).toFile(path.join(outDir, 'res_yn.png'));
  await sharp(await makeSquareIcon(96)).toFile(path.join(outDir, 'res_FS.png'));
  await sharp(await makeSquareIcon(144)).toFile(path.join(outDir, 'res_RJ.png'));
  await sharp(await makeSquareIcon(192)).toFile(path.join(outDir, 'res_o-.png'));

  // Generate 5 Legacy Round Icons
  await sharp(await makeRoundIcon(48)).toFile(path.join(outDir, 'res_zR.png'));
  await sharp(await makeRoundIcon(72)).toFile(path.join(outDir, 'res_8c.png'));
  await sharp(await makeRoundIcon(96)).toFile(path.join(outDir, 'res_wb.png'));
  await sharp(await makeRoundIcon(144)).toFile(path.join(outDir, 'res_fO.png'));
  await sharp(await makeRoundIcon(192)).toFile(path.join(outDir, 'res_Gc.png'));

  console.log('All 15 native Android launcher icon densities generated successfully in android_icons!');
}

main().catch(console.error);
