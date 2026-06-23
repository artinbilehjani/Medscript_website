from django.shortcuts import render

# Create your views here.
from django.views.generic import TemplateView


class IndexPageView(TemplateView):
    template_name = "index.html"


class HomePageView(TemplateView):
    template_name = "home.html"


class HomePageAdminView(TemplateView):
    template_name = "dashboard/home_admin.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["admin_user"] = self.request.user
        return context
