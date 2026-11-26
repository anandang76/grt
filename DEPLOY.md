# Deploying GR Trading to a Hostinger VPS

A practical, step-by-step guide. Assumes a fresh **Ubuntu 22.04/24.04** Hostinger VPS, a domain
you control (e.g. `app.grfintech.in`) pointed at the VPS IP, and SSH root access.

Stack: **Laravel 13 (PHP 8.3 + MySQL)** API, **React/Vite** SPA served by Laravel, a **Node**
websocket tick service, and **cron** for the scheduler.

Replace `app.grfintech.in` with your domain and `/var/www/grt` with your chosen path throughout.

---

## 0. One-time: DNS

In Hostinger (or your DNS), create an **A record**: `app` → your VPS IP. Wait for it to resolve
(`ping app.grfintech.in`).

---

## 1. Connect and update

```bash
ssh root@YOUR_VPS_IP
apt update && apt upgrade -y
apt install -y git unzip curl nginx
```

## 2. Install PHP 8.3 + extensions

```bash
apt install -y software-properties-common
add-apt-repository -y ppa:ondrej/php
apt update
apt install -y php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring php8.3-xml \
  php8.3-curl php8.3-bcmath php8.3-zip php8.3-intl php8.3-gd
php -v   # confirm 8.3
```

## 3. Install Composer, Node 18+, pm2

```bash
# Composer
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer

# Node 20 LTS (18+ works)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v && npm -v

# pm2 keeps the tick service running
npm install -g pm2
```

## 4. Install & secure MySQL

```bash
apt install -y mysql-server
mysql_secure_installation      # set a root password, answer Y to the prompts
```

Create the database and a dedicated user:

```bash
mysql -u root -p
```
```sql
CREATE DATABASE grt_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'grt'@'localhost' IDENTIFIED BY 'a-strong-password-here';
GRANT ALL PRIVILEGES ON grt_app.* TO 'grt'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 5. Get the code

```bash
mkdir -p /var/www && cd /var/www
git clone https://github.com/anandang76/grt.git grt
cd grt
```

(If the repo is private, set up a deploy key or use a GitHub token for the clone.)

## 6. Backend (Laravel) setup

```bash
cd /var/www/grt/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
nano .env
```

Set these in `backend/.env` (the important production values):

```ini
APP_NAME="GR Trading"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://app.grfintech.in
APP_TIMEZONE=Asia/Kolkata

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_SOCKET=
DB_DATABASE=grt_app
DB_USERNAME=grt
DB_PASSWORD=a-strong-password-here

# Email: real sending via Gmail app password, or EMAIL_SEND=No to log only
EMAIL_SEND=Yes
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=youraddress@gmail.com
MAIL_PASSWORD=your-gmail-app-password
MAIL_FROM_ADDRESS=youraddress@gmail.com
MAIL_FROM_NAME="GR Trading"

# SPA is same-origin in production
SANCTUM_STATEFUL_DOMAINS=app.grfintech.in
SESSION_SECURE_COOKIE=true
SESSION_EXPIRE_ON_CLOSE=true
FRONTEND_URL=https://app.grfintech.in

# Tick service (wss proxied by Nginx — see step 10)
TICKER_URL=wss://app.grfintech.in/ws
TICKER_SECRET=generate-a-long-random-string

# Optional Google login
GOOGLE_CLIENT_ID=
```

Generate a ticker secret with: `php -r "echo bin2hex(random_bytes(32));"`

Run migrations and set up data:

```bash
php artisan migrate --force
php artisan grt:candle-tables          # per-symbol candle tables
php artisan grt:import-instruments     # map symbols -> Dhan securityIds
php artisan grt:superadmin             # create your Super Admin (interactive)

# cache config/routes for speed
php artisan config:cache
php artisan route:cache
```

> **Important — the dev login backdoor is auto-disabled** because `APP_ENV=production`. It only
> ever works in local/testing. For extra safety you may delete `app/Support/Backdoor.php` and its
> call sites, and rotate any passwords that were committed during development.

## 7. Build the frontend

```bash
cd /var/www/grt/frontend
npm install
npm run build        # outputs to ../backend/public/spa
```

Laravel serves the SPA from `backend/public/spa` for every non-API path, so no separate web server
for the frontend.

## 8. Permissions

```bash
chown -R www-data:www-data /var/www/grt/backend/storage /var/www/grt/backend/bootstrap/cache
chmod -R 775 /var/www/grt/backend/storage /var/www/grt/backend/bootstrap/cache
```

## 9. Tick service (Node) via pm2

```bash
cd /var/www/grt/ticker
npm install
cp .env.example .env
nano .env
```
Set in `ticker/.env`:
```ini
PORT=8090
FEED=dhan
BACKEND_URL=http://127.0.0.1:8000     # Laravel reachable locally; see note below
TICKER_SECRET=the-same-secret-as-backend-.env
ALLOWED_ORIGINS=https://app.grfintech.in
```
> `BACKEND_URL` is how the tick service reaches Laravel for the Dhan token + securityId map.
> If PHP-FPM is served only through Nginx (no local :8000), set `BACKEND_URL=https://app.grfintech.in`.

Start it and enable on boot:
```bash
pm2 start server.js --name grt-ticker
pm2 save
pm2 startup systemd      # run the command it prints
```

## 10. Nginx (serve Laravel + proxy the websocket) + SSL

Create `/etc/nginx/sites-available/grt`:

```nginx
server {
    listen 80;
    server_name app.grfintech.in;
    root /var/www/grt/backend/public;
    index index.php;

    client_max_body_size 10M;

    # Websocket -> Node tick service
    location /ws {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }

    location ~ /\.(?!well-known).* { deny all; }
}
```

Enable it and add HTTPS:

```bash
ln -s /etc/nginx/sites-available/grt /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Free SSL via Let's Encrypt
apt install -y certbot python3-certbot-nginx
certbot --nginx -d app.grfintech.in     # choose redirect HTTP->HTTPS
```

Certbot rewrites the server block to listen on 443 with the certs and auto-renews.

## 11. Cron (Laravel scheduler)

The scheduler runs the daily refresh (4pm & 11pm IST) and the 5-minute live-refresh.

```bash
crontab -e
```
Add:
```
* * * * * cd /var/www/grt/backend && php artisan schedule:run >> /dev/null 2>&1
```

Set the server timezone to IST so the 4pm/11pm jobs fire correctly (the schedule also pins
`Asia/Kolkata`, so this is belt-and-suspenders):
```bash
timedatectl set-timezone Asia/Kolkata
```

## 12. First login & data

1. Open `https://app.grfintech.in` and log in with the Super Admin from step 6.
2. Go to **Dhan API token** and enter the Client ID (once) and today's access token.
3. Go to **Admin → History data** and pull a month for the symbols you watch (or wait for the cron).
4. The live feed starts streaming once the token is set and the market is open.

---

## Updating / redeploying (after code changes)

```bash
cd /var/www/grt
git pull origin main

cd backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache
# if symbols changed:  php artisan grt:candle-tables && php artisan grt:import-instruments

cd ../frontend
npm install
npm run build

# restart services
pm2 restart grt-ticker
systemctl reload php8.3-fpm
```

A tiny helper script (`/var/www/grt/deploy.sh`) with the above is handy; `chmod +x` it and run after each push.

---

## Notes & gotchas

- **Market data (read) needs no static IP.** A **static IP is only required for placing orders**
  via Dhan — that's a later step, configured in your Dhan account against the VPS's public IP.
- **Daily Dhan token** expires each day. Someone re-enters it on the **Dhan API token** page each
  morning; the tick service auto-refreshes it within ~20 minutes. (A future enhancement is a Dhan
  login flow to automate this.)
- **Gmail sending limits** apply to personal accounts; for volume use a transactional mail service
  and a verified sender on your domain (SPF/DKIM) so mail doesn't land in spam.
- **Backups:** schedule a nightly `mysqldump grt_app` to off-box storage.
- **Firewall:** `ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable`. The tick service
  (8090) stays internal — it's reached only via the Nginx `/ws` proxy, so don't open 8090 publicly.
