const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cp = require('child_process');
const zlib = require('zlib');
const { analyzeAndPatch } = require('./patch-version-code.js');

async function restoreCustomerToNavy() {
  const root = path.resolve(__dirname, '..');
  const appDir = path.join(root, 'apps', 'customer-app');
  const tempDir = path.join(appDir, 'dist_bundle', 'icon_patch');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const kcOrangePath = path.join(root, 'apps', 'driver-app', 'assets', 'images', 'kc_orange_only.png');
  const navyBg = { r: 1, g: 38, b: 67, alpha: 1 }; // #012643

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

  const master1024 = await generateNavyIcon(1024, 0.58);
  fs.writeFileSync(path.join(appDir, 'assets', 'icon.png'), master1024);
  fs.writeFileSync(path.join(appDir, 'assets', 'adaptive-icon.png'), master1024);

  const iconTargets = [
    { name: 'res/QZ.png', size: 108, scale: 0.58 },
    { name: 'res/zr.png', size: 162, scale: 0.58 },
    { name: 'res/Em.png', size: 216, scale: 0.58 },
    { name: 'res/Lf.png', size: 324, scale: 0.58 },
    { name: 'res/as.png', size: 432, scale: 0.58 },
    { name: 'res/9w.png', size: 48, scale: 0.58 },
    { name: 'res/yn.png', size: 72, scale: 0.58 },
    { name: 'res/FS.png', size: 96, scale: 0.58 },
    { name: 'res/RJ.png', size: 144, scale: 0.58 },
    { name: 'res/o-.png', size: 192, scale: 0.58 },
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
  }
  fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(generatedList, null, 2));

  // Patch resources.arsc in customer base APK back to #012643
  const baseApk = path.join(root, 'dist_apk', 'kandy-cabs-customer.apk');
  const buf = fs.readFileSync(baseApk);
  const name = Buffer.from('resources.arsc');
  const idx = buf.indexOf(name);
  if (idx !== -1) {
    const fnLen = buf.readUInt16LE(idx - 30 + 26);
    const extraLen = buf.readUInt16LE(idx - 30 + 28);
    const dataStart = idx - 30 + 30 + fnLen + extraLen;
    const dataLen = buf.readUInt32LE(idx - 30 + 18);
    const arscData = buf.subarray(dataStart, dataStart + dataLen);
    const patOrange = Buffer.from([0x08, 0x00, 0x00, 0x1D, 0x01, 0x4F, 0xFA, 0xFF]);
    const colorOffset = arscData.indexOf(patOrange);
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
      fs.writeFileSync(baseApk, buf);
    }
  }

  console.log('Customer app orange icon removed and restored to navy/orange.');
}
restoreCustomerToNavy().catch(console.error);
