const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const appAssetsDir = path.join(rootDir, 'apps', 'customer-app', 'assets', 'images');
const webImagesDir = path.join(rootDir, 'apps', 'web', 'public', 'images');
const adminImagesDir = path.join(rootDir, 'apps', 'admin', 'public', 'images');
const androidResDir = path.join(rootDir, 'apps', 'customer-app', 'android', 'app', 'src', 'main', 'res');

const fleetMap = [
  { src: 'out_swift.png', name: 'fleet-hatchback', androidName: 'assets_images_fleethatchback.png' },
  { src: 'out_etios.png', name: 'fleet-sedan', androidName: 'assets_images_fleetsedan.png' },
  { src: 'out_ertiga.png', name: 'fleet-suv', androidName: 'assets_images_fleetsuv.png' },
  { src: 'out_innova.png', name: 'fleet-crysta', androidName: 'assets_images_fleetcrysta.png' },
  { src: 'out_traveller.png', name: 'fleet-traveller', androidName: 'assets_images_fleettraveller.png' },
  { src: 'out_urbania.png', name: 'fleet-urbania', androidName: 'assets_images_fleeturbania.png' },
];

const homeCards = [
  { src: 'out_etios.png', name: 'fleet-4-sedan.png', androidName: 'assets_images_fleet4sedan.png' },
  { src: 'out_ertiga.png', name: 'fleet-4-ertiga.png', androidName: 'assets_images_fleet4ertiga.png' },
  { src: 'out_innova.png', name: 'fleet-4-innova.png', androidName: 'assets_images_fleet4innova.png' },
  { src: 'out_innova.png', name: 'fleet-4-crysta.png', androidName: 'assets_images_fleet4crysta.png' },
];

async function deploy() {
  console.log('Deploying fleet images across customer-app, web, admin, and android resources...');

  // 1. Copy 6 full-size fleet images (1024x576)
  for (const item of fleetMap) {
    const srcPath = path.join(rootDir, item.src);
    const destAppPng = path.join(appAssetsDir, `${item.name}.png`);
    const destWebPng = path.join(webImagesDir, `${item.name}.png`);
    const destWebWebp = path.join(webImagesDir, `${item.name}.webp`);
    const destAdminPng = path.join(adminImagesDir, `${item.name}.png`);

    fs.copyFileSync(srcPath, destAppPng);
    fs.copyFileSync(srcPath, destWebPng);
    if (fs.existsSync(adminImagesDir)) {
      fs.copyFileSync(srcPath, destAdminPng);
    }

    // WebP for web
    await sharp(srcPath).webp({ quality: 90 }).toFile(destWebWebp);
    console.log(`Updated ${item.name} in customer-app, web, admin.`);

    // Copy to android res drawable folders
    if (fs.existsSync(androidResDir)) {
      const dirs = fs.readdirSync(androidResDir);
      for (const d of dirs) {
        if (d.startsWith('drawable')) {
          const targetFile = path.join(androidResDir, d, item.androidName);
          if (fs.existsSync(targetFile)) {
            fs.copyFileSync(srcPath, targetFile);
            console.log(`  Updated Android res: ${d}/${item.androidName}`);
          }
        }
      }
    }
  }

  // 2. Generate home cards
  for (const card of homeCards) {
    const srcPath = path.join(rootDir, card.src);
    const destApp = path.join(appAssetsDir, card.name);

    await sharp(srcPath)
      .resize({ width: 480, height: 240, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(destApp);
    console.log(`Generated Home Card -> ${destApp}`);

    if (fs.existsSync(androidResDir)) {
      const dirs = fs.readdirSync(androidResDir);
      for (const d of dirs) {
        if (d.startsWith('drawable')) {
          const targetFile = path.join(androidResDir, d, card.androidName);
          if (fs.existsSync(targetFile)) {
            fs.copyFileSync(destApp, targetFile);
            console.log(`  Updated Android res: ${d}/${card.androidName}`);
          }
        }
      }
    }
  }

  // 3. Update dist_bundle if present
  const distBundleRes = path.join(rootDir, 'apps', 'customer-app', 'dist_bundle', 'res');
  if (fs.existsSync(distBundleRes)) {
    const dirs = fs.readdirSync(distBundleRes);
    for (const d of dirs) {
      if (d.startsWith('drawable')) {
        for (const item of fleetMap) {
          const target = path.join(distBundleRes, d, item.androidName);
          if (fs.existsSync(target)) {
            fs.copyFileSync(path.join(rootDir, item.src), target);
          }
        }
        for (const card of homeCards) {
          const target = path.join(distBundleRes, d, card.androidName);
          if (fs.existsSync(target)) {
            fs.copyFileSync(path.join(appAssetsDir, card.name), target);
          }
        }
      }
    }
    console.log('Updated dist_bundle res assets as well.');
  }

  console.log('ALL FLEET ASSETS SUCCESSFULLY DEPLOYED TO ALL TARGETS!');
}

deploy().catch(console.error);
