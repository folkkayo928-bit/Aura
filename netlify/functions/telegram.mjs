const crypto = await import('node:crypto');

function env(name) {
  return globalThis.Netlify?.env?.get(name) || process.env[name] || '';
}

async function telegram(method, body) {
  const token = env('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || 'Telegram API request failed');
  return data.result;
}

function validateInitData(initData, token) {
  if (!token || !initData) return null;
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) return null;
  params.delete('hash');
  const pairs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = pairs.map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (receivedHash.length !== calculatedHash.length ||
      !crypto.timingSafeEqual(Buffer.from(receivedHash), Buffer.from(calculatedHash))) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > 86400) return null;
  try { return { user: JSON.parse(params.get('user') || 'null'), authDate }; } catch { return null; }
}

async function configureTelegram() {
  const token = env('TELEGRAM_BOT_TOKEN');
  const appUrl = (env('TELEGRAM_WEBAPP_URL') || env('PUBLIC_APP_URL') || '').replace(/\/$/, '');
  const secret = crypto.createHash('sha256').update(`${token}::aura-webhook`).digest('hex');
  const webAppUrl = appUrl ? `${appUrl}/?v=aura-2026-10-04-1` : '';
  if (!token || !appUrl) throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_WEBAPP_URL/PUBLIC_APP_URL are required');
  await telegram('setWebhook', { url: `${appUrl}/api/telegram/webhook`, ...(secret ? { secret_token: secret } : {}), allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
  await telegram('setMyName', { name: 'AURA Vault' });
  await telegram('setMyShortDescription', { short_description: 'Digital art, NFTs, and secure P2P exchange.' });
  await telegram('setMyDescription', { description: 'AURA Vault is a selective digital art community and secure P2P exchange. Collect, create, trade, and manage digital assets from one Mini App.' });
  await telegram('setMyCommands', { commands: [
    { command: 'start', description: 'Open AURA Vault' },
    { command: 'app', description: 'Launch the AURA Mini App' },
    { command: 'help', description: 'Show AURA help' },
  ]});
  await telegram('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Open AURA', web_app: { url: webAppUrl } } });
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const token = env('TELEGRAM_BOT_TOKEN');

  if (path === '/api/telegram/health' && req.method === 'GET') {
    const appUrl = (env('TELEGRAM_WEBAPP_URL') || env('PUBLIC_APP_URL') || '').replace(/\/$/, '');
    if (!token) {
      return Response.json({ ok: true, bot: '@myaura1_bot', configured: false, tokenConfigured: false, appUrlConfigured: Boolean(appUrl) });
    }
    try {
      // A health check is also a safe, idempotent bootstrap for the real bot.
      // This matters because Netlify environment variables may be available to
      // Functions but not to the build scope, so build-time setup can be skipped.
      await configureTelegram();
      const me = await telegram('getMe', {});
      const webhook = await telegram('getWebhookInfo', {});
      return Response.json({
        ok: true,
        bot: me?.username ? `@${me.username}` : '@myaura1_bot',
        configured: Boolean(appUrl),
        tokenConfigured: true,
        appUrlConfigured: Boolean(appUrl),
        webhook: {
          url: webhook?.url || '',
          pendingUpdateCount: webhook?.pending_update_count || 0,
          lastErrorMessage: webhook?.last_error_message || null,
        },
      });
    } catch (error) {
      return Response.json({ ok: false, bot: '@myaura1_bot', configured: false, tokenConfigured: true, error: error instanceof Error ? error.message : 'Telegram API unavailable' }, { status: 502 });
    }
  }

  if (path === '/api/telegram/auth' && req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }
    const session = validateInitData(body?.initData, token);
    if (!session?.user) return Response.json({ ok: false, error: 'Invalid Telegram initData' }, { status: 401 });
    return Response.json({ ok: true, user: {
      id: session.user.id, first_name: session.user.first_name || '', last_name: session.user.last_name || '',
      username: session.user.username || '', language_code: session.user.language_code || '',
    }});
  }

  if (path === '/api/telegram/webhook' && req.method === 'POST') {
    const secret = crypto.createHash('sha256').update(`${token}::aura-webhook`).digest('hex');
    if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) return new Response('Forbidden', { status: 403 });
    let update;
    try { update = await req.json(); } catch { return new Response('OK'); }
    const message = update?.message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || '').trim().toLowerCase();
    try {
      if (chatId && (text === '/start' || text.startsWith('/start ') || text === '/app')) {
        const appUrl = (env('TELEGRAM_WEBAPP_URL') || env('PUBLIC_APP_URL') || '').replace(/\/$/, '');
        const webAppUrl = appUrl ? `${appUrl}/?v=aura-2026-10-04-1` : '';
        const replyMarkup = webAppUrl ? { inline_keyboard: [[{ text: '🚀 Open AURA Mini App', web_app: { url: webAppUrl } }]] } : undefined;
        const previewUrl = appUrl ? `${appUrl}/aura-bot-avatar.jpg?v=aura-2026-10-04-1` : '';
        try {
          if (previewUrl) {
            await telegram('sendPhoto', {
              chat_id: chatId,
              photo: previewUrl,
              caption: '✨ <b>AURA Vault</b>\n\nCollect. Create. Trade.\nYour selective digital art vault and secure P2P marketplace — inside one Mini App.',
              parse_mode: 'HTML',
              reply_markup: replyMarkup,
            });
          } else {
            throw new Error('No preview URL configured');
          }
        } catch {
          await telegram('sendMessage', {
            chat_id: chatId,
            text: '✨ Welcome to AURA Vault. Collect, create, trade and manage your digital art from one secure Mini App.',
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          });
        }
      } else if (chatId && text === '/help') {
        await telegram('sendMessage', { chat_id: chatId, text: 'AURA Vault commands:\n/start — open AURA\n/app — launch the Mini App\n/help — show this help' });
      }
    } catch (error) { console.error('Telegram webhook error:', error); }
    return new Response('OK');
  }

  if (path === '/api/telegram/setup' && req.method === 'POST') {
    const setupSecret = env('TELEGRAM_SETUP_SECRET');
    if (!setupSecret || req.headers.get('x-aura-setup-secret') !== setupSecret) return new Response('Forbidden', { status: 403 });
    try { await configureTelegram(); return Response.json({ ok: true, configured: true, bot: '@myaura1_bot' }); }
    catch (error) { console.error('Telegram setup error:', error); return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Telegram setup failed' }, { status: 500 }); }
  }

  return new Response('Not found', { status: 404 });
};

export const config = { path: ['/api/telegram/health', '/api/telegram/auth', '/api/telegram/webhook', '/api/telegram/setup'] };
