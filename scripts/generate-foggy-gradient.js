const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function createHorizontalFogGradientPNG(width, height, getAlpha) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);

  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const t = x / (width - 1);
      const alpha = Math.round(Math.max(0, Math.min(1, getAlpha(t))) * 255);
      const offset = 1 + x * 4;
      row[offset] = 255;
      row[offset + 1] = 255;
      row[offset + 2] = 255;
      row[offset + 3] = alpha;
    }
    rawRows.push(row);
  }

  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

// 256 texel gradient: continuous bi-linear interpolation on mobile GPU
// Opacity curve:
// t=0: 0.72 (scenery clearly visible through the fog)
// t=0.28: 0.60
// t=0.50: 0.30
// t=0.68: 0.05
// t>=0.72: 0.00
const png = createHorizontalFogGradientPNG(256, 1, (t) => {
  if (t < 0.28) {
    const k = t / 0.28;
    return 0.72 - 0.12 * (k * k);
  } else if (t < 0.72) {
    const k = (t - 0.28) / (0.72 - 0.28);
    return 0.60 * (0.5 + 0.5 * Math.cos(k * Math.PI));
  } else {
    return 0;
  }
});

const base64 = 'data:image/png;base64,' + png.toString('base64');
const tsContent = `// Continuous 256x1 horizontal gradient PNG for hardware bi-linear interpolation
// Eliminates all vertical banding lines and creates translucent soft fog with visible background
export const FOGGY_OVERLAY_GRADIENT_BASE64 = '${base64}';
`;

const outPath = path.join(__dirname, '..', 'apps', 'driver-app', 'assets', 'foggyGradient.ts');
fs.writeFileSync(outPath, tsContent, 'utf8');
console.log('Generated foggyGradient.ts successfully at', outPath);

