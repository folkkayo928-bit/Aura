import fs from 'node:fs';
import path from 'node:path';

const appUrl = (
  process.env.PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  'https://aura-8bom.onrender.com'
).replace(/\/$/, '');

if (!/^https:\/\//i.test(appUrl)) {
  throw new Error('TON Connect requires the public AURA app URL to use HTTPS.');
}

const assetsDir = path.resolve('assets');
const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });

const encodedIconPath = path.join(assetsDir, 'aura-tonconnect-icon.png.b64');
const iconPath = path.join(publicDir, 'aura-tonconnect-icon.png');
const encodedIcon = fs.readFileSync(encodedIconPath, 'utf8').trim();
const iconBytes = Buffer.from(encodedIcon, 'base64');
if (iconBytes.length < 100 || iconBytes.readUInt32BE(0) !== 0x89504e47) {
  throw new Error('TON Connect app icon is not a valid PNG.');
}
fs.writeFileSync(iconPath, iconBytes);

const manifest = {
  url: appUrl,
  name: 'AURA',
  iconUrl: appUrl + '/aura-tonconnect-icon.png',
};
fs.writeFileSync(
  path.join(publicDir, 'tonconnect-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log('TON Connect manifest and PNG icon prepared for ' + appUrl);
