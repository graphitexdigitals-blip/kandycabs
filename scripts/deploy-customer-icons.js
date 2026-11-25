const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { analyzeAndPatch } = require('./patch-version-code.js');
const cp = require('child_process');

function main() {
  const root = path.resolve(__dirname, '..');
  const srcDir = path.join(root, 'apps', 'customer-app', 'android_icons');
  const patchDir = path.join(root, 'apps', 'customer-app', 'dist_bundle', 'icon_patch');
  if (!fs.existsSync(patchDir)) fs.mkdirSync(patchDir, { recursive: true });

  const iconMapping = [
    { file: 'fg_mdpi.png', entry: 'res/QZ.png' },
    { file: 'fg_hdpi.png', entry: 'res/zr.png' },
    { file: 'fg_xhdpi.png', entry: 'res/Em.png' },
    { file: 'fg_xxhdpi.png', entry: 'res/Lf.png' },
    { file: 'fg_xxxhdpi.png', entry: 'res/as.png' },
    { file: 'square_mdpi.png', entry: 'res/9w.png' },
    { file: 'square_hdpi.png', entry: 'res/yn.png' },
    { file: 'square_xhdpi.png', entry: 'res/FS.png' },
    { file: 'square_xxhdpi.png', entry: 'res/RJ.png' },
    { file: 'square_xxxhdpi.png', entry: 'res/o-.png' },
    { file: 'round_mdpi.png', entry: 'res/zR.png' },
    { file: 'round_hdpi.png', entry: 'res/8c.png' },
    { file: 'round_xhdpi.png', entry: 'res/wb.png' },
    { file: 'round_xxhdpi.png', entry: 'res/fO.png' },
    { file: 'round_xxxhdpi.png', entry: 'res/Gc.png' }
  ];

  const manifestList = [];
  for (const item of iconMapping) {
    const srcFile = path.join(srcDir, item.file);
    const destFile = path.join(patchDir, item.file);
    fs.copyFileSync(srcFile, destFile);
    manifestList.push({ entry: item.entry, file: destFile });
  }

  fs.writeFileSync(path.join(patchDir, 'manifest.json'), JSON.stringify(manifestList, null, 2));

  // Extract AndroidManifest.xml and patch versionCode to 31
  const baseApk = path.join(root, 'dist_apk', 'kandy-cabs-customer.apk');
  const manifestBuf = cp.execSync(`tar -xOf "${baseApk}" AndroidManifest.xml`);
  const patchedManifest = analyzeAndPatch(manifestBuf, 31);
  fs.writeFileSync(path.join(patchDir, 'AndroidManifest.xml'), patchedManifest);

  // In-place patch resources.arsc in base APK to #FA4F01 (Orange)
  const buf = fs.readFileSync(baseApk);
  const name = Buffer.from('resources.arsc');
  const idx = buf.indexOf(name);
  if (idx !== -1) {
    const fnLen = buf.readUInt16LE(idx - 30 + 26);
    const extraLen = buf.readUInt16LE(idx - 30 + 28);
    const dataStart = idx - 30 + 30 + fnLen + extraLen;
    const dataLen = buf.readUInt32LE(idx - 30 + 18);
    const arscData = buf.subarray(dataStart, dataStart + dataLen);

    // If navy blue pattern exists, change back to orange
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
      console.log('Patched customer resources.arsc to #FA4F01');
    }
  }

  console.log('Customer app icon patch assets ready.');
}
main();
