from django.urls import path, include

app_name = "interactions"

urlpatterns = [
    path("api/v1/", include("interactions.api.v1.urls")),
]
