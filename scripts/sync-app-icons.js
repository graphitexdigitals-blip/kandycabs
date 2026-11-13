const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SIZES = [
  { dir: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
  { dir: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
  { dir: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
  { dir: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
  { dir: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
];

async function syncAppIcons(appName) {
  const appRoot = path.resolve(__dirname, `../apps/${appName}`);
  const iconPath = path.join(appRoot, 'assets/icon.png');
  const adaptivePath = path.join(appRoot, 'assets/adaptive-icon.png');
  const resDir = path.join(appRoot, 'android/app/src/main/res');

  if (!fs.existsSync(iconPath)) {
    console.error(`[sync-icons] Missing icon.png for ${appName}`);
    return;
  }

  const foregroundSource = fs.existsSync(adaptivePath) ? adaptivePath : iconPath;

  console.log(`[sync-icons] Syncing native Android icons for ${appName}...`);

  for (const { dir, iconSize, fgSize } of SIZES) {
    const targetDir = path.join(resDir, dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. ic_launcher.png (standard icon)
    await sharp(iconPath)
      .resize(iconSize, iconSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // 2. ic_launcher_round.png (round icon)
    await sharp(iconPath)
      .resize(iconSize, iconSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // 3. ic_launcher_foreground.png (adaptive foreground)
    await sharp(foregroundSource)
      .resize(fgSize, fgSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`  ✓ ${dir}: icon=${iconSize}x${iconSize}, fg=${fgSize}x${fgSize}`);
  }

  console.log(`[sync-icons] Finished ${appName}!\n`);
}

async function main() {
  await syncAppIcons('driver-app');
  await syncAppIcons('customer-app');
}

main().catch(err => {
  console.error('[sync-icons] Error:', err);
  process.exit(1);
});
