# GR Trading

Fast, minimal, mobile-first trading terminal for GR FinTech (grfintech.in).
Plain PHP 8 + MySQL. No framework, no build step, one CSS file.

## Setup (MAMP)
1. `cp config.sample.php config.php` and edit DB / mail / Google settings.
2. `php install.php` creates the database, tables and a Super Admin.
3. Open `http://localhost/GRT/`.

## Email
Gmail SMTP with an App Password (https://myaccount.google.com/apppasswords).
If `mail.pass` is empty, emails (OTP codes etc.) are written to `storage/mail.log` instead.

## Google login
Create an OAuth Client ID (Web application) in Google Cloud Console, add your site origin
(e.g. `http://localhost`) to **Authorized JavaScript origins**, and set `google_client_id`.

## Roles
| Role        | Can do |
|-------------|--------|
| superadmin  | Everything: manage admins and users, reset passwords, change roles, view activity log |
| admin       | Approve or reject signups, activate or deactivate users |
| user        | Terminal access |

New signups are `pending` until an admin approves them.

## Structure
```
index.php  login.php  signup.php  forgot.php  google.php  logout.php  terms.php
app/       user landing, profile/password
admin/     overview, users, user detail, actions, roles, activity
inc/       bootstrap (db, helpers), auth (roles, OTP, throttle, Google), mail (SMTP), layout
assets/    app.css, favicon.svg
storage/   mail.log (git-ignored, web-denied)
```
