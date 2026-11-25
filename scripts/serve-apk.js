const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const driverApkPath = path.join(root, 'kandy-cabs-driver.apk');
const customerApkPath = path.join(root, 'kandy-cabs-customer.apk');
const pdfPath = path.join(root, 'kandy-cabs-terms-and-conditions.pdf');

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Helper for CORS & headers
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url === '/customer' || url === '/customer-apk' || url === '/kandy-cabs-customer.apk' || url === '/kandycabs-customer.apk' || url === '/customer.apk') {
    if (!fs.existsSync(customerApkPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Customer APK not found');
      return;
    }
    const stat = fs.statSync(customerApkPath);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="kandy-cabs-customer.apk"'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(customerApkPath).pipe(res);
  } else if (url === '/download' || url === '/driver' || url === '/driver-apk' || url === '/kandy-cabs-driver.apk' || url === '/kandycabs-driver.apk' || url === '/driver.apk') {
    if (!fs.existsSync(driverApkPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Driver APK not found');
      return;
    }
    const stat = fs.statSync(driverApkPath);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="kandy-cabs-driver.apk"'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(driverApkPath).pipe(res);
  } else if (url === '/terms' || url === '/terms.pdf' || url === '/kandy-cabs-terms-and-conditions.pdf') {
    if (!fs.existsSync(pdfPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('PDF not found');
      return;
    }
    const stat = fs.statSync(pdfPath);
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': stat.size,
      'Content-Disposition': 'inline; filename="kandy-cabs-terms-and-conditions.pdf"'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(pdfPath).pipe(res);
  } else {
    const customerSizeMb = fs.existsSync(customerApkPath) ? (fs.statSync(customerApkPath).size / (1024 * 1024)).toFixed(1) : '44.1';
    const driverSizeMb = fs.existsSync(driverApkPath) ? (fs.statSync(driverApkPath).size / (1024 * 1024)).toFixed(1) : '44.7';

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kandy Cabs Mobile Download Center</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            body { background: #0b1329; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
            .card { background: #132247; border: 1px solid #1e3a8a; border-radius: 24px; max-width: 480px; width: 100%; padding: 36px 26px; text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,0.6); }
            .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid #22c55e; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: bold; margin-bottom: 20px; }
            h1 { font-size: 26px; font-weight: 800; color: #ffffff; margin-bottom: 6px; letter-spacing: 0.5px; }
            h1 span { color: #FA4F01; }
            .subtitle { color: #cbd5e1; font-weight: 600; font-size: 15px; margin-bottom: 6px; }
            p { color: #94a3b8; font-size: 13.5px; line-height: 1.5; margin-bottom: 24px; }
            .download-box { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
            .btn { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 16px 20px; border-radius: 16px; font-size: 15px; font-weight: bold; text-decoration: none; transition: transform 0.15s, opacity 0.15s; }
            .btn:active { transform: scale(0.98); }
            .btn-customer { background: linear-gradient(135deg, #FA4F01 0%, #ea580c 100%); color: #ffffff; box-shadow: 0 6px 20px rgba(250, 79, 1, 0.4); }
            .btn-driver { background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color: #ffffff; box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4); }
            .btn-admin { background: #1e293b; color: #38bdf8; border: 1px solid #0284c7; box-shadow: none; justify-content: center; }
            .btn-admin:hover { background: #0f172a; color: #7dd3fc; }
            .btn-title { display: flex; flex-direction: column; text-align: left; }
            .btn-title span:first-child { font-size: 16px; font-weight: 800; }
            .btn-title span:last-child { font-size: 12px; opacity: 0.85; font-weight: 500; }
            .btn-icon { font-size: 22px; }
            .instructions { background: #0f172a; border-radius: 14px; padding: 16px; text-align: left; font-size: 12.5px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px; border: 1px solid #1e293b; }
            .instructions strong { color: #f1f5f9; }
            .instructions ol { padding-left: 18px; }
            .instructions li { margin-bottom: 6px; }
            .meta { font-size: 12px; color: #64748b; line-height: 1.6; }
            .meta span { color: #38bdf8; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">&#10003; Live Local Server &amp; APKs Ready</div>
            <h1>KANDY <span>CABS</span></h1>
            <div class="subtitle">Mobile Installation &amp; Admin Hub</div>
            <p>Download the latest APK builds directly to your phone. Ensure your phone is connected to the same Wi-Fi network.</p>

            <div class="download-box">
              <a href="/kandy-cabs-customer.apk" class="btn btn-customer">
                <div class="btn-title">
                  <span>Download Customer App APK</span>
                  <span>v1.1.0 (Build 32) &bull; ${customerSizeMb} MB</span>
                </div>
                <div class="btn-icon">&#11015;&#65039;</div>
              </a>

              <a href="/kandy-cabs-driver.apk" class="btn btn-driver">
                <div class="btn-title">
                  <span>Download Driver App APK</span>
                  <span>v1.0.20 (Build 33 - New Icon) &bull; ${driverSizeMb} MB</span>
                </div>
                <div class="btn-icon">&#11015;&#65039;</div>
              </a>

              <a href="http://192.168.1.3:3001/admin" target="_blank" class="btn btn-admin">
                <span>&#128187; Open Admin Panel (Port 3001)</span>
              </a>
            </div>

            <div class="instructions">
              <strong>Quick Android Installation Guide:</strong>
              <ol>
                <li>Tap the download button above on your Android phone.</li>
                <li>When download finishes, tap the downloaded APK in notifications.</li>
                <li>If prompted, tap <strong>Settings &rarr; Allow from this source</strong> to install.</li>
                <li>Launch the app! It is pre-configured to connect to local server at <strong>http://192.168.1.3:3001</strong>.</li>
              </ol>
            </div>

            <div class="meta">
              Wi-Fi Host: <span>192.168.1.3</span><br>
              Backend API &amp; Admin: <span>http://192.168.1.3:3001</span><br>
              Web Portal: <span>http://192.168.1.3:3000</span>
            </div>
          </div>
        </body>
      </html>
    `);
  }
});

server.listen(8082, '0.0.0.0', () => {
  console.log('APK download portal running on http://0.0.0.0:8082');
});
