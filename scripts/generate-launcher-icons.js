const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  const root = path.join(__dirname, '..');
  const referenceImgPath = path.join(
    'C:', 'Users', 'Rakshith', '.gemini', 'antigravity', 'brain',
    '54357793-1034-48f8-9da5-8eea2ab067b5', '.user_uploaded',
    'media_1794321312124_b730b291.jpg'
  );
  const outDir = path.join(root, 'apps', 'customer-app', 'android_icons');
  const assetsDir = path.join(root, 'apps', 'customer-app', 'assets');
  const imagesDir = path.join(assetsDir, 'images');

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

  console.log('Generating full-bleed orange icons with smaller KC font from latest reference...');

  // 1. Extract clean white KC letters from latest reference image
  const { data, info } = await sharp(referenceImgPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width, h = info.height;
  const kcBuf = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dstIdx = (y * w + x) * 4;
      if (x < 260 || x > 785 || y < 350 || y > 690) {
        kcBuf[dstIdx + 3] = 0;
        continue;
      }
      const srcIdx = (y * w + x) * 3;
      const b = data[srcIdx + 2];
      let alpha = 0;
      if (b > 30) {
        const t = (b - 20) / (230 - 20);
        alpha = Math.min(255, Math.max(0, Math.round(t * 255)));
      }
      kcBuf[dstIdx] = 255;
      kcBuf[dstIdx + 1] = 255;
      kcBuf[dstIdx + 2] = 255;
      kcBuf[dstIdx + 3] = alpha;
    }
  }

  const kcTrimmedPath = path.join(imagesDir, 'kc_letters_trimmed.png');
  await sharp(kcBuf, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .toFile(kcTrimmedPath);

  console.log('Extracted and saved clean trimmed KC letters.');

  // Solid full-bleed orange brand color from reference: RGB(252, 82, 4) -> #FC5204
  const orangeBg = { r: 252, g: 82, b: 4, alpha: 1 };

  // Helper: Generate 100% full-bleed opaque orange icon with centered smaller white KC
  async function generateFullBleedIcon(size, fontScale = 0.38) {
    const kcW = Math.max(1, Math.round(size * fontScale));
    const resizedKC = await sharp(kcTrimmedPath).resize({ width: kcW }).toBuffer();
    const kcMeta = await sharp(resizedKC).metadata();
    const top = Math.round((size - kcMeta.height) / 2);
    const left = Math.round((size - kcMeta.width) / 2);

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: orangeBg,
      },
    })
      .composite([{ input: resizedKC, top, left }])
      .png()
      .toBuffer();
  }

  // 1. Master icon.png (1024x1024, full bleed orange, smaller KC font @ 38%)
  const masterIcon = await generateFullBleedIcon(1024, 0.38);
  await sharp(masterIcon).toFile(path.join(assetsDir, 'icon.png'));
  console.log('Saved assets/icon.png');

  // 2. Master adaptive-icon.png (1024x1024, full bleed orange, smaller KC font @ 38%)
  const masterAdaptive = await generateFullBleedIcon(1024, 0.38);
  await sharp(masterAdaptive).toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('Saved assets/adaptive-icon.png');

  // 3. 5 Native Android Adaptive Foregrounds (full bleed orange, safe zone @ 38%)
  await sharp(await generateFullBleedIcon(108, 0.38)).toFile(path.join(outDir, 'fg_mdpi.png'));
  await sharp(await generateFullBleedIcon(162, 0.38)).toFile(path.join(outDir, 'fg_hdpi.png'));
  await sharp(await generateFullBleedIcon(216, 0.38)).toFile(path.join(outDir, 'fg_xhdpi.png'));
  await sharp(await generateFullBleedIcon(324, 0.38)).toFile(path.join(outDir, 'fg_xxhdpi.png'));
  await sharp(await generateFullBleedIcon(432, 0.38)).toFile(path.join(outDir, 'fg_xxxhdpi.png'));

  // 4. 5 Native Android Legacy Square Icons (full bleed orange to prevent white OEM frames)
  await sharp(await generateFullBleedIcon(48, 0.40)).toFile(path.join(outDir, 'square_mdpi.png'));
  await sharp(await generateFullBleedIcon(72, 0.40)).toFile(path.join(outDir, 'square_hdpi.png'));
  await sharp(await generateFullBleedIcon(96, 0.40)).toFile(path.join(outDir, 'square_xhdpi.png'));
  await sharp(await generateFullBleedIcon(144, 0.40)).toFile(path.join(outDir, 'square_xxhdpi.png'));
  await sharp(await generateFullBleedIcon(192, 0.40)).toFile(path.join(outDir, 'square_xxxhdpi.png'));

  // 5. 5 Native Android Legacy Round Icons (full bleed orange to allow native OEM squircle clipping)
  await sharp(await generateFullBleedIcon(48, 0.38)).toFile(path.join(outDir, 'round_mdpi.png'));
  await sharp(await generateFullBleedIcon(72, 0.38)).toFile(path.join(outDir, 'round_hdpi.png'));
  await sharp(await generateFullBleedIcon(96, 0.38)).toFile(path.join(outDir, 'round_xhdpi.png'));
  await sharp(await generateFullBleedIcon(144, 0.38)).toFile(path.join(outDir, 'round_xxhdpi.png'));
  await sharp(await generateFullBleedIcon(192, 0.38)).toFile(path.join(outDir, 'round_xxxhdpi.png'));

  console.log('All 15 native Android launcher icon densities successfully created with full-bleed orange and smaller KC!');
}

main().catch(console.error);
