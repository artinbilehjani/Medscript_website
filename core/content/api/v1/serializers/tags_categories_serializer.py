from rest_framework import serializers
from ....models import Tag, Category


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("name", "slug")


class CategorySerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Category
        fields = ("name", "slug", "full_name", "level", "path")


class CategoryBucketSerializer(serializers.Serializer):
    root = CategorySerializer()
    leaves = CategorySerializer(many=True)
