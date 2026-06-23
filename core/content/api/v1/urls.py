from .views import (
    CategoryNavigationView,
    PublicPostDetailAPIView,
    PublicPostListAPIView,
    PublicPostListSearchAPIView,
    FilterOptionsView,
)
from django.urls import path

app_name = "content_api"


urlpatterns = [
    path("posts/", PublicPostListAPIView.as_view(), name="public-post-list"),
    path(
        "posts/search/",
        PublicPostListSearchAPIView.as_view(),
        name="public-post-list-search",
    ),
    path(
        "post/<str:slug>/", PublicPostDetailAPIView.as_view(), name="public-post-detail"
    ),
    path("archive/", CategoryNavigationView.as_view(), name="category-navigation"),
    path("filters/", FilterOptionsView.as_view(), name="filter-options"),
]
