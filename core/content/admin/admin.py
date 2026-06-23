from django.contrib import admin
from ..models import Post, Category, Tag
from .admin_inline import CommentInline, PostFileInline
from django.urls import reverse
from django.utils.html import format_html


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "author",
        "status",
        "published_date",
        "created_date",
    )
    list_filter = (
        "status",
        "published_date",
        "created_date",
        "category",
        "tag",
    )
    search_fields = (
        "title",
        "content",
        "author__display_name",
        "author__user__username",
        "slug",
    )
    readonly_fields = (
        "id",
        "slug",
        "created_date",
        "updated_date",
    )
    ordering = ("-published_date",)
    autocomplete_fields = ("author",)
    filter_horizontal = ("category", "tag")
    inlines = [PostFileInline, CommentInline]
    fieldsets = (
        (
            "Post info",
            {
                "fields": (
                    "id",
                    "author",
                    "title",
                    "slug",
                    "image",
                    "content",
                    "links",
                    "status",
                    "published_date",
                    "category",
                    "tag",
                )
            },
        ),
        (
            "Dates",
            {
                "fields": (
                    "created_date",
                    "updated_date",
                )
            },
        ),
    )


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "full_name",
        "parent",
        "level",
        "posts_count",
        "view_posts",
    )
    list_filter = ("level", "parent")
    search_fields = ("name", "slug", "path", "parent__name")
    readonly_fields = ("slug", "level", "path", "full_name")
    ordering = ("level", "name")
    autocomplete_fields = ("parent",)

    fieldsets = (
        ("Category info", {"fields": ("name", "parent", "full_name")}),
        ("System fields", {"fields": ("slug", "level", "path")}),
    )

    @admin.display(description="Posts count")
    def posts_count(self, obj):
        return obj.posts.count()

    @admin.display(description="Posts")
    def view_posts(self, obj):
        url = (
            reverse("admin:content_post_changelist") + f"?category__id__exact={obj.id}"
        )
        return format_html('<a href="{}">View posts</a>', url)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "slug",
        "posts_count",
        "view_posts",
    )
    search_fields = ("name", "slug")
    readonly_fields = ("slug",)
    ordering = ("name",)

    fieldsets = (
        ("Tag info", {"fields": ("name",)}),
        ("System fields", {"fields": ("slug",)}),
    )

    @admin.display(description="Posts count")
    def posts_count(self, obj):
        return obj.posts.count()

    @admin.display(description="Posts")
    def view_posts(self, obj):
        url = reverse("admin:content_post_changelist") + f"?tag__id__exact={obj.id}"
        return format_html('<a href="{}">View posts</a>', url)
