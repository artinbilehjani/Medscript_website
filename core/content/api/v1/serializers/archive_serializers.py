from rest_framework import serializers
from ....models import Category, Post


class CategoryNavigationSerializer(serializers.ModelSerializer):
    has_children = serializers.SerializerMethodField()
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "slug",
            "path",
            "level",
            "full_name",
            "has_children",
        ]

    def get_has_children(self, obj):
        return obj.children.exists()


class PostListSerializer(serializers.ModelSerializer):
    snippet = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "snippet",
            "image_url",
            "published_date",
        ]

    def get_snippet(self, obj):
        return obj.get_snippet()

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image:
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None