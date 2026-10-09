import express from 'express';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

const PORT = Number(process.env.PORT || 8081);
const API_KEY = process.env.TATUM_API_KEY || '';
const SMART_WALLETS_ACTIVATED = process.env.TATUM_SMART_WALLETS_ACTIVATED === 'true';
const AURA_SERVICE_SECRET = process.env.AURA_TATUM_SERVICE_SECRET || '';
const MAINNET_ENABLED = process.env.AURA_TATUM_MAINNET_ENABLED === 'true';

app.get('/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, service: 'aura-tatum-wallet-service' });
});

// This reports only configuration presence. It never returns secret values.
// It deliberately does not claim provider activation or wallet readiness unless
// activation is explicitly confirmed and the SDK/provider check is implemented.
app.get('/ready', (_req, res) => {
  const checks = {
    apiKeyConfigured: Boolean(API_KEY),
    smartWalletsActivationConfirmed: SMART_WALLETS_ACTIVATED,
    serviceAuthenticationConfigured: Boolean(AURA_SERVICE_SECRET),
    mainnetFeatureEnabled: MAINNET_ENABLED,
    transactionSigningEnabled: false,
    transactionBroadcastingEnabled: false,
  };
  const ready = checks.apiKeyConfigured && checks.smartWalletsActivationConfirmed && checks.serviceAuthenticationConfigured;
  res.set('Cache-Control', 'no-store');
  res.status(ready ? 200 : 503).json({ ok: ready, mode: 'integration-preparation', checks });
});

// No wallet creation, signing, or broadcasting routes are exposed yet.
// They must be added only after activation, SDK contract tests, share encryption
// and recovery design, chain/token validation, and reconciliation tests.
app.use((_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(404).json({ error: 'NOT_FOUND' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AURA Tatum preparation service listening on ${PORT}`);
});