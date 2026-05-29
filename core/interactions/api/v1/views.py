from django.db.models import Count, Q
from django.shortcuts import get_object_or_404

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ...models import Comment, CommentReaction
from content.models import Post
from .serializers import (
    CommentListSerializer,
    CommentCreateSerializer,
    CommentReactionSerializer,
)


from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions

class PostCommentListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_post(self):
        return get_object_or_404(
            Post.objects.filter(status=Post.Status.PUBLISHED),
            slug=self.kwargs["slug"],
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CommentCreateSerializer
        return CommentListSerializer

    def get_queryset(self):
        post = self.get_post()
        return Comment.objects.filter(
            post=post,
            status=Comment.CommentStatus.APPROVED,
        ).select_related(
            "author",
            "author__user",
            "parent",
        ).annotate(
            likes_total=Count(
                "reactions",
                filter=Q(reactions__reaction_type=CommentReaction.ReactionType.LIKE),
            ),
            dislikes_total=Count(
                "reactions",
                filter=Q(reactions__reaction_type=CommentReaction.ReactionType.DISLIKE),
            ),
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["post"] = self.get_post()
        return context

    def perform_create(self, serializer):
        post = self.get_post()
        parent_id = self.request.data.get("parent")
        parent = None

        if parent_id:
            parent = get_object_or_404(Comment, id=parent_id, post=post)

        serializer.save(
            post=post,
            author=self.request.user.profile,
            parent=parent,
            status=Comment.CommentStatus.PENDING,
        )

class CommentReactionAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        comment = get_object_or_404(
            Comment,
            pk=pk,
            status=Comment.CommentStatus.APPROVED,
        )

        serializer = CommentReactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reaction_type = int(serializer.validated_data["reaction_type"])

        reaction, created = CommentReaction.objects.get_or_create(
            comment=comment,
            user=request.user,
            defaults={"reaction_type": reaction_type},
        )

        if not created:
            if reaction.reaction_type == reaction_type:
                reaction.delete()
                return Response(
                    {"status": "removed"},
                    status=status.HTTP_200_OK,
                )

            reaction.reaction_type = reaction_type
            reaction.save(update_fields=["reaction_type"])

        like_count = comment.reactions.filter(
            reaction_type=CommentReaction.ReactionType.LIKE
        ).count()
        dislike_count = comment.reactions.filter(
            reaction_type=CommentReaction.ReactionType.DISLIKE
        ).count()

        return Response(
            {
                "status": "ok",
                "comment_id": comment.id,
                "user_reaction": reaction_type,
                "like_count": like_count,
                "dislike_count": dislike_count,
            },
            status=status.HTTP_200_OK,
        )