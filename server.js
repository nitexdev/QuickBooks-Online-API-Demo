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

app.get('/', (req, res) => {
  res.send(`
    <h2>QuickBooks Online API Demo</h2>
    <p><a href="/auth">1. Connect to QuickBooks Online (sandbox)</a></p>
    <p><a href="/report/pl">2. Pull Profit &amp; Loss report</a> (after connecting)</p>
    <p><a href="/refresh">3. Force a token refresh</a> (after connecting)</p>
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
      <p>Connected. Realm (sandbox company) ID: ${realmId}</p>
      <p><a href="/report/pl">Pull P&amp;L report</a></p>
    `);
  } catch (err) {
    console.error('Token exchange failed:', err);
    res.status(500).send('OAuth token exchange failed — check server logs.');
  }
});

// Step 3: use the access token to call the Accounting API
app.get('/report/pl', async (req, res) => {
  if (!tokenStore) return res.status(401).send('Not connected. Visit /auth first.');

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
    res.json(report);
  });
});

// Step 4: demonstrate the refresh-token flow explicitly
app.get('/refresh', async (req, res) => {
  if (!tokenStore) return res.status(401).send('Not connected. Visit /auth first.');
  try {
    const refreshed = await oauthClient.refresh();
    tokenStore = { ...tokenStore, ...refreshed.getJson() };
    res.send('Token refreshed successfully.');
  } catch (err) {
    console.error('Refresh failed:', err);
    res.status(500).send('Refresh failed — refresh token may be expired (100 days in sandbox).');
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
