# MedScript — Medical University Notes Platform

A web platform for medical university students to access lecture notes, session files, and class recordings. Built with Django + DRF backend, vanilla JS frontend, and a glassmorphism dark UI.

## Features

- **Post Management** — Create, edit, and publish medical lecture notes with rich text content
- **File Attachments** — Upload PDFs, Word docs, PowerPoint, Excel, images, and ZIP archives per post
- **Secure File Downloads** — Rate-limited, permission-checked downloads via nginx X-Accel-Redirect
- **Coverflow Homepage** — 3D carousel showcasing latest and most-viewed posts
- **Category & Tag System** — Hierarchical categories with AND/OR filtering, tag-based search
- **Comments & Reactions** — Threaded comments with like/dislike reactions, admin moderation
- **Admin Dashboard** — Custom glassmorphism admin panel (not Django's default admin)
- **Hit Counting** — Per-post view tracking
- **Responsive Design** — Works on mobile, tablet, and desktop

## Tech Stack

- **Backend:** Django 5.2, Django REST Framework, PostgreSQL
- **Frontend:** Vanilla JavaScript, CSS (no framework)
- **Production:** Docker Compose, Nginx, Gunicorn
- **Image Processing:** Pillow (auto-generated thumbnails)

## Quick Start (Development)

```bash
# Clone
git clone https://github.com/artinbilehjani/Medscript_website.git
cd Medscript_website

# Start
docker compose -f docker-compose.dev.yml up --build

# First time only (in a second terminal)
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
```

Open `http://localhost:8000`

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full VPS deployment instructions.

## Project Structure

```
medscript/
├── core/                          ← Django project + all apps
│   ├── core/                      ← Settings, URLs, WSGI
│   ├── accounts/                  ← User auth, profiles, thumbnails
│   ├── content/                   ← Posts, categories, tags
│   ├── dashboard/                 ← Admin dashboard + home API
│   ├── interactions/              ← Comments, reactions
│   ├── mediafiles/                ← File uploads, downloads
│   ├── templates/                 ← HTML templates
│   ├── staticfiles/               ← Source static files (CSS/JS)
│   └── gunicorn.conf.py           ← Production WSGI config
├── dockerfiles/
│   ├── dev/Dockerfile             ← Development image
│   └── prod/Dockerfile            ← Production image
├── nginx/
│   └── default.conf               ← Nginx config (rate limiting, X-Accel-Redirect)
├── envs/
│   ├── dev/.env                   ← Dev environment (safe to commit)
│   └── prod/.env.example          ← Prod template (NEVER commit the real .env)
├── docker-compose.dev.yml         ← Local development
├── docker-compose.prod.yml        ← Production deployment
└── requirements.txt               ← Python dependencies
```

## License

MIT License — see [LICENSE](LICENSE) for details.

## Author

Artin Bilehjani — [artinbilehjani@gmail.com](mailto:artinbilehjani@gmail.com)