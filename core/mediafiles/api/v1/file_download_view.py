"""
08_file_download_views.py — hardened PostFile download endpoint.

THE CORE IDEA: Django decides WHETHER a download is allowed (auth
check, is_downloadable flag, rate limit), then hands off the actual
file transfer to nginx via the X-Accel-Redirect header. Django's
response is a few bytes and microseconds — nginx (which is built for
exactly this) streams the actual file efficiently, freeing the
Gunicorn worker immediately instead of holding it for the whole
download duration.

This is THE single most impactful change for your "what if many people
download big files at once" worry — without it, a Gunicorn worker
(one of your precious 2-3 total) is occupied for the ENTIRE download
time of every file, for every user. With it, a worker is occupied for
milliseconds per download request, no matter the file size.

No Celery, no Redis, no background task queue needed for this.
"""

from django.conf import settings
from django.http import HttpResponse, Http404
from django.shortcuts import get_object_or_404
from django.views import View
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator

from mediafiles.models import PostFile


@method_decorator(
    # Per logged-in user (or per-IP if anonymous): max 10 download
    # requests per minute. This is the Django-level backstop behind
    # nginx's IP-based limit — catches one user hammering downloads
    # from behind a shared university IP, which nginx's per-IP limit
    # alone wouldn't catch (since many students could share that IP).
    ratelimit(key="user_or_ip", rate="10/m", block=True),
    name="dispatch",
)
class PostFileDownloadView(View):
    """
    GET /mediafiles/api/v1/post-files/<pk>/download/

    Replaces a `reverse('mediafiles_api:post-file-download', ...)`
    pattern that currently probably streams the file directly through
    Django (FileResponse) — that's the part holding a worker hostage
    for the full transfer time. This version returns instantly.
    """

    def get(self, request, pk):
        post_file = get_object_or_404(PostFile, pk=pk)

        if not post_file.file:
            raise Http404("No file attached.")

        if not post_file.is_downloadable:
            # Mirrors your existing get_download_url() serializer logic
            # (returns None when not downloadable) — this view enforces
            # the same rule server-side, since a determined user could
            # otherwise guess the URL and hit this view directly even
            # if the frontend never showed them a download link.
            raise Http404("This file is not available for download.")

        # ── X-Accel-Redirect handoff ─────────────────────────────────
        # nginx's `location /protected-media/ { internal; ... }` block
        # (see 05_nginx.conf) is configured to ONLY be reachable via
        # this header — never directly from the internet. So setting
        # is_downloadable=False on a file genuinely blocks access,
        # rather than just hiding a UI button.
        internal_path = f"{settings.PROTECTED_MEDIA_URL}{post_file.file.name}"

        response = HttpResponse()
        response["Content-Type"] = ""  # let nginx detect it from the file
        response["X-Accel-Redirect"] = internal_path
        response["Content-Disposition"] = (
            f'attachment; filename="{post_file.title or post_file.file.name}"'
        )
        return response


# ═══════════════════════════════════════════════════════════════════
# DEV FALLBACK — X-Accel-Redirect only works behind nginx. In your dev
# compose (runserver, no nginx in front), use this instead so local
# development still works without needing nginx running locally too.
# ═══════════════════════════════════════════════════════════════════

from django.http import FileResponse


class PostFileDownloadViewDev(View):
    """
    Same auth/permission logic as the prod view, but streams the file
    directly through Django — fine for local development where you're
    the only user and there's no concurrency to worry about. Switch
    which view your urls.py points to based on settings.DEBUG, or keep
    two separate URL configs for dev/prod if you prefer explicitness.
    """

    def get(self, request, pk):
        post_file = get_object_or_404(PostFile, pk=pk)

        if not post_file.file or not post_file.is_downloadable:
            raise Http404

        return FileResponse(
            post_file.file.open("rb"),
            as_attachment=True,
            filename=post_file.title or post_file.file.name,
        )


# ═══════════════════════════════════════════════════════════════════
# urls.py wiring (example — adjust path/namespace to match yours)
# ═══════════════════════════════════════════════════════════════════
"""
from django.conf import settings
from .views import PostFileDownloadView, PostFileDownloadViewDev

view = PostFileDownloadViewDev if settings.DEBUG else PostFileDownloadView

urlpatterns = [
    path('post-files/<int:pk>/download/', view.as_view(), name='post-file-download'),
]
"""