const http = require('http');
const fs = require('fs');
const path = require('path');

const driverApkPath = path.join(__dirname, '..', 'kandy-cabs-driver.apk');
const customerApkPath = path.join(__dirname, '..', 'kandy-cabs-customer.apk');
const pdfPath = path.join(__dirname, '..', 'kandy-cabs-terms-and-conditions.pdf');

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/customer' || url === '/customer-apk' || url === '/kandy-cabs-customer.apk' || url === '/customer.apk') {
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
  } else if (url === '/download' || url === '/driver' || url === '/driver-apk' || url === '/kandy-cabs-driver.apk' || url === '/driver.apk') {
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
    const customerSizeMb = fs.existsSync(customerApkPath) ? Math.round(fs.statSync(customerApkPath).size / (1024 * 1024)) : 0;
    const driverSizeMb = fs.existsSync(driverApkPath) ? Math.round(fs.statSync(driverApkPath).size / (1024 * 1024)) : 0;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kandy Cabs Downloads</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            body { background: #0b1329; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
            .card { background: #132247; border: 1px solid #1e3a8a; border-radius: 20px; max-width: 440px; width: 100%; padding: 32px 24px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .badge { display: inline-block; background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid #22c55e; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 16px; }
            h1 { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 6px; letter-spacing: 0.5px; }
            h1 span { color: #ea580c; }
            p { color: #94a3b8; font-size: 13.5px; line-height: 1.5; margin-bottom: 20px; }
            .btn { display: block; width: 100%; background: #ea580c; color: #ffffff; padding: 14px 20px; border-radius: 12px; font-size: 15px; font-weight: bold; text-decoration: none; transition: 0.2s; box-shadow: 0 4px 16px rgba(234, 88, 12, 0.4); margin-bottom: 12px; }
            .btn:hover { background: #c2410c; }
            .btn-customer { background: #2563eb; box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4); }
            .btn-customer:hover { background: #1d4ed8; }
            .btn-secondary { background: #1e293b; color: #38bdf8; border: 1px solid #0284c7; box-shadow: none; }
            .btn-secondary:hover { background: #0f172a; color: #7dd3fc; }
            .meta { margin-top: 18px; font-size: 12px; color: #64748b; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">&#10003; Updated &amp; Ready</div>
            <h1>KANDY <span>CABS</span></h1>
            <p style="color: #cbd5e1; font-weight: 600; margin-bottom: 4px;">Direct Android APK Download</p>
            <p>Download and install latest APK directly to your phone.</p>
            
            <a href="/kandy-cabs-customer.apk" class="btn btn-customer">&#11015;&#65039; Download Customer APK (${customerSizeMb || 95} MB)</a>
            <a href="/kandy-cabs-driver.apk" class="btn">&#11015;&#65039; Download Driver APK (${driverSizeMb || 87} MB)</a>
            <a href="/terms.pdf" target="_blank" class="btn btn-secondary">&#128196; View Terms &amp; Conditions PDF</a>
            
            <div class="meta">
              Package: com.kandycabs.customer<br>
              Production API: https://kandycabs-8kew.vercel.app
            </div>
          </div>
        </body>
      </html>
    `);
  }
});

server.listen(8082, '0.0.0.0', () => {
  console.log('APK download server running on http://0.0.0.0:8082');
});
