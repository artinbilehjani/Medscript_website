from rest_framework import serializers
from content.models import Tag, Category

 
 
# ── Tags ──────────────────────────────────────
class TagAdminSerializer(serializers.ModelSerializer):
    post_count = serializers.SerializerMethodField(read_only=True)
 
    class Meta:
        model = Tag
        fields = ["id", "name", "slug", "post_count"]
        read_only_fields = ["slug"]
 
    def get_post_count(self, obj):
        return obj.posts.count()
 
    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Tag name cannot be empty.")
 
        qs = Tag.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f'A tag named "{value}" already exists.'
            )
        return value
 
 
# ── Categories (tree) ─────────────────────────
class CategoryChildSerializer(serializers.ModelSerializer):
    """One level of children — used recursively in CategoryAdminSerializer."""
    children = serializers.SerializerMethodField()
 
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "parent", "children"]
        read_only_fields = ["slug"]
 
    def get_children(self, obj):
        return CategoryChildSerializer(obj.children.all(), many=True).data
 
 
class CategoryAdminSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField(read_only=True)
    post_count = serializers.SerializerMethodField(read_only=True)
    parent_name = serializers.SerializerMethodField(read_only=True)
 
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "parent", "parent_name", "children", "post_count"]
        read_only_fields = ["slug"]
 
    def get_children(self, obj):
        return CategoryChildSerializer(obj.children.all(), many=True).data
 
    def get_post_count(self, obj):
        return obj.posts.count()
 
    def get_parent_name(self, obj):
        return obj.parent.name if obj.parent else None
 
    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Category name cannot be empty.")
 
        qs = Category.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f'A category named "{value}" already exists.'
            )
        return value
 
 
