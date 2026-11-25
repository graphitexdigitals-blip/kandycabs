const sharp = require('sharp');
const fs = require('fs');

async function makeWhiteMonogram() {
  const src = 'apps/driver-app/assets/images/kc_orange_only.png';
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  
  // Create pure white with exact same alpha channel
  const whiteData = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < data.length; i += 4) {
    whiteData[i] = 255;     // R
    whiteData[i+1] = 255; // G
    whiteData[i+2] = 255; // B
    whiteData[i+3] = data[i+3]; // Alpha
  }
  
  const outPath = 'apps/driver-app/assets/images/kc_white_only.png';
  await sharp(whiteData, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(outPath);
    
  console.log('Saved pure white monogram to', outPath, 'dims:', info.width, info.height);
}
makeWhiteMonogram();
