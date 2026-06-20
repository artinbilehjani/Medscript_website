from rest_framework import serializers
from ....models import Post, Category,Tag
from mediafiles.models import PostFile
from accounts.models import Profile
from rest_framework.parsers import JSONParser
from django.db import transaction
from django.utils import timezone

class PostFileSerializer(serializers.ModelSerializer):
    file_url     = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model  = PostFile
        fields = ["id", "title", "description", "file_type",
                  "is_downloadable", "file_url", "download_url"]

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url

    def get_download_url(self, obj):
        if not obj.file or not obj.is_downloadable:
            return None
        from django.urls import reverse
        request = self.context.get('request')
        url = reverse('mediafiles_api:post-file-download', kwargs={'pk': obj.pk})
        return request.build_absolute_uri(url) if request else url

class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    post_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name","parent","slug","path","level", "children","post_count"]

    def get_children(self, obj):
        children = obj.children.all()
        return CategorySerializer(children, many=True).data

class TagSerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tag
        fields = ["name", "id","slug","post_count"]


class DisplayDateMixin:
    """Shared relative-time helper for serializers."""
 
    def get_display_date(self, dt):
        if not dt:
            return None
        now  = timezone.now()
        diff = now - dt
        secs = diff.total_seconds()
 
        if secs < 60:       return f"{int(secs)} seconds ago"
        if secs < 3600:     return f"{int(secs / 60)} minutes ago"
        if secs < 86400:    return f"{int(secs / 3600)} hours ago"
        if secs < 604800:   return f"{int(secs / 86400)} days ago"
        if secs < 2592000:  return f"{int(secs / 604800)} weeks ago"
        if secs < 31536000: return f"{int(secs / 2592000)} months ago"
        return f"{int(secs / 31536000)} years ago"
    
class PostDetailSerializer(DisplayDateMixin, serializers.ModelSerializer):
    hit_count   = serializers.SerializerMethodField()
    files       = PostFileSerializer(many=True, read_only=True)   # ← uses the full one now
    author      = serializers.SerializerMethodField()
    categories  = CategorySerializer(source="category", many=True, read_only=True)
    tags        = TagSerializer(source="tag", many=True, read_only=True)
    display_date = serializers.SerializerMethodField()
    video_links  = serializers.SerializerMethodField()
 
    class Meta:
        model  = Post
        fields = [
            "id", "title", "slug", "image", "author",
            "content", "links",
            "published_date", "updated_date", "created_date", "display_date",
            "categories", "tags",
            "hit_count", "files", "video_links",
        ]
        read_only_fields = fields
 
    # Forward request context to nested PostFileSerializer
    def to_representation(self, instance):
        # Ensure nested serializers receive context (especially `request`)
        return super().to_representation(instance)
    
    def get_author(self, obj):
        request = self.context.get('request')
        if obj.author:
            thumbnail = obj.author.thumbnail
            return {
                'display_name': obj.author.display_name or 'MedScript',
                'thumbnail': request.build_absolute_uri(thumbnail.url) if (thumbnail and request) else None,
            }
        return {
            'display_name': 'MedScript',
            'thumbnail': None,
        }
    
    def get_display_date(self, obj):
        return super().get_display_date(obj.published_date)   # calls DisplayDateMixin
 
    def get_hit_count(self, obj):
        hit = obj.hit_count_generic.first()
        return hit.hits if hit else 0
 
    def get_video_links(self, obj):
        if not obj.links:
            return []
        items = []
        for line in obj.links.splitlines():
            line = line.strip()
            if not line:
                continue
            if "|" in line:
                title, url = line.split("|", 1)
                items.append({"title": title.strip(), "url": url.strip()})
            else:
                items.append({"title": line, "url": line})
        return items