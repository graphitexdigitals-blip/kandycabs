const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const adb = 'C:\\Users\\Rakshith\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const fileName = process.argv[2] || `screen_${Date.now()}.png`;
const targetFile = path.join('C:\\Users\\Rakshith\\.gemini\\antigravity\\brain\\54357793-1034-48f8-9da5-8eea2ab067b5\\.user_uploaded', fileName);

try {
  const buf = execSync(`"${adb}" -s emulator-5554 exec-out screencap -p`, { maxBuffer: 10 * 1024 * 1024 });
  fs.writeFileSync(targetFile, buf);
  console.log(`Saved screenshot to ${targetFile} (${buf.length} bytes)`);
} catch (err) {
  console.error('Failed to capture:', err);
}

