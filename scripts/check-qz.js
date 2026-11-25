const cp = require('child_process');
const sharp = require('sharp');
const buf = cp.execSync('tar -xOf dist_apk/kandy-cabs-customer.apk res/QZ.png');
sharp(buf).raw().toBuffer({ resolveWithObject: true }).then(({ data, info }) => {
  console.log('Customer APK res/QZ.png: dims', info.width, info.height);
  const c = Math.floor(info.height/2) * info.width * 4 + Math.floor(info.width/2) * 4;
  console.log('Center:', data[c], data[c+1], data[c+2], data[c+3]);
  console.log('Corner:', data[0], data[1], data[2], data[3]);
});
