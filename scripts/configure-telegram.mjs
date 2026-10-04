import fs from 'node:fs';
import path from 'node:path';

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const appUrl = (process.env.TELEGRAM_WEBAPP_URL || process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const webAppUrl = appUrl ? `${appUrl}/?v=aura-2026-10-04-1` : '';

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

try {
  await setProfilePhoto();
} catch (error) {
  console.warn('Telegram profile photo update skipped:', error instanceof Error ? error.message : error);
}

await telegram('setWebhook', {
  url: `${appUrl}/api/telegram/webhook`,
  ...(secret ? { secret_token: secret } : {}),
  allowed_updates: ['message', 'callback_query'],
  drop_pending_updates: false,
});

await telegram('setMyName', { name: 'AURA Vault' });
await telegram('setMyShortDescription', { short_description: 'Digital art, NFTs, and secure P2P exchange.' });
await telegram('setMyDescription', { description: 'AURA Vault is a selective digital art community and secure P2P exchange. Collect, create, trade, and manage digital assets from one Mini App.' });
await telegram('setMyCommands', { commands: [
  { command: 'start', description: 'Open AURA Vault' },
  { command: 'app', description: 'Launch the AURA Mini App' },
  { command: 'help', description: 'Show AURA help' },
]});
await telegram('setChatMenuButton', {
  menu_button: { type: 'web_app', text: 'Open AURA', web_app: { url: webAppUrl } },
});
console.log('Telegram @myaura1_bot configured for', appUrl);
