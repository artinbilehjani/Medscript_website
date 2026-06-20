from django.urls import path, include
from . import views

app_name = "dashboard"



urlpatterns = [
    path("dashboard/api/v1/", include("dashboard.api.v1.urls")),
    path("", views.IndexPageView.as_view(), name="index"),
    path("home/", views.HomePageView.as_view(), name="home-page"),
    path("dashboard/", views.HomePageAdminView.as_view(), name="home-admin"),
]