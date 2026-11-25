const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cp = require('child_process');
const { analyzeAndPatch } = require('./patch-version-code.js');

async function main() {
  const root = path.resolve(__dirname, '..');
  const whiteMonoPath = path.join(root, 'apps', 'driver-app', 'assets', 'images', 'kc_white_only.png');
  if (!fs.existsSync(whiteMonoPath)) {
    throw new Error('kc_white_only.png not found at ' + whiteMonoPath);
  }

  const orangeBg = { r: 250, g: 79, b: 1, alpha: 1 };
  const patchDir = path.join(root, 'apps', 'driver-app', 'dist_bundle', 'icon_patch');
  if (!fs.existsSync(patchDir)) fs.mkdirSync(patchDir, { recursive: true });

  async function generateDriverIcon(size, fontScale) {
    const targetW = Math.max(1, Math.round(size * fontScale));
    const resizedMonogram = await sharp(whiteMonoPath)
      .resize({ width: targetW, fit: 'inside' })
      .toBuffer();

    const monoMeta = await sharp(resizedMonogram).metadata();
    const top = Math.round((size - monoMeta.height) / 2);
    const left = Math.round((size - monoMeta.width) / 2);

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: orangeBg,
      },
    })
      .composite([{ input: resizedMonogram, top, left }])
      .png()
      .toBuffer();
  }

  // Adaptive foreground: scale 0.45 of canvas (gives 68% width of the 72dp Android circular mask)
  // Legacy icons: scale 0.66 of icon
  const masterAdaptive1024 = await generateDriverIcon(1024, 0.45);
  const masterIcon1024 = await generateDriverIcon(1024, 0.66);

  fs.writeFileSync(path.join(root, 'apps', 'driver-app', 'assets', 'adaptive-icon.png'), masterAdaptive1024);
  fs.writeFileSync(path.join(root, 'apps', 'driver-app', 'assets', 'icon.png'), masterIcon1024);
  console.log('Saved apps/driver-app/assets/adaptive-icon.png (scale 0.45) and icon.png (scale 0.66)');

  // 15 native drawables
  const targets = [
    // Adaptive foregrounds (scale 0.45)
    { name: 'res/QZ.png', size: 108, scale: 0.45 },
    { name: 'res/zr.png', size: 162, scale: 0.45 },
    { name: 'res/Em.png', size: 216, scale: 0.45 },
    { name: 'res/Lf.png', size: 324, scale: 0.45 },
    { name: 'res/as.png', size: 432, scale: 0.45 },
    // Legacy square icons (scale 0.66)
    { name: 'res/9w.png', size: 48, scale: 0.66 },
    { name: 'res/yn.png', size: 72, scale: 0.66 },
    { name: 'res/FS.png', size: 96, scale: 0.66 },
    { name: 'res/RJ.png', size: 144, scale: 0.66 },
    { name: 'res/o-.png', size: 192, scale: 0.66 },
    // Legacy round icons (scale 0.66)
    { name: 'res/zR.png', size: 48, scale: 0.66 },
    { name: 'res/8c.png', size: 72, scale: 0.66 },
    { name: 'res/wb.png', size: 96, scale: 0.66 },
    { name: 'res/fO.png', size: 144, scale: 0.66 },
    { name: 'res/Gc.png', size: 192, scale: 0.66 }
  ];

  const manifestList = [];
  for (const t of targets) {
    const buf = await generateDriverIcon(t.size, t.scale);
    const safeName = t.name.replace('res/', '').replace('-', '_dash_') + '_' + t.size + '.png';
    const filePath = path.join(patchDir, safeName);
    fs.writeFileSync(filePath, buf);
    manifestList.push({ entry: t.name, file: filePath });
  }

  fs.writeFileSync(path.join(patchDir, 'manifest.json'), JSON.stringify(manifestList, null, 2));
  console.log('Generated 15 balanced proportion driver drawables in dist_bundle/icon_patch');

  // Update android source mipmaps
  const mipmapDir = path.join(root, 'apps', 'driver-app', 'android', 'app', 'src', 'main', 'res');
  const mipmapList = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 }
  ];

  for (const m of mipmapList) {
    const tDir = path.join(mipmapDir, m.dir);
    if (fs.existsSync(tDir)) {
      const sq = await generateDriverIcon(m.size, 0.66);
      const fg = await generateDriverIcon(m.fgSize, 0.45);
      fs.writeFileSync(path.join(tDir, 'ic_launcher.png'), sq);
      fs.writeFileSync(path.join(tDir, 'ic_launcher_round.png'), sq);
      fs.writeFileSync(path.join(tDir, 'ic_launcher_foreground.png'), fg);
    }
  }

  // Extract AndroidManifest.xml and bump versionCode to 33
  const baseApk = path.join(root, 'dist_apk', 'kandy-cabs-driver.apk');
  const manifestBuf = cp.execSync(`tar -xOf "${baseApk}" AndroidManifest.xml`);
  const patchedManifest = analyzeAndPatch(manifestBuf, 33);
  fs.writeFileSync(path.join(patchDir, 'AndroidManifest.xml'), patchedManifest);
  console.log('Patched AndroidManifest.xml to versionCode 33');

  // Generate preview of circular launcher icon (72dp safe zone in 108dp canvas)
  const previewSize = 512;
  const prevFg = await generateDriverIcon(previewSize, 0.45);
  const circleD = Math.round(previewSize * (72 / 108));
  const circleMaskSvg = `<svg width="${previewSize}" height="${previewSize}"><circle cx="${previewSize/2}" cy="${previewSize/2}" r="${circleD/2}" fill="#fff"/></svg>`;
  const circleMask = Buffer.from(circleMaskSvg);

  const circularPreview = await sharp(prevFg)
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const previewOut = path.join('C:', 'Users', 'Rakshith', '.gemini', 'antigravity', 'brain', '54357793-1034-48f8-9da5-8eea2ab067b5', 'driver_icon_new_circle_preview.png');
  fs.writeFileSync(previewOut, circularPreview);
  console.log('Saved preview to', previewOut);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
