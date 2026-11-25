const fs = require('fs');
const cp = require('child_process');
const aapt = 'C:\\Users\\Rakshith\\AppData\\Local\\Android\\Sdk\\build-tools\\34.0.0\\aapt.exe';

const apks = [
  'kandy-cabs-driver.apk',
  'kandy-cabs-customer.apk',
  'apps/web/public/kandy-cabs-driver.apk',
  'apps/web/public/kandy-cabs-customer.apk',
  'dist_apk/kandy-cabs-driver.apk',
  'dist_apk/kandy-cabs-customer.apk'
];

apks.forEach(apk => {
  if (!fs.existsSync(apk)) {
    console.log(apk, 'DOES NOT EXIST');
    return;
  }
  try {
    const out = cp.execSync(`"${aapt}" dump badging "${apk}"`).toString();
    const pkg = out.match(/package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/);
    const icon = out.match(/application: [^\n]*icon='([^']+)'/);
    console.log(apk, '->', pkg ? pkg[0] : 'no pkg', 'icon:', icon ? icon[1] : 'no icon');
  } catch(e) {
    console.log(apk, 'ERROR:', e.message);
  }
});
