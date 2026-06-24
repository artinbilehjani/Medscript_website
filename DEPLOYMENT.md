# MedScript — VPS Deployment Guide

Step-by-step instructions for deploying MedScript on a Linux VPS (Ubuntu/Debian).
Written for first-time deployers.

---

## 1. VPS Requirements

### Minimum (400 users, not all concurrent)
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **RAM** | 2 GB | 4 GB |
| **CPU** | 1 core | 2 cores |
| **Disk** | 20 GB SSD | 40 GB SSD |
| **OS** | Ubuntu 22.04+ or Debian 12+ | Ubuntu 24.04 LTS |

**Why these numbers:**
- Postgres idles at ~50MB, peaks ~200MB under load
- Gunicorn: 2 workers × ~150MB each = ~300MB
- Nginx: ~30MB
- OS + Docker overhead: ~400MB
- Total steady-state: ~1GB, leaving headroom for bursts on a 2GB box
- On 1 core: 2 Gunicorn workers (enough for ~50 concurrent users)
- On 2 cores: 3 Gunicorn workers (enough for ~100+ concurrent users)

**If budget is tight:** 2GB RAM / 1 core works. You'll handle your 400
students fine since they won't all be on simultaneously. The rate
limiting in nginx protects you during the launch-hour spike.

**Don't go below 2GB.** At 1GB, the OS + Docker + Postgres + Gunicorn
leaves almost zero headroom — one traffic spike and the OOM killer
starts terminating containers.

---

## 2. Initial VPS Setup

SSH into your new VPS:

```bash
ssh root@YOUR_VPS_IP
```

### 2.1 — Create a non-root user (security best practice)

```bash
adduser medscript
usermod -aG sudo medscript
su - medscript
```

### 2.2 — Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Let your user run docker without sudo
sudo usermod -aG docker $USER

# Log out and back in for group change to take effect
exit
ssh medscript@YOUR_VPS_IP

# Verify
docker --version
docker compose version
```

### 2.3 — Basic firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 3. Clone and Configure

### 3.1 — Clone from GitHub

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/Medscript_website.git
cd Medscript_website
```

### 3.2 — Create the production .env file

```bash
cp envs/prod/.env.example envs/prod/.env
nano envs/prod/.env
```

Fill in these values:

```dotenv
# Generate a real secret key — run this command and paste the output:
# python3 -c "import secrets; print(secrets.token_urlsafe(50))"
SECRET_KEY=PASTE_YOUR_GENERATED_KEY_HERE

DEBUG=False
COMINGSOON=False

# Your actual domain (after DNS is pointed at this VPS)
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Postgres credentials — pick a strong password
POSTGRES_DB=medscript
POSTGRES_USER=medscript_admin
POSTGRES_PASSWORD=PICK_A_STRONG_PASSWORD_HERE
DATABASE_URL=postgres://medscript_admin:SAME_PASSWORD_HERE@db:5432/medscript

# Trust auth for Postgres (container-internal only, not exposed to internet)
POSTGRES_HOST_AUTH_METHOD=trust
```

**CRITICAL:** Never commit `envs/prod/.env` to git. Your `.gitignore`
already excludes it.

### 3.3 — Update nginx config with your domain

```bash
nano nginx/default.conf
```

Find `server_name YOUR_DOMAIN_HERE;` and replace with your actual domain:

```nginx
server_name yourdomain.com www.yourdomain.com;
```

---

## 4. Deploy

### 4.1 — Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4.2 — Run migrations and create admin

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

### 4.3 — Verify it's running

```bash
# Check all containers are up
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Test locally on the VPS
curl -I http://localhost
```

Your site should now be accessible at `http://YOUR_VPS_IP` (or
`http://yourdomain.com` once DNS propagates).

---

## 5. HTTPS with Let's Encrypt (free)

Once your domain's DNS is pointing at the VPS IP:

### 5.1 — Install certbot

```bash
sudo apt install certbot
```

### 5.2 — Stop nginx temporarily to get the certificate

```bash
docker compose -f docker-compose.prod.yml stop nginx
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
docker compose -f docker-compose.prod.yml start nginx
```

### 5.3 — Update nginx config for HTTPS

Replace your `nginx/default.conf` with this (keep the rate limit zones
from the original, just update the server blocks):

Add this redirect block BEFORE your existing server block:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

Then change your main server block:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # ... rest of your existing config (locations, rate limits, etc.) ...
}
```

### 5.4 — Mount cert files in docker-compose.prod.yml

Add to the nginx volumes:

```yaml
  nginx:
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - static_volume:/app/collected_static:ro
      - media_volume:/app/media:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro          # ← ADD
```

### 5.5 — Enable SSL redirect in Django settings

In `core/settings.py`, find the commented-out line and uncomment it:

```python
if not DEBUG:
    SECURE_SSL_REDIRECT = True    # ← uncomment this now
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
```

### 5.6 — Restart

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### 5.7 — Auto-renew certificates

```bash
sudo crontab -e
```

Add this line:

```
0 3 * * * certbot renew --quiet && docker restart nginx
```

---

## 6. Day-to-Day Operations

### Redeploy after code changes

```bash
cd ~/Medscript_website
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build --no-deps backend
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

### View logs

```bash
# All containers
docker compose -f docker-compose.prod.yml logs -f

# Just one
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f db
```

### Restart a single service

```bash
docker compose -f docker-compose.prod.yml restart backend
```

### Full restart

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Django shell (for debugging/data fixes)

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

### Database backup

```bash
# Backup
docker compose -f docker-compose.prod.yml exec db pg_dump -U medscript_admin medscript > backup_$(date +%Y%m%d).sql

# Restore (careful — overwrites current data)
cat backup_20260624.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U medscript_admin medscript
```

**Set up automatic daily backups:**

```bash
mkdir -p ~/backups
crontab -e
```

Add:

```
0 2 * * * cd ~/Medscript_website && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U medscript_admin medscript | gzip > ~/backups/medscript_$(date +\%Y\%m\%d).sql.gz && find ~/backups -mtime +30 -delete
```

This backs up nightly at 2 AM and keeps 30 days of backups.

---

## 7. Security Checklist

Before going live, verify all of these:

- [ ] `DEBUG=False` in `envs/prod/.env`
- [ ] `SECRET_KEY` is a real random string (not `test` or `dev-only-...`)
- [ ] `envs/prod/.env` is NOT committed to git
- [ ] `DJANGO_ALLOWED_HOSTS` lists only your actual domain(s)
- [ ] HTTPS is working (after certbot setup)
- [ ] `SECURE_SSL_REDIRECT=True` is uncommented (after HTTPS works)
- [ ] Superuser password is strong (not `testpass123`)
- [ ] Postgres password is strong
- [ ] Django admin is only accessible to `is_staff=True` users
- [ ] `SHOW_SWAGGER` is `False` in prod (it reads from `DEBUG` now)
- [ ] Firewall only allows ports 22, 80, 443

### About Django Admin access

Only users with `is_staff=True` can log into `/admin/`. Only users
with `is_superuser=True` have full access to everything in admin.
Regular users (`is_staff=False`) get a "You don't have permission"
page even if they navigate to `/admin/` directly. Your
`createsuperuser` command creates a user with both flags set to `True`.

Your custom admin dashboard at `/dashboard/` uses `IsAdminUser`
permission, which also checks `is_staff=True`.

---

## 8. Monitoring (optional but recommended)

### Simple uptime check with a free service

Sign up at [UptimeRobot](https://uptimerobot.com) (free tier, 50
monitors) and add an HTTP monitor for `https://yourdomain.com`. It
pings every 5 minutes and emails you if the site goes down.

### Check disk space

```bash
df -h
```

If `/` is above 80%, clean up old Docker images:

```bash
docker system prune -a --volumes
```

### Check memory usage

```bash
free -h
docker stats --no-stream
```

---

## 9. Troubleshooting

| Problem | Fix |
|---------|-----|
| `502 Bad Gateway` from nginx | Gunicorn isn't running — check `docker compose logs backend` |
| `static files not loading` | Run `collectstatic` again, check nginx volume mounts |
| `database connection refused` | Check `docker compose logs db`, verify DATABASE_URL matches POSTGRES_* vars |
| Container keeps restarting | Check `docker compose logs <container>` for the actual error |
| `permission denied` on media uploads | Check media volume permissions inside container |
| Site is slow under load | Check `docker stats`, consider upgrading VPS RAM/cores |
