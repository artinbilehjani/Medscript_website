from django.urls import path, include
from .views import PostListPageView,ArchivePageView,PostDetailPageView

app_name = "content"

urlpatterns = [
    path("api/v1/", include("content.api.v1.urls")),
    path("posts/", PostListPageView.as_view(), name="post-list-page"),
    path("post/<str:slug>/", PostDetailPageView.as_view(), name="post-detail-page"),
    path("archive/", ArchivePageView.as_view(), name="archive-page"),
]