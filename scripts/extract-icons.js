const sharp = require('sharp');
const fs = require('fs');

async function findOrangeIcons() {
  const { data, info } = await sharp('emulator_home_screenshot.png').raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  
  const orangePixels = [];
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const idx = (y * w + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (r > 230 && g > 55 && g < 100 && b < 30) {
        orangePixels.push({ x, y });
      }
    }
  }
  console.log('Total orange sample pixels found:', orangePixels.length);
  if (orangePixels.length > 0) {
    const clusters = [];
    for (const p of orangePixels) {
      let matched = clusters.find(c => Math.hypot(c.cx - p.x, c.cy - p.y) < 120);
      if (matched) {
        matched.pts.push(p);
        matched.minX = Math.min(matched.minX, p.x);
        matched.maxX = Math.max(matched.maxX, p.x);
        matched.minY = Math.min(matched.minY, p.y);
        matched.maxY = Math.max(matched.maxY, p.y);
        matched.cx = (matched.minX + matched.maxX) / 2;
        matched.cy = (matched.minY + matched.maxY) / 2;
      } else {
        clusters.push({ minX: p.x, maxX: p.x, minY: p.y, maxY: p.y, cx: p.x, cy: p.y, pts: [p] });
      }
    }
    
    const iconClusters = clusters.filter(c => c.pts.length > 30);
    console.log('Detected icon clusters:', iconClusters.length);
    for (let i = 0; i < iconClusters.length; i++) {
      const c = iconClusters[i];
      const cropW = Math.min(w - c.minX, (c.maxX - c.minX) + 40);
      const cropH = Math.min(h - c.minY, (c.maxY - c.minY) + 40);
      const cropX = Math.max(0, c.minX - 20);
      const cropY = Math.max(0, c.minY - 20);
      const iconCrop = await sharp('emulator_home_screenshot.png')
        .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
        .png()
        .toBuffer();
      const p = `C:/Users/Rakshith/.gemini/antigravity/brain/54357793-1034-48f8-9da5-8eea2ab067b5/emulator_icon_${i+1}.png`;
      fs.writeFileSync(p, iconCrop);
      console.log(`Saved cluster ${i+1} to ${p}`);
    }
  }
}
findOrangeIcons();
