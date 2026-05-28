from django.contrib import admin
from django.db.models import Count, Q

from .models import Comment, CommentReaction


class CommentReactionInline(admin.TabularInline):
    model = CommentReaction
    extra = 0
    autocomplete_fields = ("user",)
    fields = (
        "user",
        "reaction_type",
    )


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = (
        "snippet",
        "post",
        "author",
        "status",
        "parent",
        "likes_count",
        "dislikes_count",
        "is_edited",
        "created_date",
    )
    list_filter = (
        "status",
        "is_edited",
        "created_date",
        "updated_date",
        "post",
        "author",
    )
    search_fields = (
        "body",
        "post__title",
        "author__display_name",
        "author__user__username",
        "parent__body",
    )
    readonly_fields = (
        "id",
        "created_date",
        "updated_date",
        "likes_count",
        "dislikes_count",
    )
    autocomplete_fields = (
        "post",
        "author",
        "parent",
    )
    ordering = ("-updated_date",)
    inlines = [CommentReactionInline]

    fieldsets = (
        ("Comment info", {
            "fields": (
                "id",
                "post",
                "author",
                "body",
                "status",
                "parent",
                "is_edited",
            )
        }),
        ("Reactions", {
            "fields": (
                "likes_count",
                "dislikes_count",
            )
        }),
        ("Dates", {
            "fields": (
                "created_date",
                "updated_date",
            )
        }),
    )

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.select_related(
            "post",
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

    @admin.display(description="Comment")
    def snippet(self, obj):
        return obj.get_snippet()

    @admin.display(description="Likes", ordering="likes_total")
    def likes_count(self, obj):
        return getattr(obj, "likes_total", 0)

    @admin.display(description="Dislikes", ordering="dislikes_total")
    def dislikes_count(self, obj):
        return getattr(obj, "dislikes_total", 0)


@admin.register(CommentReaction)
class CommentReactionAdmin(admin.ModelAdmin):
    list_display = (
        "comment",
        "user",
        "reaction_type",
    )
    list_filter = (
        "reaction_type",
    )
    search_fields = (
        "comment__body",
        "comment__post__title",
        "user__username",
    )
    autocomplete_fields = (
        "comment",
        "user",
    )