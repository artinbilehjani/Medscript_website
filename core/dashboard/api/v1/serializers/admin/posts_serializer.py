# ── Post (full editor) ─────────────────────────
from rest_framework import serializers
from content.models import Post, Tag, Category
from mediafiles.models import PostFile
from interactions.models import Comment, CommentReaction


# ── PostFile ───────────────────────────────────
class PostFileAdminSerializer(serializers.ModelSerializer):
    file_url = serializers.ReadOnlyField()

    class Meta:
        model = PostFile
        fields = [
            "id",
            "title",
            "description",
            "file",
            "file_url",
            "file_type",
            "is_downloadable",
            "created_date",
        ]
        read_only_fields = ["file_type", "file_url", "created_date"]


class PostEditorSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)
    files = PostFileAdminSerializer(many=True, read_only=True)

    # Use the correct M2M field names from your Post model
    tags = serializers.PrimaryKeyRelatedField(
        source="tag",  # ← Post.tag (ManyToMany)
        many=True,
        queryset=Tag.objects.all(),
        required=False,
    )
    categories = serializers.PrimaryKeyRelatedField(
        source="category",  # ← Post.category (ManyToMany)
        many=True,
        queryset=Category.objects.all(),
        required=False,
    )

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "content",  # ← correct field name (not "body")
            "links",  # ← video links field
            "status",
            "image",
            "published_date",
            "author",
            "tags",
            "categories",
            "files",
        ]
        read_only_fields = ["slug", "author", "files"]

    def to_internal_value(self, data):
        data = data.copy()
        if "status" in data:
            val = data["status"]
            if val == "published":
                data["status"] = Post.Status.PUBLISHED
            elif val == "draft":
                data["status"] = Post.Status.DRAFT
        return super().to_internal_value(data)

    def update(self, instance, validated_data):
        # M2M fields need set() not direct assignment
        tags = validated_data.pop("tag", None)
        categories = validated_data.pop("category", None)

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if tags is not None:
            instance.tag.set(tags)
        if categories is not None:
            instance.category.set(categories)

        return instance


# ── Comment ────────────────────────────────────
class CommentAdminSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField(read_only=True)
    post_title = serializers.SerializerMethodField(read_only=True)
    like_count = serializers.SerializerMethodField(read_only=True)
    dislike_count = serializers.SerializerMethodField(read_only=True)
    parent_snippet = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id",
            "body",
            "status",
            "author_name",
            "post_title",
            "post_id",
            "parent_id",
            "parent_snippet",
            "like_count",
            "dislike_count",
            "is_edited",
            "created_date",
            "updated_date",
        ]
        read_only_fields = [
            "author_name",
            "post_title",
            "like_count",
            "dislike_count",
            "parent_snippet",
            "is_edited",
            "created_date",
            "updated_date",
        ]

    def get_author_name(self, obj):
        try:
            return obj.author.display_name or obj.author.user.username
        except Exception:
            return "—"

    def get_post_title(self, obj):
        try:
            return obj.post.title
        except Exception:
            return "—"

    def get_like_count(self, obj):
        return obj.reactions.filter(
            reaction_type=CommentReaction.ReactionType.LIKE
        ).count()

    def get_dislike_count(self, obj):
        return obj.reactions.filter(
            reaction_type=CommentReaction.ReactionType.DISLIKE
        ).count()

    def get_parent_snippet(self, obj):
        if obj.parent:
            return obj.parent.get_snippet()
        return None
