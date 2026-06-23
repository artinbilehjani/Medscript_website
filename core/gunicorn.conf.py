"""
06_gunicorn.conf.py — worker tuning for a 1-2 core / 2-4GB VPS.

WHY THIS MATTERS MORE THAN ANYTHING ELSE IN THIS BUNDLE:
Every Gunicorn "worker" is a separate OS process running a full copy of
Django. Too many workers = each gets starved of CPU/RAM and everything
gets slow. Too few = you can't handle concurrent requests at all.
The formula below is the standard, battle-tested starting point.
"""

import multiprocessing

# ── Worker count ──────────────────────────────────────────────────
# The textbook formula is (2 × cpu_cores) + 1. On a 1-core box that's
# 3 workers, which is actually too many — each worker needs its own
# slice of RAM (Django + all loaded apps ≈ 80-150MB per worker), and
# 3 workers fighting over 1 CPU core just causes context-switching
# overhead with no real throughput gain.
#
# For YOUR situation (1-2 cores, 2-4GB RAM, file downloads are now
# offloaded to nginx so workers aren't held hostage by slow downloads):
cpu_count = multiprocessing.cpu_count()
workers = min(max(cpu_count, 1), 2) + 1   # 1 core → 2 workers, 2 cores → 3 workers

# ── Worker class ──────────────────────────────────────────────────
# "sync" (the default) is correct here. "gevent"/"gthread" async
# workers help when workers spend time WAITING (e.g. on slow external
# APIs) — that's not your bottleneck once nginx handles file serving.
# Don't add async worker complexity you don't need yet.
worker_class = "sync"

# ── Requests per worker before restart ─────────────────────────────
# Recycles each worker after N requests. Protects against slow memory
# leaks (Pillow/image processing is a common source) accumulating over
# days of uptime. jitter prevents all workers restarting simultaneously.
max_requests = 500
max_requests_jitter = 50

# ── Timeouts ────────────────────────────────────────────────────────
# If a worker doesn't respond in this many seconds, Gunicorn kills and
# restarts it. Since file downloads are now nginx's job (not a Django
# view holding a worker hostage), 30s is generous for any real Django
# view (rendering a page, hitting the DB) without letting a truly stuck
# worker block requests indefinitely.
timeout = 30
graceful_timeout = 30

# ── Bind ──────────────────────────────────────────────────────────
bind = "0.0.0.0:8000"

# ── Logging ─────────────────────────────────────────────────────────
accesslog = "-"   # stdout — `docker compose logs backend` shows it
errorlog = "-"
loglevel = "info"

# ── Preload app ─────────────────────────────────────────────────────
# Loads Django once in the master process before forking workers,
# instead of each worker loading it independently. Saves RAM (shared
# via copy-on-write) and speeds up startup. Safe default for your setup.
preload_app = True