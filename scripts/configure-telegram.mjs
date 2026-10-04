import fs from 'node:fs';
import path from 'node:path';

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const appUrl = (process.env.TELEGRAM_WEBAPP_URL || process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

if (!token || !appUrl) {
  console.log('Telegram build setup skipped: TELEGRAM_BOT_TOKEN and PUBLIC_APP_URL/TELEGRAM_WEBAPP_URL are not configured.');
  process.exit(0);
}

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || 'Telegram API request failed');
  return data.result;
}

async function setProfilePhoto() {
  const encodedPath = path.resolve('assets/aura-bot-avatar.jpg.b64');
  if (!fs.existsSync(encodedPath)) return;
  const outputPath = path.resolve('public/aura-bot-avatar.jpg');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(fs.readFileSync(encodedPath, 'utf8').trim(), 'base64'));

  const form = new FormData();
  form.append('photo', JSON.stringify({ type: 'static', photo: 'attach://aura_profile_photo' }));
  form.append('aura_profile_photo', new Blob([fs.readFileSync(outputPath)], { type: 'image/jpeg' }), 'aura-bot-avatar.jpg');

  const response = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, { method: 'POST', body: form });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || 'Telegram profile photo update failed');
  console.log('Telegram bot profile photo updated.');
}

async function telegramLegacy(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || 'Telegram API request failed');
  return data.result;
}