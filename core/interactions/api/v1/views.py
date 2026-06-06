from django.db.models import Count, Q
from django.shortcuts import get_object_or_404

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q, OuterRef, Subquery, CharField, Value
from django.db.models.functions import Coalesce
from rest_framework.generics import ListAPIView

from ...models import Comment, CommentReaction
from content.models import Post
from .serializers import (
    CommentListSerializer,
    CommentCreateSerializer,
    CommentReactionSerializer,
    LatestCommentSerializer,
)
from .paginations import CommentPagination
from django.db.models import Count, Q, OuterRef, Subquery, CharField, Value
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import NotFound

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions

class PostCommentListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = CommentPagination

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
        user = self.request.user

        queryset = Comment.objects.filter(
            post=post,
            status=Comment.CommentStatus.APPROVED,
            parent__isnull=True,
        ).select_related(
            "author",
            "author__user",
        ).annotate(
            like_count=Count(
                "reactions",
                filter=Q(reactions__reaction_type=CommentReaction.ReactionType.LIKE),
                distinct=True,
            ),
            dislike_count=Count(
                "reactions",
                filter=Q(reactions__reaction_type=CommentReaction.ReactionType.DISLIKE),
                distinct=True,
            ),
            replies_count=Count(
                "replies",
                filter=Q(replies__status=Comment.CommentStatus.APPROVED),
                distinct=True,
            ),
        ).order_by("-created_date")

        if user.is_authenticated:
            user_reaction_subquery = CommentReaction.objects.filter(
                comment=OuterRef("pk"),
                user=user,
            ).values("reaction_type")[:1]

            queryset = queryset.annotate(
                user_reaction=Subquery(
                    user_reaction_subquery,
                    output_field=CharField(),
                )
            )
        else:
            queryset = queryset.annotate(
                user_reaction=Value(None, output_field=CharField())
            )

        return queryset

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

class CommentRepliesListAPIView(ListAPIView):
    serializer_class = CommentListSerializer
    permission_classes = [AllowAny]
    pagination_class = CommentPagination  # replace with your pagination

    def get_parent_comment(self):
        pk = self.kwargs.get("pk")

        try:
            return Comment.objects.select_related("post").get(
                id=pk,
                status=Comment.CommentStatus.APPROVED,
            )
        except Comment.DoesNotExist:
            raise NotFound("Comment not found.")

    def get_queryset(self):
        parent_comment = self.get_parent_comment()
        user = self.request.user

        queryset = Comment.objects.filter(
            parent=parent_comment,
            status=Comment.CommentStatus.APPROVED,
        ).select_related(
            "author",
            "author__user",
        ).annotate(
            like_count=Count(
                "reactions",
                filter=Q(reactions__reaction_type=CommentReaction.ReactionType.LIKE),
                distinct=True,
            ),
            dislike_count=Count(
                "reactions",
                filter=Q(reactions__reaction_type=CommentReaction.ReactionType.DISLIKE),
                distinct=True,
            ),
            replies_count=Count(
                "replies",
                filter=Q(replies__status=Comment.CommentStatus.APPROVED),
                distinct=True,
            ),
        ).order_by("created_date")

        if user.is_authenticated:
            user_reaction_subquery = CommentReaction.objects.filter(
                comment=OuterRef("pk"),
                user=user,
            ).values("reaction_type")[:1]

            queryset = queryset.annotate(
                user_reaction=Subquery(
                    user_reaction_subquery,
                    output_field=CharField(),
                )
            )
        else:
            queryset = queryset.annotate(
                user_reaction=Value(None, output_field=CharField())
            )

        return queryset
    
class CommentReactionAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = CommentPagination

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
                "pk": comment.id,
                "user_reaction": reaction_type,
                "like_count": like_count,
                "dislike_count": dislike_count,
            },
            status=status.HTTP_200_OK,
        )
    
class PostLatestCommentsAPIView(ListAPIView):
    serializer_class = LatestCommentSerializer

    def get_queryset(self):
        post_slug = self.kwargs["slug"]
        return (
            Comment.objects.filter(
                post__slug=post_slug,
                status=Comment.CommentStatus.APPROVED,
                parent__isnull=True,
            )
            .select_related("author__user")
            .order_by("-created_date")[:2]
        )