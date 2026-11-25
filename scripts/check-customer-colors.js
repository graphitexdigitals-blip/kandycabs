const fs = require('fs');
const path = require('path');

const appDir = 'apps/customer-app/app';
fs.readdirSync(appDir).forEach(f => {
  if (f.endsWith('.tsx')) {
    const code = fs.readFileSync(path.join(appDir, f), 'utf8');
    const matches = code.match(/backgroundColor\s*[:=]\s*['"][#a-zA-Z0-9(),\s]+['"]/g);
    if (matches) {
      const darkBlues = matches.filter(m => m.includes('011') || m.includes('0B1') || m.includes('001') || m.includes('162') || m.includes('0f172a'));
      if (darkBlues.length > 0) {
        console.log(f, darkBlues);
      }
    }
  }
});
