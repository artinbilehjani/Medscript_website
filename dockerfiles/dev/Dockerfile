# ═══════════════════════════════════════════════════════════════════
# dockerfiles/dev/Dockerfile
# Development image — code is bind-mounted, runserver for hot reload.
# Controlled by docker-compose.dev.yml
#
# Key differences from prod:
#   - No COPY ./core (code comes from bind-mount instead — edit a
#     file locally, Django reloads it instantly, no rebuild needed)
#   - No Pillow system libs (thumbnail generation runs fine in prod;
#     in dev you're testing logic, not benchmarking image pipelines)
#   - Lighter image, faster to build
# ═══════════════════════════════════════════════════════════════════
FROM python:3.12-slim
LABEL maintainer="artinbilehjani@gmail.com"

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_INDEX_URL=https://mirror-pypi.runflare.com/simple

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# No COPY ./core here — docker-compose.dev.yml bind-mounts
# ./core:/app so your local edits are live inside the container.

EXPOSE 8000
