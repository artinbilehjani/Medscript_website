from django.urls import path, include

app_name = "mediafiles"

urlpatterns = [
    path("api/v1/", include("mediafiles.api.v1.urls")),
]
