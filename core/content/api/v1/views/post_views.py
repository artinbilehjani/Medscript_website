from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import (
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
    IsAdminUser,
)
from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework import generics
from ..serializers import PostDetailSerializer,PostListSerializer, RecursiveCategorySerializer
from ..permissions import CustomTripleAccessPermission
from ....models import Post, Category
from ..paginations import DefaultPagination
from django.shortcuts import get_object_or_404

from django_filters.rest_framework import DjangoFilterBackend
from hitcount.views import HitCountDetailView
from hitcount.models import HitCount
from django.shortcuts import redirect
from rest_framework.parsers import JSONParser,FormParser,MultiPartParser

from rest_framework import generics
from django.shortcuts import get_object_or_404
from hitcount.views import HitCountDetailView,HitCountMixin
from hitcount.models import HitCount


class PublicPostDetailAPIView(generics.RetrieveAPIView,HitCountMixin):
    serializer_class = PostDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Post.objects.filter(
            status=Post.Status.PUBLISHED
        ).select_related(
            "author"
        ).prefetch_related(
            "category",
            "tag",
            "files",
            "hit_count_generic",
        )
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        hit_count = HitCount.objects.get_for_object(instance)
        self.hit_count(request, hit_count)

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class PublicPostListAPIView(generics.ListAPIView):
    serializer_class = PostListSerializer

    def get_queryset(self):
        queryset = Post.objects.filter(
            status=Post.Status.PUBLISHED
        ).select_related(
            "author"
        ).prefetch_related(
            "category",
            "tag",
            "hit_count_generic",
        ).order_by("-published_date", "-created_date")

        category_slug = self.request.query_params.get("category")
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        tag_slug = self.request.query_params.get("tag")
        if tag_slug:
            queryset = queryset.filter(tag__slug=tag_slug)

        return queryset.distinct()