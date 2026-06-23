from django.contrib import admin
from mediafiles.models import PostFile
from interactions.models import Comment, CommentReaction
from django.db.models import Count, Q
from django.utils.html import format_html
from django.urls import reverse

# Register your models here.


class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0
    autocomplete_fields = ("author", "parent")
    readonly_fields = (
        "id",
        "status",
        "likes_count",
        "dislikes_count",
        "created_date",
        "updated_date",
        "view_comment_link",
    )
    fields = (
        "author",
        "parent",
        "body",
        "status",
        "likes_count",
        "dislikes_count",
        "view_comment_link",
        "created_date",
    )
    show_change_link = True
    ordering = ("-created_date",)
    can_delete = True

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.select_related(
            "author",
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

    @admin.display(description="Likes")
    def likes_count(self, obj):
        return getattr(obj, "likes_total", 0)

    @admin.display(description="Dislikes")
    def dislikes_count(self, obj):
        return getattr(obj, "dislikes_total", 0)

    @admin.display(description="Comment admin")
    def view_comment_link(self, obj):
        if not obj.pk:
            return "-"
        url = reverse("admin:interactions_comment_change", args=[obj.pk])
        return format_html('<a href="{}">Open</a>', url)


class PostFileInline(admin.TabularInline):
    model = PostFile
    extra = 1
    fields = (
        "title",
        "file",
        "description",
        "file_type",
        "is_downloadable",
        "created_date",
    )
    readonly_fields = (
        "file_type",
        "created_date",
    )
