const { execSync } = require('child_process');

const adb = 'C:\\Users\\Rakshith\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';

try {
  execSync(`"${adb}" -s emulator-5554 logcat -c`);
  console.log('Logcat cleared.');
  const startOut = execSync(`"${adb}" -s emulator-5554 shell am start -n com.kandycabs.customer/.MainActivity`).toString();
  console.log('Start output:', startOut);
  
  // sleep 2.5s
  const end = Date.now() + 2500;
  while (Date.now() < end) {}

  const logs = execSync(`"${adb}" -s emulator-5554 logcat -d -s AndroidRuntime:E ReactNative:E ReactNativeJS:*`).toString();
  console.log('Logs:\n', logs);
} catch (e) {
  console.error(e.message);
  if (e.stdout) console.log('stdout:', e.stdout.toString());
  if (e.stderr) console.log('stderr:', e.stderr.toString());
}
