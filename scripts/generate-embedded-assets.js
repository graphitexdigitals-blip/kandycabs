const fs = require('fs');
const path = require('path');

const imgDir = path.resolve(__dirname, '../apps/driver-app/assets/images');

function toBase64(filename, mime) {
  const filePath = path.join(imgDir, filename);
  const buf = fs.readFileSync(filePath);
  return 'data:' + mime + ';base64,' + buf.toString('base64');
}

const captainAvatar = toBase64('captain-avatar.png', 'image/png');
const heroBanner = toBase64('hero-banner-innova-clean.jpg', 'image/jpeg');
const heroDriverCard = toBase64('hero-driver-card-navy-2x.png', 'image/png');
const fleetSedan = toBase64('fleet-sedan.png', 'image/png');
const fleetCrysta = toBase64('fleet-crysta.png', 'image/png');
const fleetSuv = toBase64('fleet-suv.png', 'image/png');
const fleetHatchback = toBase64('fleet-hatchback.png', 'image/png');
const fleetTraveller = toBase64('fleet-traveller.png', 'image/png');

const lines = [
  '// Auto-generated embedded base64 assets for standalone reliability without resources.arsc dependency',
  `export const CAPTAIN_AVATAR_BASE64 = '${captainAvatar}';`,
  `export const HERO_BANNER_INNOVA_BASE64 = '${heroBanner}';`,
  `export const HERO_DRIVER_CARD_BASE64 = '${heroDriverCard}';`,
  `export const FLEET_SEDAN_BASE64 = '${fleetSedan}';`,
  `export const FLEET_CRYSTA_BASE64 = '${fleetCrysta}';`,
  `export const FLEET_SUV_BASE64 = '${fleetSuv}';`,
  `export const FLEET_HATCHBACK_BASE64 = '${fleetHatchback}';`,
  `export const FLEET_TRAVELLER_BASE64 = '${fleetTraveller}';`,
  '',
  'export function getEmbeddedFleetImage(categoryStr?: string, modelStr?: string): string {',
  '  const cat = (categoryStr || "").toUpperCase();',
  '  const mod = (modelStr || "").toUpperCase();',
  '  if (cat.includes("CRYSTA") || mod.includes("CRYSTA") || mod.includes("INNOVA")) {',
  '    return FLEET_CRYSTA_BASE64;',
  '  }',
  '  if (cat.includes("SUV") || mod.includes("ERTIGA") || mod.includes("XL6")) {',
  '    return FLEET_SUV_BASE64;',
  '  }',
  '  if (cat.includes("TRAVELLER") || cat.includes("TEMPO")) {',
  '    return FLEET_TRAVELLER_BASE64;',
  '  }',
  '  if (cat.includes("HATCHBACK") || mod.includes("WAGON") || mod.includes("SWIFT") || mod.includes("I10")) {',
  '    return FLEET_HATCHBACK_BASE64;',
  '  }',
  '  return FLEET_SEDAN_BASE64;',
  '}',
  '',
];

const targetPath = path.resolve(__dirname, '../apps/driver-app/assets/embeddedAssets.ts');
fs.writeFileSync(targetPath, lines.join('\n'), 'utf8');
console.log('Successfully written embeddedAssets.ts, file size:', fs.statSync(targetPath).size);

