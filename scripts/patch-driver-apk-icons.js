const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const root = path.resolve(__dirname, '..');
  const tempDir = path.join(root, 'apps', 'driver-app', 'dist_bundle', 'icon_patch');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // Locate the clean white KC letters for driver app
  const kcWhiteLettersPath = path.join(root, 'apps', 'driver-app', 'assets', 'images', 'kc_letters_trimmed.png');
  if (!fs.existsSync(kcWhiteLettersPath)) {
    throw new Error('kc_letters_trimmed.png not found at ' + kcWhiteLettersPath);
  }

  // Official brand full-bleed orange: RGB(252, 82, 4) -> #FC5204
  const orangeBg = { r: 252, g: 82, b: 4, alpha: 1 };

  console.log('Generating crisp full-bleed orange icons with white KC monogram...');

  // Helper: generate full bleed orange icon with white KC monogram
  async function generateFullBleedIcon(size, fontScale = 0.38) {
    const targetW = Math.max(1, Math.round(size * fontScale));
    const resizedMonogram = await sharp(kcWhiteLettersPath)
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
  const masterIconBuf = await generateFullBleedIcon(1024, 0.38);
  fs.writeFileSync(path.join(driverAssetsDir, 'icon.png'), masterIconBuf);
  fs.writeFileSync(path.join(driverAssetsDir, 'adaptive-icon.png'), masterIconBuf);
  console.log('Updated apps/driver-app/assets/icon.png and adaptive-icon.png (1024x1024)');

  // All 15 native Android APK drawable targets
  // Adaptive foregrounds: 108, 162, 216, 324, 432 (fontScale = 0.38)
  // Legacy square & round icons: 48, 72, 96, 144, 192 (fontScale = 0.40)
  const iconTargets = [
    // Adaptive foregrounds
    { name: 'res/QZ.png', size: 108, scale: 0.38 },
    { name: 'res/zr.png', size: 162, scale: 0.38 },
    { name: 'res/Em.png', size: 216, scale: 0.38 },
    { name: 'res/Lf.png', size: 324, scale: 0.38 },
    { name: 'res/as.png', size: 432, scale: 0.38 },
    // Legacy square icons
    { name: 'res/9w.png', size: 48, scale: 0.40 },
    { name: 'res/yn.png', size: 72, scale: 0.40 },
    { name: 'res/FS.png', size: 96, scale: 0.40 },
    { name: 'res/RJ.png', size: 144, scale: 0.40 },
    { name: 'res/o-.png', size: 192, scale: 0.40 },
    // Legacy round icons
    { name: 'res/zR.png', size: 48, scale: 0.40 },
    { name: 'res/8c.png', size: 72, scale: 0.40 },
    { name: 'res/wb.png', size: 96, scale: 0.40 },
    { name: 'res/fO.png', size: 144, scale: 0.40 },
    { name: 'res/Gc.png', size: 192, scale: 0.40 }
  ];

  const generatedList = [];
  for (const target of iconTargets) {
    const outBuf = await generateFullBleedIcon(target.size, target.scale);
    const safeName = target.name.replace('res/', '').replace('-', '_dash_') + '_' + target.size + '.png';
    const localPath = path.join(tempDir, safeName);
    fs.writeFileSync(localPath, outBuf);
    generatedList.push({ entry: target.name, file: localPath });
    console.log(`Generated ${target.name} (${target.size}x${target.size}) -> ${safeName}`);
  }

  // Update android native source mipmaps
  const mipmapDir = path.join(root, 'apps', 'driver-app', 'android', 'app', 'src', 'main', 'res');
  const mipmapMap = [
    { dir: 'mipmap-mdpi', squareSize: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', squareSize: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', squareSize: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', squareSize: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', squareSize: 192, fgSize: 432 }
  ];

  for (const m of mipmapMap) {
    const targetDir = path.join(mipmapDir, m.dir);
    if (fs.existsSync(targetDir)) {
      const squareBuf = await generateFullBleedIcon(m.squareSize, 0.40);
      const fgBuf = await generateFullBleedIcon(m.fgSize, 0.38);

      fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), squareBuf);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), squareBuf);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), fgBuf);
      console.log(`Updated android source ${m.dir} icons`);
    }
  }

  // Update colors.xml iconBackground to #FC5204
  const colorsXmlPath = path.join(mipmapDir, 'values', 'colors.xml');
  if (fs.existsSync(colorsXmlPath)) {
    let colorsContent = fs.readFileSync(colorsXmlPath, 'utf8');
    colorsContent = colorsContent.replace(/<color name="iconBackground">[^<]+<\/color>/, '<color name="iconBackground">#FC5204</color>');
    fs.writeFileSync(colorsXmlPath, colorsContent);
    console.log('Updated colors.xml iconBackground to #FC5204');
  }

  // In-place patch resources.arsc in base APK so it stays 100% uncompressed (Method 0) and 4-byte aligned
  const zlib = require('zlib');
  const baseApkPath = path.join(root, 'dist_apk', 'kandy-cabs-driver.apk');
  if (fs.existsSync(baseApkPath)) {
    const buf = fs.readFileSync(baseApkPath);
    const name = Buffer.from('resources.arsc');
    const idx = buf.indexOf(name);
    if (idx !== -1) {
      const fnLen = buf.readUInt16LE(idx - 30 + 26);
      const extraLen = buf.readUInt16LE(idx - 30 + 28);
      const dataStart = idx - 30 + 30 + fnLen + extraLen;
      const dataLen = 1191092;
      const pattern = Buffer.from([0x08, 0x00, 0x00, 0x1D, 0x43, 0x26, 0x01, 0xFF]);
      const arscData = buf.subarray(dataStart, dataStart + dataLen);
      const colorOffset = arscData.indexOf(pattern);

      if (colorOffset !== -1) {
        arscData[colorOffset + 4] = 0x04; // Blue
        arscData[colorOffset + 5] = 0x52; // Green
        arscData[colorOffset + 6] = 0xFC; // Red
        arscData[colorOffset + 7] = 0xFF; // Alpha

        const newCrc = zlib.crc32(arscData);
        buf.writeUInt32LE(newCrc, idx - 30 + 14);

        let cdIdx = idx + dataLen;
        while ((cdIdx = buf.indexOf(name, cdIdx)) !== -1) {
          if (buf.readUInt32LE(cdIdx - 46) === 0x02014b50) {
            buf.writeUInt32LE(newCrc, cdIdx - 46 + 16);
            break;
          }
          cdIdx += 14;
        }

        fs.writeFileSync(baseApkPath, buf);
        console.log('In-place patched base APK resources.arsc with #FC5204 (Stored, aligned)');
      } else {
        console.log('Base APK resources.arsc already has #FC5204');
      }
    }
  }

  // Write mapping JSON for update-driver-apk.ps1 (drawables only)
  fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(generatedList, null, 2));
  console.log(`Done preparing ${generatedList.length} patch assets.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
