from django.urls import path, include

app_name = "content"

urlpatterns = [
    path("", include("content.api.v1.urls")),
]