const http = require('http');
const fs = require('fs');
const path = require('path');

const apkPath = path.join(__dirname, '..', 'kandy-cabs-driver.apk');
const pdfPath = path.join(__dirname, '..', 'kandy-cabs-terms-and-conditions.pdf');

const server = http.createServer((req, res) => {
  if (req.url === '/download' || req.url === '/kandy-cabs-driver.apk') {
    if (!fs.existsSync(apkPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('APK not found');
      return;
    }
    const stat = fs.statSync(apkPath);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="kandy-cabs-driver.apk"'
    });
    fs.createReadStream(apkPath).pipe(res);
  } else if (req.url === '/terms' || req.url === '/terms.pdf' || req.url === '/kandy-cabs-terms-and-conditions.pdf') {
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
    fs.createReadStream(pdfPath).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kandy Cabs Downloads &amp; Policies</title>
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
            .btn-secondary { background: #1e293b; color: #38bdf8; border: 1px solid #0284c7; box-shadow: none; }
            .btn-secondary:hover { background: #0f172a; color: #7dd3fc; }
            .meta { margin-top: 18px; font-size: 12px; color: #64748b; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">&#10003; Verified &amp; Generated</div>
            <h1>KANDY <span>CABS</span></h1>
            <p style="color: #cbd5e1; font-weight: 600; margin-bottom: 4px;">Partner App &amp; Customer Policy Documentation</p>
            <p>Official release artifacts and multilingual Terms &amp; Conditions.</p>
            
            <a href="/terms.pdf" target="_blank" class="btn btn-secondary">&#128196; View Terms &amp; Conditions PDF (3 Languages)</a>
            <a href="/kandy-cabs-driver.apk" class="btn">&#11015;&#65039; Download Driver APK (~87 MB)</a>
            
            <div class="meta">
              Languages in PDF: English &bull; &#3221;&#3240;&#3277;&#3240;&#3233; (Kannada) &bull; &#2361;&#2367;&#2344;&#2367;&#2342;&#2368; (Hindi)<br>
              File: kandy-cabs-terms-and-conditions.pdf
            </div>
          </div>
        </body>
      </html>
    `);
  }
});

server.listen(8082, '0.0.0.0', () => {
  console.log('APK download server ready on port 8082');
});

