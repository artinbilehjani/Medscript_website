from rest_framework import serializers
from ....models import Post, Category,Tag
from mediafiles.models import PostFile
from accounts.models import Profile
from rest_framework.parsers import JSONParser
from django.db import transaction

class PostFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostFile
        fields = ["id", "file"]

class RecursiveCategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name","parent","slug","path","level", "children"]

    def get_children(self, obj):
        children = obj.children.all()
        return RecursiveCategorySerializer(children, many=True).data

class TagSerializer(serializers.ModelSerializer):

    class Meta:
        model = Tag
        fields = ["name", "id","slug"]

class PostListSerializer(serializers.ModelSerializer):
    snippet = serializers.ReadOnlyField(source="get_snippets")
    relative_api_url = serializers.CharField(source="get_absolute_api_url", read_only=True)
    relative_url = serializers.CharField(source="get_absolute_url", read_only=True)
    absolute_api_url = serializers.SerializerMethodField()
    absolute_url = serializers.SerializerMethodField()
    hit_count = serializers.SerializerMethodField()
    author = serializers.CharField(source="author.display_name", read_only=True)
    category = RecursiveCategorySerializer(many=True, read_only=True)
    tag = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "image",
            "author",
            "snippet",
            "absolute_api_url",
            "absolute_url",
            "relative_api_url",
            "relative_url",
            "published_date",
            "created_date",
            "category",
            "tag",
            "hit_count",
        ]
        read_only_fields = fields

    def get_absolute_api_url(self, obj):
        request = self.context.get("request")
        url = obj.get_absolute_api_url()
        return request.build_absolute_uri(url) if request else url
    
    def get_absolute_url(self, obj):
        request = self.context.get("request")
        url = obj.get_absolute_url()
        return request.build_absolute_uri(url) if request else url

    def get_hit_count(self, obj):
        hit_count_obj = obj.hit_count_generic.all().first()
        return hit_count_obj.hits if hit_count_obj else 0
        

class PostDetailSerializer(serializers.ModelSerializer):
    hit_count = serializers.SerializerMethodField(method_name="get_hit_count")
    files = PostFileSerializer(many=True, read_only=True)
    author = serializers.CharField(source='author.display_name', read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "image",
            "author",
            "content",
            'links',
            "published_date",
            "created_date",
            "category",
            "tag",
            "hit_count",
            "files",
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        request = self.context.get("request")

        rep["category"] = RecursiveCategorySerializer(
            instance.category.all(),
            many=True,
            context={"request": request},
        ).data

        rep["tag"] = TagSerializer(
            instance.tag.all(),
            many=True,
            context={"request": request},
        ).data

        return rep
    
    def get_hit_count(self, obj):
        hit_count_obj = obj.hit_count_generic.all().first()
        return hit_count_obj.hits if hit_count_obj else 0