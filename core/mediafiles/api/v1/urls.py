"""
mediafiles/api/v1/urls.py — unchanged from your version.
Included here so everything is in one place.
"""
from django.urls import path

from .views import PostFileDownloadAPIView, PostFileOpenAPIView

app_name = "mediafiles_api"

urlpatterns = [
    path(
        "post-files/<int:pk>/download/",
        PostFileDownloadAPIView.as_view(),
        name="post-file-download",
    ),
    path(
        "post-files/<int:pk>/open/",
        PostFileOpenAPIView.as_view(),
        name="post-file-open",
    ),
]