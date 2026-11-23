# GR Trading

Fast, minimal, mobile-first trading terminal for GR FinTech (grfintech.in).

```
React (Vite) SPA ──REST──▶ Laravel 13 API ──▶ Kite / Dhan REST (orders, positions, funds)
   frontend/                  backend/          MySQL: users, roles, OTPs, audit log
      │
      └──WebSocket──▶ Node tick service ──▶ KiteTicker / Dhan live feed
                         ticker/           (auth: short-lived JWT issued by Laravel)
```

| Folder      | Stack                          | Dev URL                  |
|-------------|--------------------------------|--------------------------|
| `backend/`  | Laravel 13, PHP 8.3, MySQL     | http://localhost:8000    |
| `frontend/` | React 18 + Vite 5 (no UI kit)  | http://localhost:5173    |
| `ticker/`   | Node 18+, `ws`                 | ws://localhost:8090/ws   |

## First-time setup

```sh
# MySQL (MAMP): create the database
mysql -uroot -proot -e "CREATE DATABASE grt_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

# Backend
cd backend
composer install
cp .env.example .env && php artisan key:generate   # then set DB_*, MAIL_*, GOOGLE_CLIENT_ID, TICKER_SECRET
php artisan migrate --seed
php artisan grt:superadmin                          # create your Super Admin

# Tick service
cd ../ticker && npm install
cp .env.example .env                                # TICKER_SECRET must equal backend/.env

# Frontend
cd ../frontend && npm install
```

## Run (3 terminals)

```sh
cd backend  && php artisan serve          # :8000
cd ticker   && npm run dev                # :8090
cd frontend && npm run dev                # :5173  -> open this
```

Vite proxies `/api` and `/sanctum` to Laravel, so the browser sees one origin (cookie auth just works).

**Testing without sending real email:** `backend/.env.testing` uses `MAIL_MAILER=log`.
Run `APP_ENV=testing php artisan serve` and OTP codes appear in `backend/storage/logs/laravel.log`.
(`MAIL_MAILER=log php artisan serve` does **not** work: `artisan serve` does not pass that variable through.)

## Production build

`cd frontend && npm run build` writes to `backend/public/spa/`, and Laravel serves the SPA for every non-API path.
Point the web server's document root at `backend/public`. Run the ticker with a process manager (pm2 or systemd)
behind TLS (`wss://`), and set `TICKER_URL` / `ALLOWED_ORIGINS` accordingly.

## Auth & roles

- Login by password, 6-digit email OTP, or Google. Signup (name, email, mobile, terms) needs admin approval.
- Forgot password uses an emailed code. An admin password reset emails a temporary password, forces a change at next login, and ends existing sessions.
- `superadmin`: everything, including admins, password resets, roles and the activity log. `admin`: approve, reject, activate and deactivate users. `user`: terminal.
- Rate limits: per-email login lockout (5 per 15 min), per-IP auth limit, OTP resend cooldown, and signup limit.

## Broker feeds

`ticker/.env` sets `FEED=mock|kite|dhan`. `mock` is simulated **demo** data (the UI labels it). The `kite.js` and `dhan.js`
adapters are documented stubs that will be implemented when broker credentials are available.
