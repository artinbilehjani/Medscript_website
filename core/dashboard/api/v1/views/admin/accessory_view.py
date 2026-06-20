from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from content.models import Tag, Category
from ...serializers import TagAdminSerializer, CategoryAdminSerializer


class TagListCreateView(APIView):
    permission_classes = [IsAdminUser]
 
    def get(self, request):
        tags = Tag.objects.all().order_by("name")
        return Response(TagAdminSerializer(tags, many=True).data)
 
    def post(self, request):
        s = TagAdminSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data, status=status.HTTP_201_CREATED)
 
 
class TagDetailView(APIView):
    permission_classes = [IsAdminUser]
 
    def _obj(self, pk): return get_object_or_404(Tag, pk=pk)
 
    def patch(self, request, pk):
        s = TagAdminSerializer(self._obj(pk), data=request.data, partial=True)
        s.is_valid(raise_exception=True); s.save()
        return Response(s.data)
 
    def delete(self, request, pk):
        self._obj(pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
 
 
# ── Categories ────────────────────────────────
 
class CategoryListCreateView(APIView):
    permission_classes = [IsAdminUser]
 
    def get(self, request):
        # Only root categories; children come via nested serializer
        roots = Category.objects.filter(parent=None)
        return Response(CategoryAdminSerializer(roots, many=True).data)
 
    def post(self, request):
        s = CategoryAdminSerializer(data=request.data)
        s.is_valid(raise_exception=True); s.save()
        return Response(s.data, status=status.HTTP_201_CREATED)
 
 
class CategoryDetailView(APIView):
    permission_classes = [IsAdminUser]
 
    def _obj(self, pk): return get_object_or_404(Category, pk=pk)
 
    def patch(self, request, pk):
        s = CategoryAdminSerializer(self._obj(pk), data=request.data, partial=True)
        s.is_valid(raise_exception=True); s.save()
        return Response(s.data)
 
    def delete(self, request, pk):
        self._obj(pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)