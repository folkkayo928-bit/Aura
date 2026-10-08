import express from 'express';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '64kb' }));

// Lightweight readiness endpoint for Render and uptime monitors.
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'aura', uptimeSeconds: Math.floor(process.uptime()) });
});

const PORT = Number(process.env.PORT || 8080);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const WEBAPP_URL = (process.env.TELEGRAM_WEBAPP_URL || PUBLIC_APP_URL).replace(/\/$/, '');
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const TELEGRAM_NOTIFY_SECRET = process.env.AURA_TELEGRAM_NOTIFY_SECRET || '';
const TELEGRAM_WELCOME_PHOTO_URL = WEBAPP_URL ? WEBAPP_URL + '/aura-bot-avatar.jpg?v=2' : '';
const TELEGRAM_WELCOME_PHOTO = (() => {
  try {
    const base64 = readFileSync(path.join(__dirname, 'assets', 'aura-bot-avatar.jpg.b64'), 'utf8').replace(/\\s+/g, '');
    return Buffer.from(base64, 'base64');
  } catch (error) {
    console.error('AURA welcome photo asset unavailable:', error?.message || String(error));
    return null;
  }
})();
const TELEGRAM_SUPPORT_URL = (process.env.AURA_SUPPORT_URL || '').trim();

async function telegram(method, body) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || 'Telegram API request failed');
  return data.result;
}

function validateInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) return null;
  params.delete('hash');

  const pairs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = pairs.map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (receivedHash.length !== calculatedHash.length ||
      !crypto.timingSafeEqual(Buffer.from(receivedHash), Buffer.from(calculatedHash))) return null;

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > 86400) return null;

  try {
    return {
      queryId: params.get('query_id') || null,
      user: JSON.parse(params.get('user') || 'null'),
      authDate,
    };
  } catch {
    return null;
  }
}

async function configureTelegram() {
  if (!BOT_TOKEN || !PUBLIC_APP_URL) {
    console.log('Telegram setup skipped: configure TELEGRAM_BOT_TOKEN and PUBLIC_APP_URL.');
    return;
  }

  const webhook = `${PUBLIC_APP_URL}/api/telegram/webhook`;
  await telegram('setWebhook', {
    url: webhook,
    ...(WEBHOOK_SECRET ? { secret_token: WEBHOOK_SECRET } : {}),
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  });

  await telegram('setMyCommands', {
    commands: [
      { command: 'start', description: 'Open AURA Vault' },
      { command: 'app', description: 'Launch the AURA Mini App' },
      { command: 'help', description: 'Show AURA help' },
    ],
  });

  if (WEBAPP_URL) {
    await telegram('setChatMenuButton', {
      menu_button: { type: 'web_app', text: 'Open AURA', web_app: { url: WEBAPP_URL } },
    });
  }

  console.log(`Telegram @myaura1_bot configured. Webhook: ${webhook}`);
}

app.get('/api/telegram/health', (_req, res) => {
  res.json({ ok: true, bot: '@myaura1_bot', configured: Boolean(BOT_TOKEN && WEBAPP_URL) });
});

app.get('/aura-bot-avatar.jpg', (_req, res) => {
  if (!TELEGRAM_WELCOME_PHOTO) return res.sendStatus(404);
  res.set('Cache-Control', 'public, max-age=86400, immutable');
  res.type('image/jpeg').send(TELEGRAM_WELCOME_PHOTO);
});

app.post('/api/telegram/auth', (req, res) => {
  const session = validateInitData(req.body?.initData);
  if (!session?.user) return res.status(401).json({ ok: false, error: 'Invalid Telegram initData' });
  return res.json({
    ok: true,
    user: {
      id: session.user.id,
      first_name: session.user.first_name || '',
      last_name: session.user.last_name || '',
      username: session.user.username || '',
      language_code: session.user.language_code || '',
    },
  });
});

app.post('/api/internal/telegram/drop-notify', async (req, res) => {
  if (!TELEGRAM_NOTIFY_SECRET || req.get('x-aura-telegram-notify-secret') !== TELEGRAM_NOTIFY_SECRET) {
    return res.sendStatus(403);
  }

  if (!BOT_TOKEN) return res.status(503).json({ ok: false, error: 'TELEGRAM_BOT_NOT_CONFIGURED' });

  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : [];
  if (!items.length) return res.json({ ok: true, sent: 0, failed: 0 });

  let sent = 0;
  let failed = 0;
  const sentIds = [];
  for (const item of items) {
    const chatId = String(item?.telegram_user_id || '').trim();
    const title = String(item?.title || '').trim();
    const message = String(item?.message || '').trim();
    if (!/^\d{1,20}$/.test(chatId) || !title || !message) {
      failed++;
      continue;
    }

    try {
      await telegram('sendMessage', {
        chat_id: chatId,
        text: `✨ AURA\n${title}\n\n${message}`,
        disable_web_page_preview: true,
      });
      sent++;
      if (item?.id) sentIds.push(String(item.id));
    } catch (error) {
      failed++;
      console.error('Telegram drop notification failed', { chatId, error: error?.message || String(error) });
    }
  }

  return res.json({ ok: true, sent, failed, sent_ids: sentIds });
});

app.post('/api/telegram/webhook', async (req, res) => {
  if (WEBHOOK_SECRET && req.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return res.sendStatus(403);
  }

  // Acknowledge Telegram immediately; process the small command set asynchronously.
  res.sendStatus(200);

  const message = req.body?.message;
  const chatId = message?.chat?.id;
  const text = String(message?.text || '').trim().toLowerCase();
  const callback = req.body?.callback_query;
  const callbackChatId = callback?.message?.chat?.id;
  if (callback?.data === 'aura_contact_us' && callbackChatId) {
    try {
      await telegram('answerCallbackQuery', { callback_query_id: callback.id, text: 'AURA Support' });
      await telegram('sendMessage', {
        chat_id: callbackChatId,
        text: '💬 AURA Support\\n\\nReply here and our team can assist you. A dedicated support link can also be configured for the Contact Us button.',
      });
    } catch (error) {
      console.error('Telegram contact callback error:', error);
    }
    return;
  }
  if (!chatId) return;

  try {
    if (text === '/start' || text.startsWith('/start ') || text === '/app') {
      const welcomeText = '✨ Welcome to AURA Vault.\\n\\nCollect, create, trade, and manage digital art from one secure Mini App.\\n\\nEnter the AURA community and explore the full platform.';
      const buttons = [];
      if (WEBAPP_URL) buttons.push({ text: '🚀 Open AURA', web_app: { url: WEBAPP_URL } });
      buttons.push(
        TELEGRAM_SUPPORT_URL
          ? { text: '💬 Contact Us', url: TELEGRAM_SUPPORT_URL }
          : { text: '💬 Contact Us', callback_data: 'aura_contact_us' },
      );

      if (TELEGRAM_WELCOME_PHOTO_URL) {
        await telegram('sendPhoto', {
          chat_id: chatId,
          photo: TELEGRAM_WELCOME_PHOTO_URL,
          caption: welcomeText,
          reply_markup: { inline_keyboard: [buttons] },
        });
      } else {
        await telegram('sendMessage', {
          chat_id: chatId,
          text: welcomeText,
          reply_markup: { inline_keyboard: [buttons] },
        });
      }
    } else if (text === '/help') {
      await telegram('sendMessage', {
        chat_id: chatId,
        text: 'AURA Vault commands:\n/start — open AURA\n/app — launch the Mini App\n/help — show this help',
      });
    }
  } catch (error) {
    console.error('Telegram webhook error:', error);
  }
});

const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, async () => {
  console.log(`AURA server listening on port ${PORT}`);
  try { await configureTelegram(); }
  catch (error) { console.error('Telegram configuration failed:', error); }
});
