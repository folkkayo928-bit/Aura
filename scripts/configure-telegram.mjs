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

await telegram('setWebhook', { url: `${appUrl}/api/telegram/webhook`, ...(secret ? { secret_token: secret } : {}), allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
await telegram('setMyCommands', { commands: [
  { command: 'start', description: 'Open AURA Vault' },
  { command: 'app', description: 'Launch the AURA Mini App' },
  { command: 'help', description: 'Show AURA help' },
]});
await telegram('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Open AURA', web_app: { url: appUrl } } });
console.log('Telegram @myaura1_bot configured for', appUrl);
