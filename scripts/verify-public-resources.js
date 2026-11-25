const cp = require('child_process');
const aapt = 'C:\\Users\\Rakshith\\AppData\\Local\\Android\\Sdk\\build-tools\\34.0.0\\aapt.exe';

const out = cp.execSync(`"${aapt}" dump resources apps/web/public/kandy-cabs-driver.apk`, { maxBuffer: 50 * 1024 * 1024 }).toString();
let idx = 0;
while ((idx = out.indexOf('0x7f060070', idx + 1)) !== -1) {
  console.log(out.substring(idx - 15, idx + 100));
}
