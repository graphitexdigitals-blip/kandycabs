const sharp = require('sharp');

async function inspectCustomerMonogram() {
  const p = 'apps/customer-app/assets/images/customer_monogram_trimmed.png';
  const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
  console.log('Customer monogram dims:', info.width, info.height);
  for (let y = 0; y < info.height; y += 15) {
    let row = '';
    for (let x = 0; x < info.width; x += 8) {
      const idx = (y * info.width + x) * info.channels;
      const a = data[idx+3];
      row += a > 200 ? '█' : (a > 50 ? '▒' : ' ');
    }
    console.log(row);
  }
}
inspectCustomerMonogram();
