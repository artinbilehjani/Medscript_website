FROM python:3.12-slim
LABEL maintainer="artinbilehjani@gmail.com"

ENV PYTHONUNBUFFERED=1

# Apply mirror to all pip installs
ENV PIP_INDEX_URL=https://mirror-pypi.runflare.com/simple

WORKDIR /app

COPY requirements.txt /app/

RUN python -m pip install --upgrade pip && python -m pip install -r requirements.txt

COPY ./core /app/
