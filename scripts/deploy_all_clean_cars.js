const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const basePath = 'C:/Users/Rakshith/.gemini/antigravity/brain/54357793-1034-48f8-9da5-8eea2ab067b5/.user_uploaded/';

const cars = [
  {
    file: 'media_1793342992287_564600d6.jpg',
    name: 'carens',
    targets: ['fleet-carens.png', 'fleet-4-carens.png']
  },
  {
    file: 'media_1793343015154_7d2796ad.jpg',
    name: 'innova',
    targets: ['fleet-innova.png', 'fleet-4-innova.png']
  },
  {
    file: 'media_1793343018369_98bf34da.jpg',
    name: 'crysta',
    targets: ['fleet-crysta.png', 'fleet-4-crysta.png']
  },
  {
    file: 'media_1793343034332_29c48396.jpg',
    name: 'traveller',
    targets: ['fleet-traveller.png']
  },
  {
    file: 'media_1793343038577_98ac98a8.jpg',
    name: 'urbania',
    targets: ['fleet-urbania.png']
  }
];

async function processAndDeployCar(car) {
  console.log(`Processing ${car.name}...`);
  const { data, info } = await sharp(basePath + car.file).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  const r = 5;
  const isCbMap = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 3;
      const red = data[idx], grn = data[idx+1], blu = data[idx+2];
      const val = (red + grn + blu) / 3;
      const diff = Math.max(Math.abs(red - grn), Math.abs(grn - blu), Math.abs(red - blu));

      // Wheels / tires / dark shadows
      if (val < 78) continue;
      // White body / highlights
      if (val > 230) continue;
      // Saturated plates / lamps
      if (diff > 12) continue;

      let light = 0, dark = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const nidx = (ny * w + nx) * 3;
          const nr = data[nidx], ng = data[nidx+1], nb = data[nidx+2];
          const ndiff = Math.max(Math.abs(nr - ng), Math.abs(ng - nb), Math.abs(nr - nb));
          if (ndiff <= 14) {
            const nval = (nr + ng + nb) / 3;
            if (nval >= 180 && nval <= 225) light++;
            else if (nval >= 115 && nval <= 165) dark++;
          }
        }
      }

      if (light >= 18 && dark >= 18) {
        isCbMap[y * w + x] = 1;
      }
    }
  }

  // Flood fill from all 4 borders
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qHead = 0, qTail = 0;

  for (let x = 0; x < w; x++) {
    if (isCbMap[x]) { visited[x] = 1; queue[qTail++] = x; }
    const bot = (h - 1) * w + x;
    if (isCbMap[bot] && !visited[bot]) { visited[bot] = 1; queue[qTail++] = bot; }
  }
  for (let y = 0; y < h; y++) {
    const left = y * w;
    if (isCbMap[left] && !visited[left]) { visited[left] = 1; queue[qTail++] = left; }
    const right = y * w + (w - 1);
    if (isCbMap[right] && !visited[right]) { visited[right] = 1; queue[qTail++] = right; }
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % w;
    const cy = (curr / w) | 0;

    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx < w - 1 ? curr + 1 : -1,
      cy > 0 ? curr - w : -1,
      cy < h - 1 ? curr + w : -1
    ];

    for (let i = 0; i < 4; i++) {
      const n = neighbors[i];
      if (n >= 0 && !visited[n] && isCbMap[n]) {
        visited[n] = 1;
        queue[qTail++] = n;
      }
    }
  }

  // Expansion steps to smoothly clean up checkerboard edge pixels:
  // Strictly allow only checkerboard square values (val <= 218 && val >= 95 && diff <= 5)
  // NEVER encroaches into white car paint (val >= 225) or colored parts (diff > 5) or wheels (val < 90)
  const finalBgMask = new Uint8Array(visited);
  for (let step = 0; step < 7; step++) {
    const temp = new Uint8Array(finalBgMask);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (finalBgMask[i]) continue;
        if (finalBgMask[i - 1] || finalBgMask[i + 1] || finalBgMask[i - w] || finalBgMask[i + w]) {
          const idx = i * 3;
          const red = data[idx], grn = data[idx+1], blu = data[idx+2];
          const val = (red + grn + blu) / 3;
          const diff = Math.max(Math.abs(red - grn), Math.abs(grn - blu), Math.abs(red - blu));
          if (diff <= 5 && val <= 218 && val >= 95) {
            temp[i] = 1;
          }
        }
      }
    }
    finalBgMask.set(temp);
  }

  const carMask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    carMask[i] = finalBgMask[i] ? 0 : 1;
  }

  // Component filter: Keep all components >= 100 pixels
  const visitedComp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!carMask[idx] || visitedComp[idx]) continue;

      const comp = [idx];
      visitedComp[idx] = 1;
      let head = 0;
      while (head < comp.length) {
        const curr = comp[head++];
        const cx = curr % w;
        const cy = (curr / w) | 0;
        const neighbors = [
          cx > 0 ? curr - 1 : -1,
          cx < w - 1 ? curr + 1 : -1,
          cy > 0 ? curr - w : -1,
          cy < h - 1 ? curr + w : -1
        ];
        for (let i = 0; i < 4; i++) {
          const n = neighbors[i];
          if (n >= 0 && !visitedComp[n] && carMask[n]) {
            visitedComp[n] = 1;
            comp.push(n);
          }
        }
      }

      if (comp.length < 100) {
        for (const p of comp) carMask[p] = 0;
      }
    }
  }

  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = data[i * 3];
    out[i * 4 + 1] = data[i * 3 + 1];
    out[i * 4 + 2] = data[i * 3 + 2];
    out[i * 4 + 3] = carMask[i] ? 255 : 0;
  }

  const outBuf = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

  // Save white and blue previews for inspection
  await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
  .composite([{ input: outBuf }])
  .png()
  .toFile(`preview_${car.name}_white.png`);

  await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 102, b: 204, alpha: 1 } }
  })
  .composite([{ input: outBuf }])
  .png()
  .toFile(`preview_${car.name}_blue.png`);

  // Deploy across apps
  for (const t of car.targets) {
    // 1. customer app
    const custAppPath = path.join('apps/customer-app/assets/images', t);
    fs.writeFileSync(custAppPath, outBuf);
    console.log(`  Deployed to ${custAppPath}`);

    // dist_bundle drawable
    const drawableName = 'assets_images_' + t.replace(/-/g, '').replace('.png', '') + '.png';
    const distPath = path.join('apps/customer-app/dist_bundle/drawable-mdpi', drawableName);
    if (fs.existsSync(distPath)) {
      fs.writeFileSync(distPath, outBuf);
      console.log(`  Updated dist_bundle: ${distPath}`);
    }

    // 2. web app
    const webPath = path.join('apps/web/public/images', t);
    fs.writeFileSync(webPath, outBuf);
    const webpPath = webPath.replace('.png', '.webp');
    await sharp(outBuf).webp({ quality: 90 }).toFile(webpPath);
    console.log(`  Deployed to web: ${webPath} and ${webpPath}`);

    // 3. admin app
    const adminPath = path.join('apps/admin/public/images', t);
    if (fs.existsSync(path.dirname(adminPath))) {
      fs.writeFileSync(adminPath, outBuf);
      console.log(`  Deployed to admin: ${adminPath}`);
    }
  }

  console.log(`Finished ${car.name}.\n`);
}

(async () => {
  for (const c of cars) {
    await processAndDeployCar(c);
  }
  console.log('All 5 fleet cars successfully cut out and deployed!');
})();

