from django.urls import path
from .views import (
    PostCommentListCreateAPIView,
    CommentReactionAPIView,
)
app_name = "interactions_api"

urlpatterns = [
    path("post/<str:slug>/comments/", PostCommentListCreateAPIView.as_view(), name="post-comments"),
    path("comments/<int:pk>/reaction/", CommentReactionAPIView.as_view(), name="comment-reaction"),
]