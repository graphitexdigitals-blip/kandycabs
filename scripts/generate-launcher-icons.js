const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  const root = path.join(__dirname, '..');
  const masterPath = path.join(root, 'apps', 'customer-app', 'assets', 'images', 'customer_app_icon_master.jpg');

  if (!fs.existsSync(masterPath)) {
    throw new Error('Master icon artwork not found at ' + masterPath);
  }

  const outDir = path.join(root, 'apps', 'customer-app', 'android_icons');
  const assetsDir = path.join(root, 'apps', 'customer-app', 'assets');
  const mipmapBaseDir = path.join(root, 'apps', 'customer-app', 'android', 'app', 'src', 'main', 'res');

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('Generating crisp launcher icons from new master artwork...');

  // 1. Master icon.png and adaptive-icon.png (1024x1024 PNG)
  const masterPngBuf = await sharp(masterPath)
    .resize(1024, 1024)
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(assetsDir, 'icon.png'), masterPngBuf);
  fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), masterPngBuf);
  console.log('Saved assets/icon.png and assets/adaptive-icon.png (1024x1024)');

  // Helper to generate resized PNG buffer
  async function resizeIcon(size) {
    return sharp(masterPath)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toBuffer();
  }

  // 2. Generate 15 densities for APK injection
  const iconDensities = [
    // Adaptive foregrounds (108, 162, 216, 324, 432)
    { file: 'fg_mdpi.png', size: 108 },
    { file: 'fg_hdpi.png', size: 162 },
    { file: 'fg_xhdpi.png', size: 216 },
    { file: 'fg_xxhdpi.png', size: 324 },
    { file: 'fg_xxxhdpi.png', size: 432 },
    // Legacy square icons (48, 72, 96, 144, 192)
    { file: 'square_mdpi.png', size: 48 },
    { file: 'square_hdpi.png', size: 72 },
    { file: 'square_xhdpi.png', size: 96 },
    { file: 'square_xxhdpi.png', size: 144 },
    { file: 'square_xxxhdpi.png', size: 192 },
    // Legacy round icons (48, 72, 96, 144, 192)
    { file: 'round_mdpi.png', size: 48 },
    { file: 'round_hdpi.png', size: 72 },
    { file: 'round_xhdpi.png', size: 96 },
    { file: 'round_xxhdpi.png', size: 144 },
    { file: 'round_xxxhdpi.png', size: 192 }
  ];

  for (const item of iconDensities) {
    const buf = await resizeIcon(item.size);
    fs.writeFileSync(path.join(outDir, item.file), buf);
    console.log(`Generated ${item.file} (${item.size}x${item.size})`);
  }

  // 3. Update Android source mipmaps
  const mipmaps = [
    { dir: 'mipmap-mdpi', squareSize: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', squareSize: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', squareSize: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', squareSize: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', squareSize: 192, fgSize: 432 }
  ];

  for (const m of mipmaps) {
    const targetDir = path.join(mipmapBaseDir, m.dir);
    if (fs.existsSync(targetDir)) {
      const squareBuf = await resizeIcon(m.squareSize);
      const fgBuf = await resizeIcon(m.fgSize);

      fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), squareBuf);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), squareBuf);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), fgBuf);
      console.log(`Updated android source mipmaps in ${m.dir}`);
    }
  }

  console.log('All customer app launcher icons updated successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
