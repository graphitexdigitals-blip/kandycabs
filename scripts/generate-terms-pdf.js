const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../apps/customer-app/locales/en.json'), 'utf8')).termsScreen;
const kn = JSON.parse(fs.readFileSync(path.join(__dirname, '../apps/customer-app/locales/kn.json'), 'utf8')).termsScreen;
const hi = JSON.parse(fs.readFileSync(path.join(__dirname, '../apps/customer-app/locales/hi.json'), 'utf8')).termsScreen;

function renderLanguageSection(data, langCode, langBadge, langLabel) {
  const sectionsHtml = data.sections.map(sec => {
    let contentHtml = '';
    if (sec.body) {
      contentHtml += `<p class="section-body">${sec.body}</p>`;
    }
    if (sec.bullets && sec.bullets.length > 0) {
      contentHtml += `<ul class="bullets-list">
        ${sec.bullets.map(b => `<li>${b}</li>`).join('')}
      </ul>`;
    }

    return `
      <div class="section-card">
        <div class="section-header">
          <span class="num-pill">${String(sec.id).padStart(2, '0')}</span>
          <h3 class="section-title">${sec.title}</h3>
        </div>
        ${contentHtml}
      </div>
    `;
  }).join('');

  return `
    <div class="language-document">
      <div class="doc-header">
        <div class="brand-row">
          <div class="brand-title">KANDY <span class="highlight">CABS</span></div>
          <div class="lang-tag">${langBadge} &bull; ${langLabel}</div>
        </div>
        <h1 class="main-title">${data.headerTitle}</h1>
        <div class="sub-title">${data.headerSub}</div>
      </div>

      <div class="hero-banner">
        <div class="banner-top">
          <span class="badge-tag">${data.tagBadge}</span>
          <span class="badge-official">&#10004; ${data.official}</span>
        </div>
        <div class="hero-heading">${data.heroTitle}</div>
        <div class="hero-meta">${data.heroMeta}</div>
      </div>

      <div class="sections-container">
        ${sectionsHtml}
      </div>

      <div class="support-footer">
        <div class="support-title">${data.supportTitle}</div>
        <div class="support-text">${data.supportText}</div>
        <div class="footer-legal">&copy; 2026 Kandy Cabs Pvt. Ltd. All rights reserved. &bull; www.kandycabs.in</div>
      </div>
    </div>
  `;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kandy Cabs - Terms & Conditions (Customer Policy)</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans+Kannada:wght@400;500;600;700&display=swap');

    @page {
      size: A4;
      margin: 14mm 12mm 14mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', 'Noto Sans Kannada', 'Noto Sans Devanagari', 'Nirmala UI', system-ui, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 11pt;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }

    .cover-page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 90vh;
      text-align: center;
      padding: 40px 20px;
    }

    .cover-brand {
      font-size: 32pt;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #0b1329;
      margin-bottom: 8px;
    }

    .cover-brand span {
      color: #ea580c;
    }

    .cover-badge {
      display: inline-block;
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid #fdba74;
      padding: 4px 16px;
      border-radius: 20px;
      font-size: 10pt;
      font-weight: 700;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .cover-title {
      font-size: 24pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.3;
      margin-bottom: 12px;
      max-width: 550px;
    }

    .cover-subtitle {
      font-size: 13pt;
      color: #64748b;
      margin-bottom: 36px;
    }

    .cover-langs-box {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px 32px;
      max-width: 520px;
      width: 100%;
      text-align: left;
      margin-bottom: 36px;
    }

    .cover-langs-title {
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      font-weight: 700;
      margin-bottom: 14px;
    }

    .lang-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #edf2f7;
    }

    .lang-item:last-child {
      border-bottom: none;
    }

    .lang-item-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .lang-item-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #ffedd5;
      color: #c2410c;
      font-weight: 800;
      font-size: 11pt;
    }

    .lang-item-name {
      font-size: 12pt;
      font-weight: 700;
      color: #1e293b;
    }

    .lang-item-page {
      font-size: 10pt;
      color: #ea580c;
      font-weight: 600;
    }

    .cover-footer {
      font-size: 9.5pt;
      color: #94a3b8;
      margin-top: 20px;
    }

    .language-document {
      page-break-after: always;
      padding-top: 6px;
    }

    .language-document:last-child {
      page-break-after: avoid;
    }

    .doc-header {
      border-bottom: 2px solid #ea580c;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }

    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .brand-title {
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: 0.8px;
      color: #0b1329;
    }

    .brand-title .highlight {
      color: #ea580c;
    }

    .lang-tag {
      background: #0f172a;
      color: #ffffff;
      padding: 3px 12px;
      border-radius: 12px;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .main-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 4px;
    }

    .sub-title {
      font-size: 10.5pt;
      color: #64748b;
      font-weight: 500;
    }

    .hero-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #ea580c;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 18px;
    }

    .banner-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .badge-tag {
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: 0.8px;
      color: #ea580c;
      text-transform: uppercase;
    }

    .badge-official {
      background: #dcfce7;
      color: #15803d;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 7.5pt;
      font-weight: 700;
    }

    .hero-heading {
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 3px;
    }

    .hero-meta {
      font-size: 9pt;
      color: #64748b;
    }

    .sections-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .section-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      background: #ffffff;
      page-break-inside: avoid;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .num-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #eff6ff;
      color: #2563eb;
      font-weight: 800;
      font-size: 8.5pt;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      flex-shrink: 0;
    }

    .section-title {
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
    }

    .section-body {
      font-size: 9.5pt;
      color: #334155;
      line-height: 1.5;
    }

    .bullets-list {
      list-style-type: none;
      padding-left: 0;
      margin: 0;
    }

    .bullets-list li {
      position: relative;
      padding-left: 16px;
      margin-bottom: 6px;
      font-size: 9.3pt;
      color: #334155;
      line-height: 1.48;
    }

    .bullets-list li:last-child {
      margin-bottom: 0;
    }

    .bullets-list li::before {
      content: "•";
      position: absolute;
      left: 2px;
      top: -1px;
      color: #ea580c;
      font-size: 12pt;
      font-weight: bold;
    }

    .support-footer {
      margin-top: 20px;
      padding: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      text-align: center;
      page-break-inside: avoid;
    }

    .support-title {
      font-size: 10pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 3px;
    }

    .support-text {
      font-size: 9pt;
      color: #64748b;
      margin-bottom: 8px;
    }

    .footer-legal {
      font-size: 8pt;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
  </style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-badge">Official Policy Documentation</div>
    <div class="cover-brand">KANDY <span>CABS</span></div>
    <h1 class="cover-title">Customer Terms &amp; Conditions</h1>
    <p class="cover-subtitle">Complete Official Policy in 3 Supported Languages</p>

    <div class="cover-langs-box">
      <div class="cover-langs-title">Included Languages &bull; ಅಳವಡಿಸಲಾದ ಭಾಷೆಗಳು &bull; शामिल भाषाएं</div>
      
      <div class="lang-item">
        <div class="lang-item-left">
          <span class="lang-item-badge">EN</span>
          <div>
            <div class="lang-item-name">English</div>
            <div style="font-size: 8.5pt; color: #64748b;">Terms &amp; Conditions &bull; Customer Policy</div>
          </div>
        </div>
        <div class="lang-item-page">Part 1 &rarr;</div>
      </div>

      <div class="lang-item">
        <div class="lang-item-left">
          <span class="lang-item-badge">ಕ</span>
          <div>
            <div class="lang-item-name">ಕನ್ನಡ (Kannada)</div>
            <div style="font-size: 8.5pt; color: #64748b;">ನಿಯಮಗಳು ಮತ್ತು ಷರತ್ತುಗಳು &bull; ಗ್ರಾಹಕ ನೀತಿ</div>
          </div>
        </div>
        <div class="lang-item-page">Part 2 &rarr;</div>
      </div>

      <div class="lang-item">
        <div class="lang-item-left">
          <span class="lang-item-badge">हि</span>
          <div>
            <div class="lang-item-name">हिन्दी (Hindi)</div>
            <div style="font-size: 8.5pt; color: #64748b;">नियम और शर्तें &bull; ग्राहक नीति</div>
          </div>
        </div>
        <div class="lang-item-page">Part 3 &rarr;</div>
      </div>
    </div>

    <div class="cover-footer">
      Version: October 2026 &bull; Published by Kandy Cabs Pvt. Ltd. &bull; support@kandycabs.in
    </div>
  </div>

  <!-- Part 1: English -->
  ${renderLanguageSection(en, 'en', 'EN', 'English')}

  <!-- Part 2: Kannada -->
  ${renderLanguageSection(kn, 'kn', 'ಕನ್ನಡ', 'Kannada')}

  <!-- Part 3: Hindi -->
  ${renderLanguageSection(hi, 'hi', 'हिन्दी', 'Hindi')}

</body>
</html>
`;

const htmlPath = path.join(__dirname, 'terms-multilingual.html');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('HTML written to:', htmlPath);
