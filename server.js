/**
 * QuickBooks Online API demo — OAuth2 authorization code flow
 * + a live Profit & Loss report pull against the Intuit sandbox.
 *
 * Purpose: verifiable, hands-on proof of QBO API + Intuit Developer
 * platform experience (OAuth2, token storage/refresh, Accounting API).
 *
 * Flow:
 *   1. GET /auth        -> redirects to Intuit's consent screen
 *   2. GET /callback     -> exchanges the auth code for tokens, stores them
 *   3. GET /report/pl    -> calls the Accounting API for a P&L report
 *   4. GET /refresh      -> manually forces a token refresh (demo of the refresh flow)
 */

require('dotenv').config();
const express = require('express');
const OAuthClient = require('intuit-oauth');
const QuickBooks = require('node-quickbooks');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory token store for demo purposes only.
// In production this belongs in an encrypted column, not memory.
let tokenStore = null;

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: process.env.QBO_ENV || 'sandbox', // 'sandbox' or 'production'
  redirectUri: process.env.QBO_REDIRECT_URI || `http://localhost:${PORT}/callback`,
});

const PAGE_STYLE = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 640px;
      margin: 60px auto;
      padding: 0 24px;
      color: #1a1a1a;
      background: #fafafa;
    }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #666; margin-bottom: 32px; font-size: 14px; }
    .card {
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 10px;
      padding: 20px 24px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .card.disabled { opacity: 0.5; }
    .step-label { font-weight: 600; font-size: 15px; }
    .step-hint { color: #888; font-size: 13px; margin-top: 2px; }
    a.btn, button.btn {
      background: #2CA01C;
      color: white;
      text-decoration: none;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      white-space: nowrap;
    }
    a.btn.secondary { background: #f0f0f0; color: #333; }
    .status {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .status.connected { background: #e6f4ea; color: #1e7e34; }
    .status.not-connected { background: #fdecea; color: #b3261e; }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12px;
    }
  </style>
`;

app.get('/', (req, res) => {
  const connected = !!tokenStore;
  res.send(`
    ${PAGE_STYLE}
    <h1>QuickBooks Online API Demo</h1>
    <div class="subtitle">OAuth2 + Accounting API against the Intuit sandbox</div>
    <span class="status ${connected ? 'connected' : 'not-connected'}">
      ${connected ? '● Connected to sandbox company ' + tokenStore.realmId : '○ Not connected'}
    </span>

    <div class="card">
      <div>
        <div class="step-label">1. Connect to QuickBooks Online</div>
        <div class="step-hint">Runs the OAuth2 authorization flow against the sandbox</div>
      </div>
      <a class="btn" href="/auth">${connected ? 'Reconnect' : 'Connect'}</a>
    </div>

    <div class="card ${connected ? '' : 'disabled'}">
      <div>
        <div class="step-label">2. Pull Profit &amp; Loss report</div>
        <div class="step-hint">Live Accounting API call against sandbox data</div>
      </div>
      <a class="btn ${connected ? '' : 'secondary'}" href="/report/pl">Pull report</a>
    </div>

    <div class="card ${connected ? '' : 'disabled'}">
      <div>
        <div class="step-label">3. Force a token refresh</div>
        <div class="step-hint">Demonstrates the refresh-token exchange</div>
      </div>
      <a class="btn ${connected ? '' : 'secondary'}" href="/refresh">Refresh</a>
    </div>
  `);
});

// Step 1: kick off the OAuth2 authorization code flow
app.get('/auth', (req, res) => {
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'qbo-demo',
  });
  res.redirect(authUri);
});

// Step 2: handle Intuit's redirect back with the auth code, exchange for tokens
app.get('/callback', async (req, res) => {
  try {
    const authResponse = await oauthClient.createToken(req.url);
    tokenStore = authResponse.getJson(); // { access_token, refresh_token, expires_in, x_refresh_token_expires_in, ... }
    const realmId = oauthClient.getToken().realmId;
    tokenStore.realmId = realmId;

    res.send(`
      ${PAGE_STYLE}
      <h1>Connected ✅</h1>
      <div class="subtitle">Realm (sandbox company) ID: ${realmId}</div>
      <div class="card">
        <div class="step-label">Pull a live report now?</div>
        <a class="btn" href="/report/pl">Pull P&amp;L report</a>
      </div>
      <p><a href="/">&larr; Back to home</a></p>
    `);
  } catch (err) {
    console.error('Token exchange failed:', err);
    res.status(500).send(`${PAGE_STYLE}<h1>OAuth exchange failed</h1><p>Check server logs for details.</p><p><a href="/">&larr; Back to home</a></p>`);
  }
});

// Step 3: use the access token to call the Accounting API
app.get('/report/pl', async (req, res) => {
  if (!tokenStore) return res.status(401).send(`${PAGE_STYLE}<h1>Not connected</h1><p>Connect first.</p><p><a href="/">&larr; Back to home</a></p>`);

  // Refresh proactively if the access token is likely expired (demo simplification;
  // production code should track exact expiry timestamps, not just re-check every call).
  await refreshIfNeeded();

  const qbo = new QuickBooks(
    process.env.QBO_CLIENT_ID,
    process.env.QBO_CLIENT_SECRET,
    tokenStore.access_token,
    false, // no token secret needed for OAuth2
    tokenStore.realmId,
    true,  // use sandbox
    false, // debug
    null,  // minor version
    '2.0', // OAuth version
    tokenStore.refresh_token
  );

  qbo.reportProfitAndLoss({}, (err, report) => {
    if (err) {
      console.error('Report pull failed:', err);
      return res.status(500).json({ error: 'Failed to pull P&L report', details: err });
    }
    res.send(`
      ${PAGE_STYLE}
      <h1>Profit &amp; Loss report</h1>
      <div class="subtitle">Pulled live from the sandbox Accounting API</div>
      <p><a href="/">&larr; Back to home</a></p>
      <pre>${JSON.stringify(report, null, 2)}</pre>
    `);
  });
});

// Step 4: demonstrate the refresh-token flow explicitly
app.get('/refresh', async (req, res) => {
  if (!tokenStore) return res.status(401).send(`${PAGE_STYLE}<h1>Not connected</h1><p>Connect first.</p><p><a href="/">&larr; Back to home</a></p>`);
  try {
    const refreshed = await oauthClient.refresh();
    tokenStore = { ...tokenStore, ...refreshed.getJson() };
    res.send(`${PAGE_STYLE}<h1>Token refreshed ✅</h1><p><a href="/">&larr; Back to home</a></p>`);
  } catch (err) {
    console.error('Refresh failed:', err);
    res.status(500).send(`${PAGE_STYLE}<h1>Refresh failed</h1><p>Refresh token may be expired (100 days in sandbox).</p><p><a href="/">&larr; Back to home</a></p>`);
  }
});

async function refreshIfNeeded() {
  // Simplification for the demo: always refresh right before a report call
  // isn't realistic production behavior, so instead we just attempt a call
  // and let a 401 drive a refresh-and-retry in a fuller implementation.
  // Left as a hook to show where expiry-aware refresh logic belongs.
  return;
}

app.listen(PORT, () => {
  console.log(`QBO demo running at http://localhost:${PORT}`);
});
