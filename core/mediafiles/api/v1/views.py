
import mimetypes
import os

from django.http import FileResponse, Http404
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ...models import PostFile


class PostFileDownloadAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            post_file = PostFile.objects.select_related("post").get(pk=pk)
        except PostFile.DoesNotExist:
            raise Http404

        if not post_file.file:
            raise Http404

        if not post_file.is_downloadable:
            return Response({"detail": "دانلود این فایل مجاز نیست."}, status=403)

        file_handle = post_file.file.open("rb")
        filename = os.path.basename(post_file.file.name)
        content_type, _ = mimetypes.guess_type(filename)

        response = FileResponse(
            file_handle,
            as_attachment=True,
            filename=filename,
            content_type=content_type or "application/octet-stream",
        )
        return response
    
class PostFileOpenAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            post_file = PostFile.objects.select_related("post").get(pk=pk)
        except PostFile.DoesNotExist:
            raise Http404

        if not post_file.file:
            raise Http404

        file_handle = post_file.file.open("rb")
        filename = os.path.basename(post_file.file.name)
        content_type, _ = mimetypes.guess_type(filename)

        response = FileResponse(
            file_handle,
            as_attachment=False,
            filename=filename,
            content_type=content_type or "application/octet-stream",
        )
        return response