const fs = require('fs');
const cp = require('child_process');
const { analyzeAndPatch } = require('./patch-version-code.js');

['dist_apk/kandy-cabs-driver.apk', 'dist_apk/kandy-cabs-customer.apk'].forEach(apk => {
  console.log('--- Testing ' + apk + ' ---');
  const buf = cp.execSync(`tar -xOf "${apk}" AndroidManifest.xml`);
  analyzeAndPatch(buf, 30);
});
