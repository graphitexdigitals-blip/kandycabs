const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cp = require('child_process');
const zlib = require('zlib');
const { analyzeAndPatch } = require('./patch-version-code.js');

async function main() {
  const root = path.resolve(__dirname, '..');
  const kcWhitePath = path.join(root, 'apps', 'driver-app', 'assets', 'images', 'kc_white_only.png');
  if (!fs.existsSync(kcWhitePath)) {
    throw new Error('kc_white_only.png not found at ' + kcWhitePath);
  }

  // Official brand vibrant orange: RGB(250, 79, 1) -> #FA4F01
  const orangeBg = { r: 250, g: 79, b: 1, alpha: 1 };

  console.log('Generating crisp orange background icons with bold white KC typography matching reference...');

  async function generateOrangeIcon(size, fontScale) {
    const targetW = Math.max(1, Math.round(size * fontScale));
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

  // 15 native Android APK drawable targets
  // Adaptive foregrounds: 0.65 scale (fits safely within the inner 66.7% mask with bold presence)
  // Legacy square & round icons: 0.76 scale (matches user squircle reference)
  const iconTargets = [
    // Adaptive foregrounds
    { name: 'res/QZ.png', size: 108, scale: 0.65 },
    { name: 'res/zr.png', size: 162, scale: 0.65 },
    { name: 'res/Em.png', size: 216, scale: 0.65 },
    { name: 'res/Lf.png', size: 324, scale: 0.65 },
    { name: 'res/as.png', size: 432, scale: 0.65 },
    // Legacy square icons
    { name: 'res/9w.png', size: 48, scale: 0.76 },
    { name: 'res/yn.png', size: 72, scale: 0.76 },
    { name: 'res/FS.png', size: 96, scale: 0.76 },
    { name: 'res/RJ.png', size: 144, scale: 0.76 },
    { name: 'res/o-.png', size: 192, scale: 0.76 },
    // Legacy round icons
    { name: 'res/zR.png', size: 48, scale: 0.76 },
    { name: 'res/8c.png', size: 72, scale: 0.76 },
    { name: 'res/wb.png', size: 96, scale: 0.76 },
    { name: 'res/fO.png', size: 144, scale: 0.76 },
    { name: 'res/Gc.png', size: 192, scale: 0.76 }
  ];

  const master1024 = await generateOrangeIcon(1024, 0.76);
  const masterAdaptive1024 = await generateOrangeIcon(1024, 0.65);

  async function prepareApp(appName, apkName) {
    console.log(`\n=== Preparing ${appName} ===`);
    const appDir = path.join(root, 'apps', appName);
    const tempDir = path.join(appDir, 'dist_bundle', 'icon_patch');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // Master assets
    fs.writeFileSync(path.join(appDir, 'assets', 'icon.png'), master1024);
    fs.writeFileSync(path.join(appDir, 'assets', 'adaptive-icon.png'), masterAdaptive1024);
    console.log(`Saved master icon.png & adaptive-icon.png in apps/${appName}/assets`);

    // Generate 15 drawables
    const generatedList = [];
    for (const target of iconTargets) {
      const outBuf = await generateOrangeIcon(target.size, target.scale);
      const safeName = target.name.replace('res/', '').replace('-', '_dash_') + '_' + target.size + '.png';
      const localPath = path.join(tempDir, safeName);
      fs.writeFileSync(localPath, outBuf);
      generatedList.push({ entry: target.name, file: localPath });
    }
    fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(generatedList, null, 2));
    console.log(`Generated 15 native drawables in ${tempDir}`);

    // Update Android source mipmaps if present
    const mipmapDir = path.join(appDir, 'android', 'app', 'src', 'main', 'res');
    const mipmapMap = [
      { dir: 'mipmap-mdpi', squareSize: 48, fgSize: 108 },
      { dir: 'mipmap-hdpi', squareSize: 72, fgSize: 162 },
      { dir: 'mipmap-xhdpi', squareSize: 96, fgSize: 216 },
      { dir: 'mipmap-xxhdpi', squareSize: 144, fgSize: 324 },
      { dir: 'mipmap-xxxhdpi', squareSize: 192, fgSize: 432 }
    ];
    for (const m of mipmapMap) {
      const tDir = path.join(mipmapDir, m.dir);
      if (fs.existsSync(tDir)) {
        const sq = await generateOrangeIcon(m.squareSize, 0.76);
        const fg = await generateOrangeIcon(m.fgSize, 0.65);
        fs.writeFileSync(path.join(tDir, 'ic_launcher.png'), sq);
        fs.writeFileSync(path.join(tDir, 'ic_launcher_round.png'), sq);
        fs.writeFileSync(path.join(tDir, 'ic_launcher_foreground.png'), fg);
      }
    }

    // Extract AndroidManifest.xml and patch versionCode to 31
    const baseApk = path.join(root, 'dist_apk', apkName);
    const manifestBuf = cp.execSync(`tar -xOf "${baseApk}" AndroidManifest.xml`);
    const patchedManifest = analyzeAndPatch(manifestBuf, 31);
    const manifestOutPath = path.join(tempDir, 'AndroidManifest.xml');
    fs.writeFileSync(manifestOutPath, patchedManifest);
    console.log(`Patched versionCode to 31 and saved ${manifestOutPath}`);

    // In-place patch resources.arsc in base APK
    patchArscToOrange(baseApk);
  }

  function patchArscToOrange(baseApkPath) {
    if (!fs.existsSync(baseApkPath)) return;
    const buf = fs.readFileSync(baseApkPath);
    const name = Buffer.from('resources.arsc');
    const idx = buf.indexOf(name);
    if (idx === -1) return;

    const fnLen = buf.readUInt16LE(idx - 30 + 26);
    const extraLen = buf.readUInt16LE(idx - 30 + 28);
    const dataStart = idx - 30 + 30 + fnLen + extraLen;
    const dataLen = buf.readUInt32LE(idx - 30 + 18);

    const arscData = buf.subarray(dataStart, dataStart + dataLen);
    // Patterns that could be present (navy blue #012643)
    const patNavy = Buffer.from([0x08, 0x00, 0x00, 0x1D, 0x43, 0x26, 0x01, 0xFF]);

    let found = false;
    let offset = arscData.indexOf(patNavy);
    while (offset !== -1) {
      // Patch to #FA4F01: Blue=0x01, Green=0x4F, Red=0xFA, Alpha=0xFF
      arscData[offset + 4] = 0x01; // Blue
      arscData[offset + 5] = 0x4F; // Green
      arscData[offset + 6] = 0xFA; // Red
      arscData[offset + 7] = 0xFF; // Alpha
      found = true;
      console.log(`Patched color in ${path.basename(baseApkPath)} at offset ${offset} to #FA4F01 (Orange)`);
      offset = arscData.indexOf(patNavy, offset + 8);
    }

    if (found) {
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
      console.log(`Updated CRC32 and saved ${path.basename(baseApkPath)}`);
    } else {
      console.log(`No navy pattern found in ${path.basename(baseApkPath)} (already Orange #FA4F01)`);
    }
  }

  await prepareApp('driver-app', 'kandy-cabs-driver.apk');
  await prepareApp('customer-app', 'kandy-cabs-customer.apk');
  console.log('\nAll orange icon patches prepared successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
