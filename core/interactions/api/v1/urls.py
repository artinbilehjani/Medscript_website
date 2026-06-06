from django.urls import path
from .views import (
    PostCommentListCreateAPIView,
    CommentReactionAPIView,
    CommentRepliesListAPIView,
    PostLatestCommentsAPIView,
)
app_name = "interactions_api"

urlpatterns = [
    path("post/<str:slug>/comments/", PostCommentListCreateAPIView.as_view(), name="post-comments"),
    path("comments/<int:pk>/reaction/", CommentReactionAPIView.as_view(), name="comment-reaction"),
    path(
        "comments/<int:pk>/replies/",
        CommentRepliesListAPIView.as_view(),
        name="comment-replies-list",
    ),
    path(
        "post/<str:slug>/latest-comments/",
        PostLatestCommentsAPIView.as_view(),
        name="post-latest-root-comments",
    ),
]