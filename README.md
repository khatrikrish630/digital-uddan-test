# Digital Uddan

A Blinkit-inspired marketplace for fresh fruits & vegetables. Customers browse and order; sellers register a shop, list produce, and see a sales forecast on their dashboard.

## Stack

- **Backend**: Node.js + Express + SQLite (`better-sqlite3`)
- **Auth**: JWT (email/password) + Google Sign-In (`google-auth-library`)
- **Frontend**: Plain HTML/CSS/JS — served as static files by the backend
- **Forecasting**: 7-day vs prior-7-day growth per product, with weighted moving average for next-7-day demand

## Setup

```bash
cd backend
npm install
cp .env.example .env       # Windows: copy .env.example .env
# edit .env — set JWT_SECRET to any long random string
npm run seed               # seeds demo sellers, products, and 14 days of orders
npm start
```

Open http://localhost:3000

### Demo credentials (after `npm run seed`)

| Role     | Email               | Password |
|----------|---------------------|----------|
| Customer | amit@uddan.test     | password |
| Seller 1 | ravi@uddan.test     | password |
| Seller 2 | priya@uddan.test    | password |

Log in as a seller to see the dashboard with the **forecast widget** showing rising/falling items based on seeded order history.

## Google Sign-In setup

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an **OAuth 2.0 Client ID** of type **Web application**
3. Add `http://localhost:3000` as an authorized JavaScript origin
4. Paste the client ID into `backend/.env` as `GOOGLE_CLIENT_ID=...`
5. Restart the server

Until then, the Google button on each auth page shows a "not configured" notice — email/password login still works.

## Pages

| Page                          | Purpose                                              |
|-------------------------------|------------------------------------------------------|
| `/index.html`                 | Customer storefront — browse, search, add to cart    |
| `/cart.html`                  | Cart and checkout                                    |
| `/signup.html` / `/login.html`| Customer auth (with Google button)                   |
| `/seller-register.html`       | Seller onboarding (shop name, address, phone)        |
| `/seller-login.html`          | Seller auth (with Google button)                     |
| `/seller-dashboard.html`      | List products, manage stock, **see sales forecast**  |

## How the forecast works

For each of a seller's products, the backend (`backend/routes/forecast.js`) computes:

- `sold_last_7` — units sold in the last 7 days
- `sold_prev_7` — units sold in the 7 days before that
- `growth_pct` — `(last - prev) / prev`
- `forecast_next_7` — weighted moving average: `0.7 * last + 0.3 * prev`
- `days_of_stock` — `stock / forecast_next_7 * 7` (low-stock alert if < 7)
- `trend` — `rising` (>+15%), `falling` (<-15%), or `flat`

Items are ranked rising → flat → falling, then by recent volume.

## Project structure

```
backend/
  server.js           Express bootstrap, static frontend, /api routes
  db.js               SQLite schema + connection
  seed.js             Demo data
  middleware/auth.js  JWT verification
  routes/
    auth.js           signup / login / google
    products.js       CRUD for sellers, public listing
    orders.js         place order, seller order history
    forecast.js       7d vs 7d sales forecast
frontend/
  index.html          Storefront
  cart.html
  login.html / signup.html
  seller-login.html / seller-register.html / seller-dashboard.html
  css/style.css
  js/api.js           Fetch wrapper, session storage, header rendering
  js/google-auth.js   Google Identity Services integration
```
