const cp = require('child_process');
const sharp = require('sharp');
const fs = require('fs');

async function run() {
  const buf = cp.execSync('tar -xOf dist_apk/kandy-cabs-customer.apk res/as.png'); // 432x432
  fs.writeFileSync('apps/driver-app/assets/images/customer_apk_as.png', buf);
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  console.log('as.png dims:', info.width, info.height);
  let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      if (data[idx] > 240 && data[idx+1] > 240 && data[idx+2] > 240) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log('White pixels bounds in customer as.png:', { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 });
}
run();
