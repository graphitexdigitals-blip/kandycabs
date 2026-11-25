const qrcode = require('qrcode-terminal');

const ip = '192.168.1.3';
const portalUrl = `http://${ip}:8082`;
const adminUrl = `http://${ip}:3001/admin`;
const customerApk = `http://${ip}:8082/kandy-cabs-customer.apk`;
const driverApk = `http://${ip}:8082/kandy-cabs-driver.apk`;

console.log('================================================================');
console.log('📱 SCAN WITH PHONE TO OPEN MOBILE DOWNLOAD PORTAL:');
console.log(`URL: ${portalUrl}`);
console.log('================================================================');
qrcode.generate(portalUrl, { small: true });

console.log('================================================================');
console.log('⚡ DIRECT DOWNLOAD LINKS FOR MOBILE PHONE BROWSER:');
console.log(`Customer App: ${customerApk}`);
console.log(`Driver App:   ${driverApk}`);
console.log(`Admin Panel:  ${adminUrl}`);
console.log('================================================================');
