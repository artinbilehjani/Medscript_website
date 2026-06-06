from django.shortcuts import render

# Create your views here.
from django.views.generic import TemplateView

class PostListPageView(TemplateView):
    template_name = "content/post_list.html"

class PostListSearchPageView(TemplateView):
    template_name = "content/post_list_search.html"

class ArchivePageView(TemplateView):
    template_name = "content/archive.html"

class PostDetailPageView(TemplateView):
    template_name = "content/post_detail.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["slug"] = self.kwargs.get("slug", "")
        return context