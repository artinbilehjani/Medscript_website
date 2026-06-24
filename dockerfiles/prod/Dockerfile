# ═══════════════════════════════════════════════════════════════════
# dockerfiles/prod/Dockerfile
# Production image — code is baked in, Gunicorn runs it.
# Controlled by docker-compose.prod.yml
# ═══════════════════════════════════════════════════════════════════
FROM python:3.12-slim
LABEL maintainer="artinbilehjani@gmail.com"

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# ENV PIP_INDEX_URL=https://mirror-pypi.runflare.com/simple

WORKDIR /app

# System libraries Pillow needs at RUNTIME (even when installed via
# a precompiled wheel, it still dynamically links these at runtime).
# psycopg[binary] is fully self-contained — no libpq-dev or gcc needed.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo \
    zlib1g \
    libpng16-16 \
    libwebp7 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first — this layer is cached separately so a code
# change doesn't force a full pip reinstall on every rebuild.
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Bake the application code into the image.
# In prod there is no bind-mount — what's in the image is what runs.
COPY ./core /app/

EXPOSE 8000
