# AURA — repository notes for automated agents

AURA is a mobile-first digital-art / Web3 Telegram Mini App. The frontend is a
browser-only Vite + React 19 + Tailwind 4 SPA that talks to a hosted Supabase
project (Postgres + Auth + Edge Functions) directly from the browser.

## Run it in the Base44 sandbox

```bash
docker compose -f docker-compose.base44.yml up -d --build
curl -s localhost:3000 | grep '<div id="root">'   # expects the SPA shell
docker compose -f docker-compose.base44.yml logs -f web
```

There is one service, `web`: `node:22` running `npm run dev` (Vite, host port 3000)
against the bind-mounted working tree, so edits hot-reload. Do not add the repo's
own Dockerfile/compose — those build the production bundle.

## Non-obvious things that break the sandbox if missed

- `src/lib/supabase.ts` **throws at import time** when `VITE_SUPABASE_PUBLISHABLE_KEY`
  is empty, which replaces the whole SPA with the error boundary. Any Supabase key
  passed to the container must be a non-empty string.
- `.env.base44-defaults` holds the repo's own committed **public browser** Supabase
  values (same ones `.github/workflows/aura-ci.yml` builds with; a publishable/anon
  key is public and RLS-protected, never the service-role secret). It is listed
  before `/run/base44/app.env` so Base44 dashboard secrets override it.
- No lockfile exists in this repo, so `npm install` runs on every container start
  (see the compose `command`); `node_modules` lives in the `aura_node_modules` volume.
- Only the Vite SPA runs here. `server.js` is the production Express server: it serves
  the prebuilt `dist/` bundle and hosts the Telegram webhook/notification endpoints
  (`TELEGRAM_BOT_TOKEN`, `PUBLIC_APP_URL`, `TELEGRAM_WEBHOOK_SECRET`, `AURA_TELEGRAM_NOTIFY_SECRET`).
  Those code paths are therefore not exercised in the sandbox.
- Telegram Mini App identity activates only inside the Telegram WebView
  (`window.Telegram.WebApp`); in a plain browser the app renders the normal web
  experience. Its signed-in flow depends on the edge function `telegram-miniapp-auth`.
- Sign-in and sign-up hit the real hosted Supabase project. Email confirmation and
  OAuth redirects are hardcoded to the production URL `https://aura-8bom.onrender.com`
  in `src/context/AuthContext.tsx`, so sign-up from the sandbox cannot complete.
- `VITE_THIRDWEB_CLIENT_ID` is optional: without it the thirdweb wallet preview is
  hidden and no client is created (`lib/thirdweb.ts`).

## Preview-only Telegram override (documented)

AURA is a Telegram Mini App: inside Telegram `window.Telegram.WebApp` carries signed
`initData`, and `App.tsx` refuses to render until that Mini App identity is verified.
Because `index.html` loads `https://telegram.org/js/telegram-web-app.js`, a *plain
browser* also gets a `window.Telegram.WebApp`, but an uninitialized stub with empty
`initData` — which the gate reports as "Account verification needed", blocking every
screen in the sandbox preview.

- Sandbox behavior: `docker-compose.base44.yml` passes `VITE_BASE44_PREVIEW_MODE`
  from the platform's `BASE44_PREVIEW_MODE`. When it is exactly `"1"` and the page has
  no Telegram `initData`, `App.tsx` treats the visit as an ordinary browser and renders
  the normal signed-out web experience.
- Production behavior: with `BASE44_PREVIEW_MODE` unset (or any other value) the
  Telegram identity gate runs unchanged. This is not an auth bypass — no session is
  created and Supabase Auth/RLS still gate every read and write; only the
  Mini-App-only rendering gate is skipped for the browser preview.

## Checks

- Typecheck: `npx tsc --noEmit -p tsconfig.web.json` (what CI runs).
- Build: `npm run build` (runs `scripts/configure-telegram.mjs` first; it skips
  Telegram API calls unless `RUN_TELEGRAM_SETUP=true`).
