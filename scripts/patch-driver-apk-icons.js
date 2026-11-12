const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

async function main() {
  const root = path.resolve(__dirname, '..');
  const tempDir = path.join(root, 'apps', 'driver-app', 'dist_bundle', 'icon_patch');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const kcOrangePath = path.join(root, 'apps', 'driver-app', 'assets', 'images', 'kc_orange_only.png');
  if (!fs.existsSync(kcOrangePath)) {
    throw new Error('kc_orange_only.png not found at ' + kcOrangePath);
  }

  console.log('Generating crisp launcher drawables with sharp...');
  const iconTargets = [
    { name: 'res/9w.png', size: 108 },
    { name: 'res/QZ.png', size: 108 },
    { name: 'res/zR.png', size: 108 },
    { name: 'res/yn.png', size: 162 },
    { name: 'res/zr.png', size: 162 },
    { name: 'res/8c.png', size: 162 },
    { name: 'res/FS.png', size: 216 },
    { name: 'res/Em.png', size: 216 },
    { name: 'res/wb.png', size: 216 },
    { name: 'res/RJ.png', size: 324 },
    { name: 'res/Lf.png', size: 324 },
    { name: 'res/fO.png', size: 324 },
    { name: 'res/o-.png', size: 432 },
    { name: 'res/as.png', size: 432 },
    { name: 'res/Gc.png', size: 432 }
  ];

  const generatedList = [];
  for (const target of iconTargets) {
    const size = target.size;
    const targetW = Math.round(size * 0.58);
    
    // Resize monogram to target safe zone
    const resizedMonogram = await sharp(kcOrangePath)
      .resize({ width: targetW, fit: 'inside' })
      .toBuffer();

    // Create solid navy canvas and composite monogram in absolute center
    const outBuf = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 1, g: 38, b: 67, alpha: 1 }
      }
    })
    .composite([{ input: resizedMonogram, gravity: 'center' }])
    .png()
    .toBuffer();

    const localFileName = target.name.replace('res/', '');
    const localPath = path.join(tempDir, localFileName);
    fs.writeFileSync(localPath, outBuf);
    generatedList.push({ entry: target.name, file: localPath });
    console.log(`Generated ${target.name} (${size}x${size})`);
  }

  // Also update android native source mipmaps
  const mipmapDir = path.join(root, 'apps', 'driver-app', 'android', 'app', 'src', 'main', 'res');
  const mipmapMap = [
    { dir: 'mipmap-mdpi', size: 108 },
    { dir: 'mipmap-hdpi', size: 162 },
    { dir: 'mipmap-xhdpi', size: 216 },
    { dir: 'mipmap-xxhdpi', size: 324 },
    { dir: 'mipmap-xxxhdpi', size: 432 }
  ];

  for (const m of mipmapMap) {
    const targetDir = path.join(mipmapDir, m.dir);
    if (fs.existsSync(targetDir)) {
      const size = m.size;
      const targetW = Math.round(size * 0.58);
      const resizedMonogram = await sharp(kcOrangePath)
        .resize({ width: targetW, fit: 'inside' })
        .toBuffer();

      const outBuf = await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 1, g: 38, b: 67, alpha: 1 }
        }
      })
      .composite([{ input: resizedMonogram, gravity: 'center' }])
      .png()
      .toBuffer();

      fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), outBuf);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), outBuf);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), outBuf);
      console.log(`Updated android source ${m.dir} icons (${size}x${size})`);
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

  // Patch resources.arsc to change @color/iconBackground from 0xFFFFFFFF to 0xFF012643
  const arscPath = path.join(root, 'scripts', 'resources.arsc');
  const arscBuf = fs.readFileSync(arscPath);
  // Verify offset 652996
  const offset = 652996;
  if (arscBuf[offset] === 0xFF && arscBuf[offset+1] === 0xFF && arscBuf[offset+2] === 0xFF && arscBuf[offset+3] === 0xFF) {
    arscBuf[offset] = 0x43;     // Blue
    arscBuf[offset+1] = 0x26;   // Green
    arscBuf[offset+2] = 0x01;   // Red
    arscBuf[offset+3] = 0xFF;   // Alpha
    const patchedArscPath = path.join(tempDir, 'resources.arsc');
    fs.writeFileSync(patchedArscPath, arscBuf);
    console.log('Patched resources.arsc iconBackground to #012643 at offset', offset);
    generatedList.push({ entry: 'resources.arsc', file: patchedArscPath });
  } else {
    console.warn('Warning: expected 0xFFFFFFFF at offset 652996 in resources.arsc not found!');
  }

  // Patch AndroidManifest.xml versionCode from 14 to 15
  const manifestPath = path.join(root, 'scripts', 'AndroidManifest.xml');
  const manifestBuf = fs.readFileSync(manifestPath);
  if (manifestBuf.readUInt32LE(9912) === 14) {
    manifestBuf.writeUInt32LE(15, 9912);
    const patchedManifestPath = path.join(tempDir, 'AndroidManifest.xml');
    fs.writeFileSync(patchedManifestPath, manifestBuf);
    console.log('Bumped versionCode to 15 in AndroidManifest.xml');
    generatedList.push({ entry: 'AndroidManifest.xml', file: patchedManifestPath });
  }

  // Write mapping JSON as ARRAY to prevent case-insensitive key collisions in PowerShell
  fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(generatedList, null, 2));
  console.log('Done preparing patch assets.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
