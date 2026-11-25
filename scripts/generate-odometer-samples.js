const fs = require('fs');
const path = require('path');

const img1 = fs.readFileSync(path.join(__dirname, '../apps/driver-app/assets/images/odometer_sample_57612.jpg')).toString('base64');
const img2 = fs.readFileSync(path.join(__dirname, '../apps/driver-app/assets/images/odometer_sample_91308.jpg')).toString('base64');

const content = `// Auto-generated sample odometer images for testing and expo gallery
export const ODOMETER_SAMPLE_57612_BASE64 = 'data:image/jpeg;base64,${img1}';
export const ODOMETER_SAMPLE_91308_BASE64 = 'data:image/jpeg;base64,${img2}';

export const SAMPLE_ODOMETER_OPTIONS = [
  {
    id: 'sample_57612',
    reading: '57612',
    label: 'Sample 1 (57,612 km)',
    base64: ODOMETER_SAMPLE_57612_BASE64,
  },
  {
    id: 'sample_91308',
    reading: '91308',
    label: 'Sample 2 (91,308 km)',
    base64: ODOMETER_SAMPLE_91308_BASE64,
  },
];
`;

fs.writeFileSync(path.join(__dirname, '../apps/driver-app/assets/images/sampleOdometerBase64.ts'), content, 'utf8');
console.log('sampleOdometerBase64.ts created successfully!');
