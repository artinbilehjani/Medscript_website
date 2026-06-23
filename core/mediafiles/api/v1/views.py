"""
mediafiles/api/v1/views.py

Two views, same pattern:
  - PostFileDownloadAPIView  → attachment (browser saves file)
  - PostFileOpenAPIView      → inline    (browser opens/previews file)

In PRODUCTION (DEBUG=False, nginx in front):
  Both return instantly via X-Accel-Redirect — Django checks permission
  in microseconds, nginx streams the actual bytes. Gunicorn worker freed
  immediately regardless of file size or connection speed.

In DEVELOPMENT (DEBUG=True, runserver, no nginx):
  Falls back to direct FileResponse streaming — fine locally since
  you're the only user and there's no concurrency concern.
"""

import mimetypes
import os

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ...models import PostFile


def _get_post_file_or_404(pk):
    try:
        return PostFile.objects.select_related("post").get(pk=pk)
    except PostFile.DoesNotExist:
        raise Http404


def _x_accel_response(post_file, disposition: str) -> HttpResponse:
    """
    Build the X-Accel-Redirect response nginx uses to stream the file.
    `disposition` is either 'attachment' (download) or 'inline' (open).

    PROTECTED_MEDIA_URL="/protected-media/" matches the nginx block:
        location /protected-media/ { internal; alias /app/media/; }

    So:  /protected-media/files/42/lecture.pdf
    → nginx reads: /app/media/files/42/lecture.pdf
    → streams it directly to the client
    → Gunicorn worker is already free
    """
    filename = os.path.basename(post_file.file.name)
    content_type, _ = mimetypes.guess_type(filename)
    internal_path = f"{settings.PROTECTED_MEDIA_URL}{post_file.file.name}"

    response = HttpResponse()
    response["Content-Type"] = content_type or "application/octet-stream"
    response["X-Accel-Redirect"] = internal_path
    response["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    return response


def _dev_stream_response(post_file, as_attachment: bool) -> FileResponse:
    """
    Direct FileResponse for local dev (no nginx in front).
    Streams the file through Django — fine for one developer, not for
    concurrent production traffic.
    """
    filename = os.path.basename(post_file.file.name)
    content_type, _ = mimetypes.guess_type(filename)
    return FileResponse(
        post_file.file.open("rb"),
        as_attachment=as_attachment,
        filename=filename,
        content_type=content_type or "application/octet-stream",
    )


@method_decorator(
    # Per user (or IP if anonymous): max 20 requests/minute.
    # Catches one student hammering downloads behind the shared
    # university NAT, which nginx's per-IP limit wouldn't catch
    # (many students share that IP). Nginx is still the PRIMARY
    # rate-limit layer — this is a Django-level backstop only.
    ratelimit(key="user_or_ip", rate="20/m", block=True),
    name="dispatch",
)
class PostFileDownloadAPIView(APIView):
    """
    GET /mediafiles/api/v1/post-files/<pk>/download/
    Browser saves the file (Content-Disposition: attachment).
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        post_file = _get_post_file_or_404(pk)

        if not post_file.file:
            raise Http404

        if not post_file.is_downloadable:
            return Response({"detail": "دانلود این فایل مجاز نیست."}, status=403)

        if settings.DEBUG:
            return _dev_stream_response(post_file, as_attachment=True)

        return _x_accel_response(post_file, disposition="attachment")


@method_decorator(
    ratelimit(key="user_or_ip", rate="20/m", block=True),
    name="dispatch",
)
class PostFileOpenAPIView(APIView):
    """
    GET /mediafiles/api/v1/post-files/<pk>/open/
    Browser opens/previews the file inline (Content-Disposition: inline).
    PDFs open in the browser tab, images display, etc.
    No is_downloadable check here — "open to view" and
    "allow saving" are treated as separate permissions.
    Adjust if you want to gate viewing behind is_downloadable too.
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        post_file = _get_post_file_or_404(pk)

        if not post_file.file:
            raise Http404

        if settings.DEBUG:
            return _dev_stream_response(post_file, as_attachment=False)

        return _x_accel_response(post_file, disposition="inline")