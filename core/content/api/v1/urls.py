from . import views
from rest_framework.routers import DefaultRouter, SimpleRouter
from .views import CategoryListApiView, ArchivePostListApiView
from django.urls import path

app_name = "api-v1"

router = DefaultRouter()

router.register("post", viewset=views.PostModelViewSet, basename="post")
# router.register("category", viewset=views.CategoryModelViewSet, basename="category")
router.register("management", viewset=views.ManagementModelViewSet, basename="management")

urlpatterns = router.urls

urlpatterns = router.urls + [
    path("archive/categories/", CategoryListApiView.as_view(), name="archive-categories-api"),
    path("archive/posts/", ArchivePostListApiView.as_view(), name="archive-posts-api"),
]