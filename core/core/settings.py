"""
Django settings for core project.
"""
import os
import socket
from pathlib import Path
from datetime import timedelta
from urllib.parse import urlparse
from django.contrib.messages import constants as messages

BASE_DIR = Path(__file__).resolve().parent.parent

AUTH_USER_MODEL = "accounts.User"

# ═══════════════════════════════════════════════════════════════════
# ENVIRONMENT — read entirely from os.environ (Docker injects these)
# No python-decouple config() calls — decouple reads from a .env FILE
# on disk, which conflicts with Docker's env_file injection.
# ═══════════════════════════════════════════════════════════════════
SECRET_KEY            = os.environ.get("SECRET_KEY")
DEBUG                 = os.environ.get("DEBUG", "False") == "True"
ALLOWED_HOSTS         = os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",")
SHOW_DEBUGGER_TOOLBAR = os.environ.get("SHOW_DEBUGGER_TOOLBAR", "False") == "True"
SHOW_SWAGGER          = os.environ.get("SHOW_SWAGGER", str(DEBUG)) == "True"
COMINGSOON            = os.environ.get("COMINGSOON", "False") == "True"
DISABLE_BROWSEABLE_API = os.environ.get("DISABLE_BROWSEABLE_API", "False") == "True"
FILE_DEBUGGER         = os.environ.get("FILE_DEBUGGER", "False") == "True"

# ═══════════════════════════════════════════════════════════════════
# APPLICATIONS
# ═══════════════════════════════════════════════════════════════════
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "accounts.apps.AccountsConfig",
    "content",
    "dashboard",
    "interactions",
    "mediafiles",
    "rest_framework",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    "djoser",
    "hitcount",
    "drf_yasg",
    "rest_framework_simplejwt",
    "whitenoise.runserver_nostatic",
]

# ═══════════════════════════════════════════════════════════════════
# MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ═══════════════════════════════════════════════════════════════════
# TEMPLATES
# ═══════════════════════════════════════════════════════════════════
ROOT_URLCONF = "core.urls"
WSGI_APPLICATION = "core.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ═══════════════════════════════════════════════════════════════════
# CACHE
# ═══════════════════════════════════════════════════════════════════
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "default",
    }
}

# ═══════════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════════
_db_url = urlparse(os.environ.get("DATABASE_URL", ""))

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": _db_url.path.lstrip("/"),
        "USER": _db_url.username,
        "PASSWORD": _db_url.password,
        "HOST": _db_url.hostname,
        "PORT": _db_url.port or 5432,
        "CONN_MAX_AGE": 60,
    }
}

# ═══════════════════════════════════════════════════════════════════
# PASSWORD VALIDATION
# ═══════════════════════════════════════════════════════════════════
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ═══════════════════════════════════════════════════════════════════
# INTERNATIONALISATION
# ═══════════════════════════════════════════════════════════════════
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ═══════════════════════════════════════════════════════════════════
# STATIC & MEDIA
# ═══════════════════════════════════════════════════════════════════
STATIC_URL = "/static/"
MEDIA_URL = "/media/"

if DEBUG:
    # Dev: Django serves static files directly from your source folders.
    # STATIC_ROOT is not used in dev (collectstatic isn't run).
    # STATICFILES_DIRS tells Django where to find your static source files.
    STATIC_ROOT = BASE_DIR / "static_collected"   # unused in dev but must be set
    STATICFILES_DIRS = [
        d for d in [
            BASE_DIR / "staticfiles",              # core/staticfiles/ if it exists
        ] if d.exists()                            # skip if the folder doesn't exist yet
    ]
    MEDIA_ROOT = BASE_DIR / "media"
else:
    # Prod: collectstatic writes into STATIC_ROOT (/app/staticfiles),
    # nginx serves from there. STATICFILES_DIRS are the source folders.
    STATIC_ROOT = "/app/staticfiles"
    STATICFILES_DIRS = [
        d for d in [BASE_DIR / "staticfiles"] if d.exists()
    ]
    STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
    MEDIA_ROOT = "/app/media"

# ═══════════════════════════════════════════════════════════════════
# FILE DOWNLOADS — X-Accel-Redirect
# ═══════════════════════════════════════════════════════════════════
PROTECTED_MEDIA_URL = "/protected-media/"

# ═══════════════════════════════════════════════════════════════════
# SECURITY (prod only — SSL redirect intentionally off until certbot)
# ═══════════════════════════════════════════════════════════════════
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    # SECURE_SSL_REDIRECT = True  ← uncomment AFTER certbot is working

# ═══════════════════════════════════════════════════════════════════
# REST FRAMEWORK
# ═══════════════════════════════════════════════════════════════════
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

if DISABLE_BROWSEABLE_API:
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (
        "rest_framework.renderers.JSONRenderer",
    )

# ═══════════════════════════════════════════════════════════════════
# CORS
# ═══════════════════════════════════════════════════════════════════
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = [
        f"https://{h}" for h in ALLOWED_HOSTS if h and h != "*"
    ]

# ═══════════════════════════════════════════════════════════════════
# API DOCS
# ═══════════════════════════════════════════════════════════════════
SPECTACULAR_SETTINGS = {
    "TITLE": "MedScript API",
    "DESCRIPTION": "Medical university notes platform",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SWAGGER_UI_SETTINGS": {
        "deepLinking": True,
        "persistAuthorization": True,
    },
}

# ═══════════════════════════════════════════════════════════════════
# JWT
# ═══════════════════════════════════════════════════════════════════
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=7),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "UPDATE_LAST_LOGIN": False,
}

# ═══════════════════════════════════════════════════════════════════
# MESSAGES
# ═══════════════════════════════════════════════════════════════════
MESSAGE_TAGS = {
    messages.DEBUG:   "info",
    messages.INFO:    "info",
    messages.SUCCESS: "success",
    messages.WARNING: "warning",
    messages.ERROR:   "danger",
}

# ═══════════════════════════════════════════════════════════════════
# LOGGING (only active when FILE_DEBUGGER=True in env)
# ═══════════════════════════════════════════════════════════════════
if FILE_DEBUGGER:
    LOGGING = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "simple": {
                "format": "%(levelname)s %(asctime)s %(name)s.%(funcName)s:%(lineno)s- %(message)s"
            },
        },
        "handlers": {
            "console": {"class": "logging.StreamHandler"},
            "file": {
                "level": "DEBUG",
                "class": "logging.FileHandler",
                "filename": "log.django",
                "formatter": "simple",
            },
        },
        "loggers": {
            "django": {
                "handlers": ["console", "file"],
                "level": os.environ.get("DJANGO_LOG_LEVEL", "WARNING"),
                "propagate": True,
            },
        },
    }

# ═══════════════════════════════════════════════════════════════════
# DEBUG TOOLBAR (only when explicitly enabled — never in prod)
# ═══════════════════════════════════════════════════════════════════
if SHOW_DEBUGGER_TOOLBAR:
    INSTALLED_APPS += ["debug_toolbar"]
    MIDDLEWARE += ["debug_toolbar.middleware.DebugToolbarMiddleware"]
    hostname, _, ips = socket.gethostbyname_ex(socket.gethostname())
    INTERNAL_IPS = [ip[: ip.rfind(".")] + ".1" for ip in ips] + [
        "127.0.0.1",
        "10.0.2.2",
    ]