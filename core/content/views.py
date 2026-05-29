from django.shortcuts import render

# Create your views here.
from django.views.generic import TemplateView

class PostListPageView(TemplateView):
    template_name = "content/post_list.html"

class ArchivePageView(TemplateView):
    template_name = "content/archive.html"

class PostDetailPageView(TemplateView):
    template_name = "content/post_detail.html"