from rest_framework import serializers
from ....models import Post, Category,Tag
from mediafiles.models import PostFile
from accounts.models import Profile
from rest_framework.parsers import JSONParser
from django.db import transaction
from django.utils import timezone

class PostFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostFile
        fields = ["id", "file"]

class RecursiveCategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    post_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name","parent","slug","path","level", "children","post_count"]

    def get_children(self, obj):
        children = obj.children.all()
        return RecursiveCategorySerializer(children, many=True).data

class TagSerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tag
        fields = ["name", "id","slug","post_count"]

class ThumbnailFieldsMixin:
    """
    Shared get_thumbnail / get_thumbnail_small logic for any serializer
    that lists posts.
 
    Returns None when there is no derived image AND no source image —
    i.e. the post has no upload at all. Does NOT fall back to a shared
    default path (there isn't one anymore). The frontend renders its own
    placeholder whenever this comes back null, exactly like it already
    does today for a falsy `post.image`.
 
    If a custom image exists but the derived thumbnail hasn't been
    generated yet (e.g. pre-migration post not yet backfilled, or Pillow
    failed silently on save), this still falls back to the full-res
    `image` so the post isn't left imageless — only the size-reduction
    is deferred, not the image itself.
    """
 
    def get_thumbnail(self, obj):
        request = self.context.get("request")
        f = obj.thumbnail if obj.thumbnail else (obj.image if obj.image else None)
        if not f:
            return None
        url = f.url
        return request.build_absolute_uri(url) if request else url
 
    def get_thumbnail_small(self, obj):
        request = self.context.get("request")
        f = obj.thumbnail_small if obj.thumbnail_small else (obj.image if obj.image else None)
        if not f:
            return None
        url = f.url
        return request.build_absolute_uri(url) if request else url
 
 
class PostListSerializer(ThumbnailFieldsMixin, serializers.ModelSerializer):
    snippet = serializers.ReadOnlyField(source="get_snippets")
    absolute_url = serializers.SerializerMethodField()
    hit_count = serializers.SerializerMethodField()
    author = serializers.CharField(source="author.display_name", read_only=True)
    category = RecursiveCategorySerializer(many=True, read_only=True)
    tag = TagSerializer(many=True, read_only=True)
    display_date = serializers.SerializerMethodField()
 
    # CHANGED: was `image` (full-res). Now reduced-size derivatives.
    thumbnail = serializers.SerializerMethodField()
    thumbnail_small = serializers.SerializerMethodField()
 
    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "thumbnail",        # ← use this in post-list.js instead of `image`
            "thumbnail_small",  # ← available for compact/list-row use
            "author",
            "snippet",
            "absolute_url",
            "published_date",
            "display_date",
            "category",
            "tag",
            "hit_count",
        ]
        read_only_fields = fields
 
    def get_absolute_url(self, obj):
        request = self.context.get("request")
        url = obj.get_absolute_url()
        return request.build_absolute_uri(url) if request else url
 
    def get_hit_count(self, obj):
        hit_count_obj = obj.hit_count_generic.all().first()
        return hit_count_obj.hits if hit_count_obj else 0
 
    def get_display_date(self, obj):
        now = timezone.now()
        published_date = obj.published_date
 
        if not published_date:
            return None
 
        diff = now - published_date
 
        if diff.total_seconds() < 60:
            seconds = int(diff.total_seconds())
            return f"{seconds} seconds ago"
        elif diff.total_seconds() < 3600:
            minutes = diff.total_seconds() / 60
            return f"{int(minutes)} minutes ago"
        elif diff.total_seconds() < 86400:
            hours = diff.total_seconds() / 3600
            return f"{int(hours)} hours ago"
        elif diff.total_seconds() < 604800:
            days = diff.total_seconds() / 86400
            return f"{int(days)} days ago"
        elif diff.total_seconds() < 2592000:
            weeks = diff.total_seconds() / 604800
            return f"{int(weeks)} weeks ago"
        elif diff.total_seconds() < 31536000:
            months = diff.total_seconds() / 2592000
            return f"{int(months)} months ago"
        else:
            years = diff.total_seconds() / 31536000
            return f"{int(years)} years ago"