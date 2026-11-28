const sharp = require('sharp');
const path = require('path');

async function testCircleFit() {
  const root = path.join(__dirname, '..');
  const input = path.join(root, 'apps', 'customer-app', 'android', 'app', 'src', 'main', 'res', 'drawable-xxxhdpi', 'splashscreen_image.png');
  const meta = await sharp(input).metadata();
  const canvasSize = 1200;
  
  // Scale lockup to comfortably fit inside the circular safe zone (r=450px)
  const lockupW = 660;
  const lockupH = Math.round(lockupW * (meta.height / meta.width));
  const resized = await sharp(input).resize(lockupW, lockupH).toBuffer();
  const left = Math.round((canvasSize - lockupW) / 2);
  const top = Math.round((canvasSize - lockupH) / 2);

  const circleSvg = '<svg width="1200" height="1200"><circle cx="600" cy="600" r="450" fill="none" stroke="#22c55e" stroke-width="6" stroke-dasharray="12,12"/></svg>';

  const previewPath = 'C:/Users/Rakshith/.gemini/antigravity/brain/54357793-1034-48f8-9da5-8eea2ab067b5/splash_android12_circle_preview.png';
  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .composite([
    { input: resized, top, left },
    { input: Buffer.from(circleSvg), top: 0, left: 0 }
  ])
  .png()
  .toFile(previewPath);

  console.log('Saved preview with circle mask to:', previewPath);
}

testCircleFit().catch(console.error);
