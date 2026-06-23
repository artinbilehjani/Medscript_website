from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404

from ...serializers import (
    PostEditorSerializer,
    PostFileAdminSerializer,
    CommentAdminSerializer,
)
from content.models import Post
from mediafiles.models import PostFile
from interactions.models import Comment
from accounts.models import Profile

# ── Posts (full editor) ───────────────────────


class PostEditorDetailView(APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_post(self, pk):
        return get_object_or_404(
            Post.objects.prefetch_related("tag", "category", "files"), pk=pk
        )

    def get(self, request, pk):
        post = self._get_post(pk)
        return Response(PostEditorSerializer(post, context={"request": request}).data)

    def patch(self, request, pk):
        profile, _ = Profile.objects.get_or_create(
            user=request.user,
            defaults={"display_name": request.user.username},
        )
        post = self._get_post(pk)
        s = PostEditorSerializer(
            post, data=request.data, partial=True, context={"request": request}
        )
        s.is_valid(raise_exception=True)
        s.save(author=profile)
        return Response(s.data)


# ── PostFiles ─────────────────────────────────


class PostFileListCreateView(APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, post_pk):
        post = get_object_or_404(Post, pk=post_pk)
        return Response(PostFileAdminSerializer(post.files.all(), many=True).data)

    def post(self, request, post_pk):
        post = get_object_or_404(Post, pk=post_pk)
        s = PostFileAdminSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(post=post)
        return Response(s.data, status=status.HTTP_201_CREATED)


class PostFileDetailView(APIView):
    permission_classes = [IsAdminUser]

    def delete(self, request, post_pk, pk):
        obj = get_object_or_404(PostFile, pk=pk, post_id=post_pk)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, post_pk, pk):
        obj = get_object_or_404(PostFile, pk=pk, post_id=post_pk)
        s = PostFileAdminSerializer(obj, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


# ── Comments ──────────────────────────────────


class CommentListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        status_filter = request.query_params.get("status")
        qs = Comment.objects.select_related("author", "post", "parent").order_by(
            "-created_date"
        )
        if status_filter:
            qs = qs.filter(status=int(status_filter))
        return Response(CommentAdminSerializer(qs, many=True).data)


class CommentDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _obj(self, pk):
        return get_object_or_404(Comment, pk=pk)

    def get(self, request, pk):
        return Response(CommentAdminSerializer(self._obj(pk)).data)

    def delete(self, request, pk):
        self._obj(pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommentApproveView(APIView):
    """PATCH /comments/<pk>/approve/"""

    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        obj = get_object_or_404(Comment, pk=pk)
        obj.status = Comment.CommentStatus.APPROVED
        obj.save(update_fields=["status"])
        return Response({"id": obj.pk, "status": obj.status})


class CommentRejectView(APIView):
    """PATCH /comments/<pk>/reject/"""

    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        obj = get_object_or_404(Comment, pk=pk)
        obj.status = Comment.CommentStatus.REJECTED
        obj.save(update_fields=["status"])
        return Response({"id": obj.pk, "status": obj.status})
