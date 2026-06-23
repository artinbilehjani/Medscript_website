from django.urls import path, include
from .views import LoginPageView, RegisterPageView, ProfilePageView

app_name = "accounts"

urlpatterns = [
    path("api/v1/", include("accounts.api.v1.urls")),
    path("login/", LoginPageView.as_view(), name="login_page"),
    path("register/", RegisterPageView.as_view(), name="register_page"),
    path("profile/", ProfilePageView.as_view(), name="profile-page"),
]
