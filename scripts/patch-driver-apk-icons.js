const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const root = path.resolve(__dirname, '..');
  const tempDir = path.join(root, 'apps', 'driver-app', 'dist_bundle', 'icon_patch');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // Official bold white KC typography from reference
  const kcWhitePath = path.join(root, 'apps', 'driver-app', 'assets', 'images', 'kc_bold_white.png');
  if (!fs.existsSync(kcWhitePath)) {
    throw new Error('kc_bold_white.png not found at ' + kcWhitePath);
  }

  // Official brand vibrant orange: RGB(250, 79, 1) -> #FA4F01
  const orangeBg = { r: 250, g: 79, b: 1, alpha: 1 };

  // Smaller font scale per user instruction (scale: 0.55 vs original 0.72)
  const fontScale = 0.55;

  console.log(`Generating permanent vibrant orange driver icons with smaller bold white KC typography (scale: ${fontScale})...`);

  // Helper: generate orange icon with white KC typography
  async function generateOrangeIcon(size, scale = fontScale) {
    const targetW = Math.max(1, Math.round(size * scale));
    const resizedMonogram = await sharp(kcWhitePath)
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

  // Master assets in apps/driver-app/assets/
  const driverAssetsDir = path.join(root, 'apps', 'driver-app', 'assets');
  const masterIconBuf = await generateOrangeIcon(1024, 0.55);
  fs.writeFileSync(path.join(driverAssetsDir, 'icon.png'), masterIconBuf);
  fs.writeFileSync(path.join(driverAssetsDir, 'adaptive-icon.png'), masterIconBuf);
  console.log('Permanently updated apps/driver-app/assets/icon.png and adaptive-icon.png (1024x1024, orange bg, small bold KC)');

  // All 15 native Android APK drawable targets
  const iconTargets = [
    // Adaptive foregrounds
    { name: 'res/QZ.png', size: 108, scale: 0.55 },
    { name: 'res/zr.png', size: 162, scale: 0.55 },
    { name: 'res/Em.png', size: 216, scale: 0.55 },
    { name: 'res/Lf.png', size: 324, scale: 0.55 },
    { name: 'res/as.png', size: 432, scale: 0.55 },
    // Legacy square icons
    { name: 'res/9w.png', size: 48, scale: 0.55 },
    { name: 'res/yn.png', size: 72, scale: 0.55 },
    { name: 'res/FS.png', size: 96, scale: 0.55 },
    { name: 'res/RJ.png', size: 144, scale: 0.55 },
    { name: 'res/o-.png', size: 192, scale: 0.55 },
    // Legacy round icons
    { name: 'res/zR.png', size: 48, scale: 0.55 },
    { name: 'res/8c.png', size: 72, scale: 0.55 },
    { name: 'res/wb.png', size: 96, scale: 0.55 },
    { name: 'res/fO.png', size: 144, scale: 0.55 },
    { name: 'res/Gc.png', size: 192, scale: 0.55 },
  ];

  const generatedList = [];
  for (const target of iconTargets) {
    const outBuf = await generateOrangeIcon(target.size, target.scale);
    const safeName = target.name.replace('res/', '').replace('-', '_dash_') + '_' + target.size + '.png';
    const localPath = path.join(tempDir, safeName);
    fs.writeFileSync(localPath, outBuf);
    generatedList.push({ entry: target.name, file: localPath });
  }

  // Update Android source mipmaps if directory exists
  const mipmapDir = path.join(root, 'apps', 'driver-app', 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(mipmapDir)) {
    const mipmapMap = [
      { dir: 'mipmap-mdpi', squareSize: 48, fgSize: 108 },
      { dir: 'mipmap-hdpi', squareSize: 72, fgSize: 162 },
      { dir: 'mipmap-xhdpi', squareSize: 96, fgSize: 216 },
      { dir: 'mipmap-xxhdpi', squareSize: 144, fgSize: 324 },
      { dir: 'mipmap-xxxhdpi', squareSize: 192, fgSize: 432 },
    ];
    for (const m of mipmapMap) {
      const folder = path.join(mipmapDir, m.dir);
      if (fs.existsSync(folder)) {
        const sqBuf = await generateOrangeIcon(m.squareSize, 0.55);
        const fgBuf = await generateOrangeIcon(m.fgSize, 0.55);
        fs.writeFileSync(path.join(folder, 'ic_launcher.png'), sqBuf);
        fs.writeFileSync(path.join(folder, 'ic_launcher_round.png'), sqBuf);
        fs.writeFileSync(path.join(folder, 'ic_launcher_foreground.png'), fgBuf);
      }
    }
    console.log('Permanently updated Android source mipmap icons with small bold KC icons');
  }

  // Save manifest.json for update-driver-apk.ps1 to inject into the APK
  fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(generatedList, null, 2));
  console.log(`Successfully generated ${generatedList.length} orange drawables with small bold KC in ${tempDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
