const sharp = require('sharp');
const fs = require('fs');

async function inspectGeometry() {
  const refPath = 'C:/Users/Rakshith/.gemini/antigravity/brain/54357793-1034-48f8-9da5-8eea2ab067b5/.user_uploaded/media_1795474657487_732e07fc.png';
  const { data, info } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  
  // Render ASCII art of the white letters
  console.log('--- ASCII Art of White KC ---');
  for (let y = 50; y < 165; y += 3) {
    let row = '';
    for (let x = 20; x < 190; x += 2) {
      const idx = (y * info.width + x) * info.channels;
      const b = data[idx+2];
      row += b > 200 ? '█' : (b > 80 ? '▒' : ' ');
    }
    console.log(row);
  }
}
inspectGeometry();
