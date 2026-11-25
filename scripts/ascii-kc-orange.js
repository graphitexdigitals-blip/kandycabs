const sharp = require('sharp');

async function inspectKcOrange() {
  const p = 'apps/driver-app/assets/images/kc_orange_only.png';
  const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
  console.log('kc_orange_only dims:', info.width, info.height);
  for (let y = 0; y < info.height; y += 10) {
    let row = '';
    for (let x = 0; x < info.width; x += 6) {
      const idx = (y * info.width + x) * info.channels;
      const a = data[idx+3];
      row += a > 200 ? '█' : (a > 50 ? '▒' : ' ');
    }
    console.log(row);
  }
}
inspectKcOrange();
