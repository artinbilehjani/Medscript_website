# views.py
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from ....models import Post, Category
from ..serializers import PostSerializer, RecursiveCategorySerializer


def get_descendant_ids(category):
    ids = [category.id]
    for child in category.children.all():
        ids.extend(get_descendant_ids(child))
    return ids

class CategoryListApiView(ListAPIView):
    serializer_class = RecursiveCategorySerializer

    def get_queryset(self):
        return Category.objects.filter(parent__isnull=True).prefetch_related("children__children")
    

class ArchivePostListApiView(ListAPIView):
    serializer_class = PostSerializer

    def get_queryset(self):
        queryset = Post.objects.filter(status=True).prefetch_related("category", "tag", "files")
        category_id = self.request.query_params.get("category")

        if category_id:
            category = get_object_or_404(Category, id=category_id)
            ids = get_descendant_ids(category)
            queryset = queryset.filter(category__id__in=ids).distinct()

        return queryset.order_by("-published_date")