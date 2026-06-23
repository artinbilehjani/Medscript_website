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
