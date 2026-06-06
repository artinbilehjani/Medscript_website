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
from ..serializers import PostDetailSerializer,PostListSerializer, RecursiveCategorySerializer,PostListSearchSerializer
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
from django.db.models import Count, Q
from collections import defaultdict

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
    pagination_class = DefaultPagination

    def get_queryset(self):
        queryset = Post.objects.filter(
            status=Post.Status.PUBLISHED
        ).select_related(
            "author"
        ).prefetch_related(
            "category",
            "tag",
            "hit_count_generic",
        ).order_by("-published_date",)

        category_slug = self.request.query_params.get("category")
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        return queryset.distinct()
    
class PublicPostListSearchAPIView(generics.ListAPIView):
    serializer_class = PostListSearchSerializer
    pagination_class = DefaultPagination

    def get_queryset(self):
        qs = Post.objects.filter(status=Post.Status.PUBLISHED)

        tag_slugs = self.request.query_params.getlist("tag")
        category_slugs = self.request.query_params.getlist("category")
        search_term = (self.request.query_params.get("search") or "").strip()

        # normalize comma-separated
        if len(tag_slugs) == 1 and "," in tag_slugs[0]:
            tag_slugs = [s for s in tag_slugs[0].split(",") if s]
        if len(category_slugs) == 1 and "," in category_slugs[0]:
            category_slugs = [s for s in category_slugs[0].split(",") if s]

        # AND across tags
        if tag_slugs:
            tag_slugs = list(dict.fromkeys(tag_slugs))
            qs = (qs.filter(tag__slug__in=tag_slugs)
                    .annotate(tag_hits=Count("tag", filter=Q(tag__slug__in=tag_slugs), distinct=True))
                    .filter(tag_hits=len(tag_slugs)))

        # categories: OR within each root, AND across roots
        if category_slugs:
            selected = (Category.objects
                        .filter(slug__in=category_slugs)
                        .select_related("parent"))

            buckets = defaultdict(list)
            for c in selected:
                root = c
                while root.parent_id:
                    root = root.parent
                buckets[root.id].append(c.slug)

            for i, slugs_in_bucket in enumerate(buckets.values(), start=1):
                qs = (qs.annotate(**{
                        f"bucket_{i}_hit": Count(
                            "category",
                            filter=Q(category__slug__in=slugs_in_bucket),
                            distinct=True,
                        )
                    })
                    .filter(**{f"bucket_{i}_hit__gte": 1}))
        if search_term:
            qs = self.perform_search(qs, search_term)

        return qs.distinct()
    
    def perform_search(self, queryset, search_term):
        # Search in title and content fields
        return queryset.filter(
            Q(title__icontains=search_term) |
            Q(content__icontains=search_term)
        )