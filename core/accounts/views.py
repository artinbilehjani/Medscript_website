from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin

class LoginPageView(TemplateView):
    template_name = "accounts/login.html"

class RegisterPageView(TemplateView):
    template_name = "accounts/register.html"

class ProfilePageView(LoginRequiredMixin, TemplateView):
    template_name = "accounts/profile.html"