# views.py
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.response import Response

from content.models import Category,Post
from ..serializers.archive_serializers import CategoryNavigationSerializer

class CategoryNavigationView(APIView):
    def get(self, request, *args, **kwargs):
        parent_path = request.query_params.get("parent_path")

        if parent_path:
            parent = get_object_or_404(Category, path=parent_path)
            categories = Category.objects.filter(parent=parent).prefetch_related("children")
            current_category = CategoryNavigationSerializer(parent, context={"request": request}).data
        else:
            categories = Category.objects.filter(level=1, parent__isnull=True).prefetch_related("children")
            current_category = None

        serializer = CategoryNavigationSerializer(
            categories,
            many=True,
            context={"request": request},
        )

        return Response({
            "current_category": current_category,
            "results": serializer.data,
        })