const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const root = path.resolve(__dirname, '..');
  const tempDir = path.join(root, 'apps', 'driver-app', 'dist_bundle', 'icon_patch');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // Locate the orange KC monogram for driver app
  const kcOrangePath = path.join(root, 'apps', 'driver-app', 'assets', 'images', 'kc_orange_only.png');
  if (!fs.existsSync(kcOrangePath)) {
    throw new Error('kc_orange_only.png not found at ' + kcOrangePath);
  }

  // Official brand dark navy blue: RGB(1, 38, 67) -> #012643
  const navyBg = { r: 1, g: 38, b: 67, alpha: 1 };

  console.log('Generating crisp navy blue icons with vibrant orange KC monogram...');

  // Helper: generate navy icon with orange KC monogram
  async function generateNavyIcon(size, fontScale = 0.58) {
    const targetW = Math.max(1, Math.round(size * fontScale));
    const resizedMonogram = await sharp(kcOrangePath)
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
        background: navyBg,
      },
    })
      .composite([{ input: resizedMonogram, top, left }])
      .png()
      .toBuffer();
  }

  // Master assets in apps/driver-app/assets/
  const driverAssetsDir = path.join(root, 'apps', 'driver-app', 'assets');
  const masterIconBuf = await generateNavyIcon(1024, 0.58);
  fs.writeFileSync(path.join(driverAssetsDir, 'icon.png'), masterIconBuf);
  fs.writeFileSync(path.join(driverAssetsDir, 'adaptive-icon.png'), masterIconBuf);
  console.log('Updated apps/driver-app/assets/icon.png and adaptive-icon.png (1024x1024)');

  // All 15 native Android APK drawable targets
  const iconTargets = [
    // Adaptive foregrounds
    { name: 'res/QZ.png', size: 108, scale: 0.58 },
    { name: 'res/zr.png', size: 162, scale: 0.58 },
    { name: 'res/Em.png', size: 216, scale: 0.58 },
    { name: 'res/Lf.png', size: 324, scale: 0.58 },
    { name: 'res/as.png', size: 432, scale: 0.58 },
    // Legacy square icons
    { name: 'res/9w.png', size: 48, scale: 0.58 },
    { name: 'res/yn.png', size: 72, scale: 0.58 },
    { name: 'res/FS.png', size: 96, scale: 0.58 },
    { name: 'res/RJ.png', size: 144, scale: 0.58 },
    { name: 'res/o-.png', size: 192, scale: 0.58 },
    // Legacy round icons
    { name: 'res/zR.png', size: 48, scale: 0.58 },
    { name: 'res/8c.png', size: 72, scale: 0.58 },
    { name: 'res/wb.png', size: 96, scale: 0.58 },
    { name: 'res/fO.png', size: 144, scale: 0.58 },
    { name: 'res/Gc.png', size: 192, scale: 0.58 }
  ];

  const generatedList = [];
  for (const target of iconTargets) {
    const outBuf = await generateNavyIcon(target.size, target.scale);
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
      const squareBuf = await generateNavyIcon(m.squareSize, 0.58);
      const fgBuf = await generateNavyIcon(m.fgSize, 0.58);

      fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), squareBuf);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), squareBuf);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), fgBuf);
      console.log(`Updated android source ${m.dir} icons`);
    }
  }

  // Update colors.xml iconBackground to #012643
  const colorsXmlPath = path.join(mipmapDir, 'values', 'colors.xml');
  if (fs.existsSync(colorsXmlPath)) {
    let colorsContent = fs.readFileSync(colorsXmlPath, 'utf8');
    colorsContent = colorsContent.replace(/<color name="iconBackground">[^<]+<\/color>/, '<color name="iconBackground">#012643</color>');
    fs.writeFileSync(colorsXmlPath, colorsContent);
    console.log('Updated colors.xml iconBackground to #012643');
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
      const patternOrange = Buffer.from([0x08, 0x00, 0x00, 0x1D, 0x04, 0x52, 0xFC, 0xFF]);
      const arscData = buf.subarray(dataStart, dataStart + dataLen);
      const colorOffset = arscData.indexOf(patternOrange);

      if (colorOffset !== -1) {
        arscData[colorOffset + 4] = 0x43; // Blue
        arscData[colorOffset + 5] = 0x26; // Green
        arscData[colorOffset + 6] = 0x01; // Red
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
        console.log('In-place patched base APK resources.arsc with #012643 (Navy Blue, aligned)');
      } else {
        console.log('Base APK resources.arsc already has #012643 or pattern matched');
      }
    }
  }

  // Write mapping JSON for update-driver-apk.ps1 / repack_driver_apk.ps1
  fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(generatedList, null, 2));
  console.log(`Done preparing ${generatedList.length} patch assets.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
