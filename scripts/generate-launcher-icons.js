const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  const root = path.join(__dirname, '..');
  const monogramPath = path.join(root, 'apps', 'customer-app', 'assets', 'images', 'customer_monogram_trimmed.png');

  if (!fs.existsSync(monogramPath)) {
    throw new Error('Trimmed monogram not found at ' + monogramPath);
  }

  const outDir = path.join(root, 'apps', 'customer-app', 'android_icons');
  const assetsDir = path.join(root, 'apps', 'customer-app', 'assets');
  const mipmapBaseDir = path.join(root, 'apps', 'customer-app', 'android', 'app', 'src', 'main', 'res');

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Official brand orange from master artwork: RGB(250, 79, 1) -> #FA4F01
  const orangeBg = { r: 250, g: 79, b: 1, alpha: 1 };

  console.log('Generating small, perfectly proportioned launcher icons matching Driver App scale...');

  async function generateIcon(size, scale) {
    const monoSize = Math.max(1, Math.round(size * scale));
    const resized = await sharp(monogramPath)
      .resize(monoSize, monoSize, { fit: 'inside' })
      .toBuffer();
    const meta = await sharp(resized).metadata();
    const top = Math.round((size - meta.height) / 2);
    const left = Math.round((size - meta.width) / 2);

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: orangeBg,
      },
    })
      .composite([{ input: resized, top, left }])
      .png()
      .toBuffer();
  }

  // 1. Master icon.png (1024x1024, scale 0.40) & adaptive-icon.png (1024x1024, scale 0.265 for safe zone)
  const masterIconBuf = await generateIcon(1024, 0.40);
  const masterAdaptiveBuf = await generateIcon(1024, 0.265);
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), masterIconBuf);
  fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), masterAdaptiveBuf);
  console.log('Saved assets/icon.png and assets/adaptive-icon.png');

  // 2. 15 densities for APK injection
  // Adaptive foregrounds: scale 0.265 (inside 66% circle mask, matches Driver App small scale)
  // Legacy square & round icons: scale 0.40 (matches Driver App small scale)
  const iconDensities = [
    // Adaptive foregrounds
    { file: 'fg_mdpi.png', size: 108, scale: 0.265 },
    { file: 'fg_hdpi.png', size: 162, scale: 0.265 },
    { file: 'fg_xhdpi.png', size: 216, scale: 0.265 },
    { file: 'fg_xxhdpi.png', size: 324, scale: 0.265 },
    { file: 'fg_xxxhdpi.png', size: 432, scale: 0.265 },
    // Legacy square icons
    { file: 'square_mdpi.png', size: 48, scale: 0.40 },
    { file: 'square_hdpi.png', size: 72, scale: 0.40 },
    { file: 'square_xhdpi.png', size: 96, scale: 0.40 },
    { file: 'square_xxhdpi.png', size: 144, scale: 0.40 },
    { file: 'square_xxxhdpi.png', size: 192, scale: 0.40 },
    // Legacy round icons
    { file: 'round_mdpi.png', size: 48, scale: 0.40 },
    { file: 'round_hdpi.png', size: 72, scale: 0.40 },
    { file: 'round_xhdpi.png', size: 96, scale: 0.40 },
    { file: 'round_xxhdpi.png', size: 144, scale: 0.40 },
    { file: 'round_xxxhdpi.png', size: 192, scale: 0.40 }
  ];

  for (const item of iconDensities) {
    const buf = await generateIcon(item.size, item.scale);
    fs.writeFileSync(path.join(outDir, item.file), buf);
    console.log(`Generated ${item.file} (${item.size}x${item.size}, scale ${item.scale})`);
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
      const squareBuf = await generateIcon(m.squareSize, 0.40);
      const fgBuf = await generateIcon(m.fgSize, 0.265);

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
