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

from ..serializers import PostSerializer, RecursiveCategorySerializer
from ..permissions import CustomTripleAccessPermission
from ....models import Post, Category
from ..paginations import DefaultPagination


from django_filters.rest_framework import DjangoFilterBackend
from hitcount.views import HitCountDetailView
from django.shortcuts import redirect

class ManagementModelViewSet(viewsets.ModelViewSet):
    # lookup_field = id
    permission_classes = [IsAuthenticatedOrReadOnly, CustomTripleAccessPermission]
    serializer_class = PostSerializer
    queryset = Post.objects.filter(status=True)
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        "category": ["exact", "in"],
        "tag": ["exact","in"],
        "author": ["exact"],
        "status": ["exact"],
    }
    search_fields = ["title", "content"]
    ordering_fields = ["published_date"]
    pagination_class = DefaultPagination

    def get_serializer_context(self):
        """
        Pass the request to the serializer context.
        """
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context

    @action(methods=["get"], detail=False)
    def get_ok(self, request):
        return Response({"detail": "ok"}, status=status.HTTP_200_OK)
    

class CategoryModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly]
    serializer_class = RecursiveCategorySerializer
    queryset = Category.objects.all()