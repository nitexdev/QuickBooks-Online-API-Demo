# QuickBooks Online API Demo — OAuth2 + Profit & Loss Report

A minimal, working demo of the QuickBooks Online API and Intuit Developer
platform: OAuth2 authorization code flow, token storage/refresh, and a live
report pull against a sandbox company. Built to have a verifiable example
for client proposals, not as a production integration.

## What this proves

- OAuth2 authorization code flow against Intuit's platform (`/auth`, `/callback`)
- Token exchange and refresh handling (`/refresh`)
- A real Accounting API call — Profit & Loss report (`/report/pl`) — against
  sandbox data

## Setup

### 1. Create your Intuit Developer app

1. Go to https://developer.intuit.com and sign in (you've already created
   the account).
2. Dashboard -> **Create an app** -> choose **QuickBooks Online and Payments**.
3. Once created, go to **Keys & OAuth** under your app.
4. Under **Development settings**, copy the **Client ID** and **Client Secret**
   (sandbox keys — separate from production keys).
5. Add a **Redirect URI**: `http://localhost:3000/callback`
   (must match exactly, including no trailing slash).

### 2. Get a sandbox company

1. Go to **Sandbox** in the left nav of the developer dashboard.
2. Intuit auto-provisions a sandbox company pre-loaded with sample data
   (invoices, customers, chart of accounts) — no manual setup needed.
3. Note the company's **Realm ID** if shown; the demo also captures it
   automatically after you connect.

### 3. Configure and run

```bash
cp .env.example .env
# edit .env and paste in your Client ID / Client Secret from step 1

npm install
node server.js
```

Then open http://localhost:3000 and walk through:
1. **Connect to QuickBooks Online** — redirects to Intuit's login/consent
   screen. Log in with the sandbox company's test credentials (shown on
   the Sandbox page in the dev dashboard).
2. **Pull Profit & Loss report** — calls the live Accounting API and
   returns the sandbox company's P&L as JSON.
3. **Force a token refresh** — demonstrates the refresh-token exchange.

## Notes on production readiness

This is a demo, not a production integration. For a real client project the
gaps to close would include:

- Persisting tokens in an encrypted store, not in memory
- Expiry-aware refresh (proactive, based on `expires_in`) rather than
  refreshing on every call or waiting for a 401
- Webhook support for near-real-time sync instead of polling, where the
  client's use case calls for it
- Handling QBO API rate limits and the sandbox's 100-day refresh token
  expiry (production refresh tokens are 100 days too, but rotate on use)
- Multi-tenant token storage keyed by `realmId` for multiple connected companies

## Stack

Node.js, Express, `intuit-oauth` (Intuit's official OAuth2 client),
`node-quickbooks` (Accounting API wrapper).

homepage:
<img width="891" height="426" alt="Capture0" src="https://github.com/user-attachments/assets/512384f2-6b0b-4c1d-8653-6644b5d0feae" />



output sample:

<img width="920" height="889" alt="Capture" src="https://github.com/user-attachments/assets/d4d800d1-0e50-4655-9f27-7764c778fa6a" />


<img width="995" height="882" alt="Capture2" src="https://github.com/user-attachments/assets/7fc698bb-209c-4857-ab2f-44546c2b629d" />

<img width="974" height="895" alt="Capture3" src="https://github.com/user-attachments/assets/60ceb08c-e882-4532-bc50-c70a4243b968" />



