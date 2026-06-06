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

class PostListSerializer(serializers.ModelSerializer):
    snippet = serializers.ReadOnlyField(source="get_snippets")
    absolute_url = serializers.SerializerMethodField()
    hit_count = serializers.SerializerMethodField()
    author = serializers.CharField(source="author.display_name", read_only=True)
    category = RecursiveCategorySerializer(many=True, read_only=True)
    tag = TagSerializer(many=True, read_only=True)
    display_date = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "image",
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
        published_date = obj.published_date # Access the published_date from the model instance

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
        elif diff.total_seconds() < 2592000:  # Approximately 4 weeks
            weeks = diff.total_seconds() / 604800
            return f"{int(weeks)} weeks ago"
        elif diff.total_seconds() < 31536000: # Approximately 12 months
            months = diff.total_seconds() / 2592000
            return f"{int(months)} months ago"
        else:
            years = diff.total_seconds() / 31536000
            return f"{int(years)} years ago"