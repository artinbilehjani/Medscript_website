from .views import CategoryNavigationView,PublicPostDetailAPIView,PublicPostListAPIView
from django.urls import path

app_name = "content_api"


urlpatterns = [
    path("posts/", PublicPostListAPIView.as_view(), name="public-post-list"),
    path("posts/<slug:slug>/", PublicPostDetailAPIView.as_view(), name="public-post-detail"),
    path("archive/", CategoryNavigationView.as_view(), name="category-navigation"),
]
