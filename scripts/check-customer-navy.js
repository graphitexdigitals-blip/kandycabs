const fs = require('fs');
const buf = fs.readFileSync('dist_apk/kandy-cabs-customer.apk');
const patNavy = Buffer.from([0x08, 0x00, 0x00, 0x1D, 0x43, 0x26, 0x01, 0xFF]);
const idx = buf.indexOf(patNavy);
console.log('Customer APK navy pattern offset:', idx);
