# AURA passkey rollout

Passkey client support is implemented in this branch and explicitly opted into in \`src/lib/supabase.ts\` using \`auth.experimental.passkey: true\`. Supabase currently labels this feature experimental; follow the current provider docs before production enrollment.

## Required hosted Auth configuration

Before testing registration, open the Aura project in Supabase Dashboard → Authentication → Passkeys and configure the hosted Auth service. The available connected project tools in this workflow can inspect database/functions, but do not expose a safe, dedicated Auth-settings update operation; do not use \`supabase config push\` with the repository's minimal config.toml, as it can overwrite unrelated Auth protection settings.

Current production Render origin:
- Relying Party Display Name: \`AURA\`
- Relying Party ID: \`aura-8bom.onrender.com\`
- Relying Party Origins: \`https://aura-8bom.onrender.com\`
- Enable Passkey Authentication: on

Important: verify the final production domain before registering end-user credentials. Passkeys are bound to the WebAuthn relying-party ID; changing the RP ID later makes existing passkeys unusable. Add another allowed origin only when its hostname is the RP ID itself or a subdomain of the chosen RP ID. A custom domain cannot automatically be added under an unrelated Render-hosted RP ID; choose the stable domain strategy before onboarding passkeys at scale.

## Management API alternative

If an operator uses the Supabase Management API instead of the Dashboard, perform a **read first**, inspect current Auth config, then PATCH only these fields to the authenticated endpoint \`/v1/projects/rtqcistkoomzmzxzasxc/config/auth\`:
- \`passkey_enabled: true\`
- \`webauthn_rp_display_name: "AURA"\`
- \`webauthn_rp_id: "aura-8bom.onrender.com"\`
- \`webauthn_rp_origins: "https://aura-8bom.onrender.com"\`

Do not put a Supabase personal access token into chat or repository secrets just for convenience. Do not blindly send a full Auth configuration object; preserve unrelated SMTP, MFA/TOTP, password, JWT/session, OAuth provider and redirect settings.

## Live validation checklist

- [ ] Hosted Auth reports passkeys enabled with the intended RP ID and origins.
- [ ] Register a passkey while signed into an existing, confirmed AURA account on the production HTTPS origin.
- [ ] Re-open Settings; the new passkey appears in the registered passkey list.
- [ ] Sign out and complete passkey sign-in on the same device.
- [ ] Verify the resulting Supabase session maps to the existing AURA user; do not create a duplicate account.
- [ ] Test cancellation, unsupported browser, disabled Auth setting and lost-passkey recovery. Google, Apple, Telegram and email remain available.
- [ ] Register a second recovery method before removing a user's last passkey.
- [ ] Repeat inside the actual Telegram Mini App WebView; success in a desktop browser does not establish mobile/WebView support.

Until this checklist passes, the UI shows actionable errors if the hosted Auth service returns \`passkey_disabled\`; do not advertise passkey login as production-verified.
