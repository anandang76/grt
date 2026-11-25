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

**Testing on a phone (same Wi‑Fi):** run `npm run dev -- --host` in `frontend/` and open
`http://<your-mac-ip>:5173`. Session login works because `SANCTUM_STATEFUL_DOMAINS` in
`backend/.env` already trusts private LAN ranges (`192.168.*`, `10.*`, `172.16.*`) alongside
`localhost`/`127.0.0.1`. A request from any other origin isn't treated as a logged-in SPA, so
add that origin there. In production, set this to your real domain only.

**Email on/off switch:** set `EMAIL_SEND=No` in `backend/.env` to stop all outgoing email —
every message is written to `backend/storage/logs/laravel.log` instead of being delivered
(OTP codes still appear there, so logins keep working). Set `EMAIL_SEND=Yes` to send for real.
`backend/.env.testing` ships with `EMAIL_SEND=No`.

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

## Daily data refresh (cron)

`grt:refresh-history` pulls/refreshes intraday candles (+ UT Bot flags) for all instruments.
It's a standalone artisan command, so you can schedule it any way you like.

```sh
cd backend
php artisan grt:refresh-history                # latest trading day, all instruments (~7s)
php artisan grt:refresh-history --days=5        # last 5 trading days
php artisan grt:refresh-history --symbols=TCS,EICHERMOT
php artisan schedule:list                       # shows the 16:00 & 23:00 IST jobs
```

**On a VPS — two options:**

1. Laravel scheduler (recommended): one crontab line runs everything defined in `routes/console.php`
   (currently 4pm and 11pm IST):
   ```
   * * * * * cd /path/to/GRT/backend && php artisan schedule:run >> /dev/null 2>&1
   ```
2. Or cron the command directly (set the server TZ to IST or adjust the hours):
   ```
   0 16 * * 1-5 cd /path/to/GRT/backend && php artisan grt:refresh-history >> storage/logs/refresh.log 2>&1
   0 23 * * 1-5 cd /path/to/GRT/backend && php artisan grt:refresh-history >> storage/logs/refresh.log 2>&1
   ```

Until the Dhan feed is wired in, it stores demo candles; the schedule and storage stay the same for real data.
