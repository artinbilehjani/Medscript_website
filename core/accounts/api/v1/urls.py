from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CaptchaView, RegisterView, LoginView,LogoutView,MeProfileView,ChangePasswordView,DeleteMeView

urlpatterns = [
    path("auth/captcha/", CaptchaView.as_view(), name="captcha"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    
    path("me/profile/", MeProfileView.as_view(), name="me-profile"),
    path("me/change-password/", ChangePasswordView.as_view(), name="me-change-password"),
    path("me/delete/", DeleteMeView.as_view(), name="me-delete"),
]