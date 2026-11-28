const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  const root = path.join(__dirname, '..');
  const kandyLogoTs = fs.readFileSync(path.join(root, 'apps', 'customer-app', 'constants', 'kandyLogo.ts'), 'utf8');
  const match = kandyLogoTs.match(/base64,([A-Za-z0-9+/=]+)/);
  if (!match) throw new Error('Cannot find base64 logo in kandyLogo.ts');
  const logoBuf = Buffer.from(match[1], 'base64');

  const taglinePath = path.join(root, 'apps', 'customer-app', 'assets', 'your_journey_tagline.png');
  const badgePath = path.join(root, 'apps', 'customer-app', 'assets', 'trusted_travel_badge.png');

  // 1. Logo resized to width 800 (with previous brand color #F25A2A and #828382)
  const resizedLogo = await sharp(logoBuf).resize({ width: 800 }).toBuffer();
  const logoMeta = await sharp(resizedLogo).metadata();

  // 2. Tagline resized to width 750
  const resizedTagline = await sharp(taglinePath).resize({ width: 750 }).toBuffer();
  const taglineMeta = await sharp(resizedTagline).metadata();

  // 3. Badge resized to width 680
  const resizedBadge = await sharp(badgePath).resize({ width: 680 }).toBuffer();
  const badgeMeta = await sharp(resizedBadge).metadata();

  console.log('Logo:', logoMeta.width, 'x', logoMeta.height);
  console.log('Tagline:', taglineMeta.width, 'x', taglineMeta.height);
  console.log('Badge:', badgeMeta.width, 'x', badgeMeta.height);

  const pad1 = 30; // tight padding between logo and tagline
  const pad2 = 34; // tight padding between tagline and badge

  const totalHeight = logoMeta.height + pad1 + taglineMeta.height + pad2 + badgeMeta.height;
  const canvasWidth = 1284;
  const canvasHeight = 2778;

  const logoTop = Math.round((canvasHeight - totalHeight) / 2);
  const logoLeft = Math.round((canvasWidth - logoMeta.width) / 2);

  const taglineTop = logoTop + logoMeta.height + pad1;
  const taglineLeft = Math.round((canvasWidth - taglineMeta.width) / 2);

  const badgeTop = taglineTop + taglineMeta.height + pad2;
  const badgeLeft = Math.round((canvasWidth - badgeMeta.width) / 2);

  console.log({ totalHeight, logoTop, taglineTop, badgeTop });

  // Generate full 1284x2778 splash.png
  const splashPath = path.join(root, 'apps', 'customer-app', 'assets', 'splash.png');
  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: resizedLogo, top: logoTop, left: logoLeft },
      { input: resizedTagline, top: taglineTop, left: taglineLeft },
      { input: resizedBadge, top: badgeTop, left: badgeLeft },
    ])
    .png()
    .toFile(splashPath);

  console.log('Generated apps/customer-app/assets/splash.png');

  // Also create compact lockup (no huge canvas padding) for Android drawables
  const lockupWidth = Math.max(logoMeta.width, taglineMeta.width, badgeMeta.width) + 40; // 840px
  const lockupHeight = totalHeight + 40; // ~859px
  const lockupLogoTop = 20;
  const lockupLogoLeft = Math.round((lockupWidth - logoMeta.width) / 2);
  const lockupTaglineTop = lockupLogoTop + logoMeta.height + pad1;
  const lockupTaglineLeft = Math.round((lockupWidth - taglineMeta.width) / 2);
  const lockupBadgeTop = lockupTaglineTop + taglineMeta.height + pad2;
  const lockupBadgeLeft = Math.round((lockupWidth - badgeMeta.width) / 2);

  const lockupBuf = await sharp({
    create: {
      width: lockupWidth,
      height: lockupHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([
      { input: resizedLogo, top: lockupLogoTop, left: lockupLogoLeft },
      { input: resizedTagline, top: lockupTaglineTop, left: lockupTaglineLeft },
      { input: resizedBadge, top: lockupBadgeTop, left: lockupBadgeLeft },
    ])
    .png()
    .toBuffer();

  const densities = [
    { name: 'drawable-mdpi', width: 280, height: 286 },
    { name: 'drawable-hdpi', width: 420, height: 430 },
    { name: 'drawable-xhdpi', width: 560, height: 573 },
    { name: 'drawable-xxhdpi', width: 840, height: 859 },
    { name: 'drawable-xxxhdpi', width: 1120, height: 1146 },
  ];

  const resBase = path.join(root, 'apps', 'customer-app', 'android', 'app', 'src', 'main', 'res');
  for (const d of densities) {
    const outFolder = path.join(resBase, d.name);
    if (!fs.existsSync(outFolder)) fs.mkdirSync(outFolder, { recursive: true });
    const targetFile = path.join(outFolder, 'splashscreen_image.png');
    await sharp(lockupBuf)
      .resize(d.width, d.height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(targetFile);
    console.log(`Generated ${d.name}/splashscreen_image.png (${d.width}x${d.height})`);
  }

  // Also write preview artifact
  const artifactDir = 'C:/Users/Rakshith/.gemini/antigravity/brain/54357793-1034-48f8-9da5-8eea2ab067b5';
  await sharp(splashPath)
    .extract({ left: Math.max(0, logoLeft - 50), top: Math.max(0, logoTop - 50), width: 900, height: totalHeight + 100 })
    .toFile(path.join(artifactDir, 'splash_preview_previous_color.png'));
  console.log('Saved preview to splash_preview_previous_color.png');
}

main().catch(console.error);
