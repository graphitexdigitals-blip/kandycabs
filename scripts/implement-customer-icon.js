const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cp = require('child_process');
const zlib = require('zlib');
const { analyzeAndPatch } = require('./patch-version-code.js');

async function main() {
  const root = path.resolve(__dirname, '..');
  const masterPath = path.join(root, 'apps', 'customer-app', 'assets', 'adaptive-icon.png');
  if (!fs.existsSync(masterPath)) {
    throw new Error('Master adaptive-icon.png not found at ' + masterPath);
  }

  const patchDir = path.join(root, 'apps', 'customer-app', 'dist_bundle', 'icon_patch');
  const iconsDir = path.join(root, 'apps', 'customer-app', 'android_icons');
  if (!fs.existsSync(patchDir)) fs.mkdirSync(patchDir, { recursive: true });
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  // 1. Set assets/icon.png to match adaptive-icon.png
  fs.copyFileSync(masterPath, path.join(root, 'apps', 'customer-app', 'assets', 'icon.png'));
  console.log('Synchronized apps/customer-app/assets/icon.png');

  // 2. Generate all 15 densities directly from master adaptive-icon.png
  const targets = [
    { entry: 'res/QZ.png', size: 108 },
    { entry: 'res/zr.png', size: 162 },
    { entry: 'res/Em.png', size: 216 },
    { entry: 'res/Lf.png', size: 324 },
    { entry: 'res/as.png', size: 432 },
    { entry: 'res/9w.png', size: 48 },
    { entry: 'res/yn.png', size: 72 },
    { entry: 'res/FS.png', size: 96 },
    { entry: 'res/RJ.png', size: 144 },
    { entry: 'res/o-.png', size: 192 },
    { entry: 'res/zR.png', size: 48 },
    { entry: 'res/8c.png', size: 72 },
    { entry: 'res/wb.png', size: 96 },
    { entry: 'res/fO.png', size: 144 },
    { entry: 'res/Gc.png', size: 192 }
  ];

  const manifestList = [];
  for (const t of targets) {
    const buf = await sharp(masterPath).resize(t.size, t.size).png().toBuffer();
    const safeName = t.entry.replace('res/', '').replace('-', '_dash_') + '_' + t.size + '.png';
    const filePath = path.join(patchDir, safeName);
    fs.writeFileSync(filePath, buf);
    manifestList.push({ entry: t.entry, file: filePath });
    // Also save in android_icons
    fs.writeFileSync(path.join(iconsDir, safeName), buf);
  }

  fs.writeFileSync(path.join(patchDir, 'manifest.json'), JSON.stringify(manifestList, null, 2));
  console.log('Generated 15 drawables directly from adaptive-icon.png');

  // 3. Update android source mipmaps
  const mipmapDir = path.join(root, 'apps', 'customer-app', 'android', 'app', 'src', 'main', 'res');
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
      const sq = await sharp(masterPath).resize(m.size, m.size).png().toBuffer();
      const fg = await sharp(masterPath).resize(m.fgSize, m.fgSize).png().toBuffer();
      fs.writeFileSync(path.join(tDir, 'ic_launcher.png'), sq);
      fs.writeFileSync(path.join(tDir, 'ic_launcher_round.png'), sq);
      fs.writeFileSync(path.join(tDir, 'ic_launcher_foreground.png'), fg);
    }
  }

  // 4. Extract AndroidManifest.xml and bump versionCode to 32
  const baseApk = path.join(root, 'dist_apk', 'kandy-cabs-customer.apk');
  const manifestBuf = cp.execSync(`tar -xOf "${baseApk}" AndroidManifest.xml`);
  const patchedManifest = analyzeAndPatch(manifestBuf, 32);
  fs.writeFileSync(path.join(patchDir, 'AndroidManifest.xml'), patchedManifest);
  console.log('Patched AndroidManifest.xml to versionCode 32');

  // 5. Ensure resources.arsc in base APK is #FA4F01
  const buf = fs.readFileSync(baseApk);
  const name = Buffer.from('resources.arsc');
  const idx = buf.indexOf(name);
  if (idx !== -1) {
    const fnLen = buf.readUInt16LE(idx - 30 + 26);
    const extraLen = buf.readUInt16LE(idx - 30 + 28);
    const dataStart = idx - 30 + 30 + fnLen + extraLen;
    const dataLen = buf.readUInt32LE(idx - 30 + 18);
    const arscData = buf.subarray(dataStart, dataStart + dataLen);

    const patNavy = Buffer.from([0x08, 0x00, 0x00, 0x1D, 0x43, 0x26, 0x01, 0xFF]);
    const offset = arscData.indexOf(patNavy);
    if (offset !== -1) {
      arscData[offset + 4] = 0x01; // Blue
      arscData[offset + 5] = 0x4F; // Green
      arscData[offset + 6] = 0xFA; // Red
      arscData[offset + 7] = 0xFF; // Alpha
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
      fs.writeFileSync(baseApk, buf);
      console.log('Verified base APK resources.arsc has #FA4F01');
    }
  }

  // 6. Delete all screenshot & temporary icon files in root
  const filesToDelete = [
    'apps_customer-app_assets_adaptive-icon_png_bottom.png',
    'apps_customer-app_assets_adaptive-icon_png_trimmed.png',
    'apps_customer-app_assets_icon_png_bottom.png',
    'apps_customer-app_assets_images_logo-with-tagline_png_bottom.png',
    'apps_customer-app_assets_images_logo_png_bottom.png',
    'customer_app_icon_master.jpg',
    'icon_restored_screen.png',
    'icon_37de300.png',
    'old_driver_adaptive_icon.png',
    'old_driver_icon.png'
  ];

  for (const f of filesToDelete) {
    const target = path.join(root, f);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      console.log('Deleted screenshot file:', f);
    }
  }

  // Also remove customer_extract directory if it exists
  const custExtract = path.join(root, 'customer_extract');
  if (fs.existsSync(custExtract)) {
    fs.rmSync(custExtract, { recursive: true, force: true });
    console.log('Deleted customer_extract directory');
  }

  console.log('Customer icon implementation and cleanup complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
