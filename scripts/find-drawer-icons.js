const sharp = require('sharp');
const fs = require('fs');

async function findIconsInDrawer() {
  const { data, info } = await sharp('emulator_drawer_screenshot.png').raw().toBuffer({ resolveWithObject: true });
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
  console.log('Total orange pixels found in drawer:', orangePixels.length);
  const clusters = [];
  for (const p of orangePixels) {
    let matched = clusters.find(c => Math.hypot(c.cx - p.x, c.cy - p.y) < 100);
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
  console.log('Detected icon clusters in drawer:', iconClusters.length);
  for (let i = 0; i < iconClusters.length; i++) {
    const c = iconClusters[i];
    const cropW = Math.min(w - c.minX, (c.maxX - c.minX) + 40);
    const cropH = Math.min(h - c.minY, (c.maxY - c.minY) + 40);
    const cropX = Math.max(0, c.minX - 20);
    const cropY = Math.max(0, c.minY - 20);
    const iconCrop = await sharp('emulator_drawer_screenshot.png')
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .png()
      .toBuffer();
    const p = 'C:/Users/Rakshith/.gemini/antigravity/brain/54357793-1034-48f8-9da5-8eea2ab067b5/drawer_icon_' + (i+1) + '.png';
    fs.writeFileSync(p, iconCrop);
    console.log('Saved drawer cluster ' + (i+1) + ' to ' + p + ', center: (' + Math.round(c.cx) + ', ' + Math.round(c.cy) + ')');

    const { data: cData, info: cInfo } = await sharp(iconCrop).raw().toBuffer({ resolveWithObject: true });
    let minWx = cInfo.width, maxWx = 0, minWy = cInfo.height, maxWy = 0;
    for (let cy = 0; cy < cInfo.height; cy++) {
      for (let cx = 0; cx < cInfo.width; cx++) {
        const cIdx = (cy * cInfo.width + cx) * cInfo.channels;
        if (cData[cIdx] > 240 && cData[cIdx+1] > 240 && cData[cIdx+2] > 240) {
          if (cx < minWx) minWx = cx;
          if (cx > maxWx) maxWx = cx;
          if (cy < minWy) minWy = cy;
          if (cy > maxWy) maxWy = cy;
        }
      }
    }
    const monoW = maxWx - minWx + 1;
    const monoH = maxWy - minWy + 1;
    console.log('Cluster ' + (i+1) + ' white dimensions: ' + monoW + ' x ' + monoH + ', left margin: ' + minWx + 'px, right margin: ' + (cInfo.width - 1 - maxWx) + 'px');
  }
}
findIconsInDrawer();
