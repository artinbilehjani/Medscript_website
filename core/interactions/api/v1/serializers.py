from rest_framework import serializers
from ...models import Comment, CommentReaction
from django.utils import timezone


class DisplayDateMixin:
    """Shared relative-time helper for serializers."""

    def get_display_date(self, dt):
        if not dt:
            return None
        now = timezone.now()
        diff = now - dt
        secs = diff.total_seconds()

        if secs < 60:
            return f"{int(secs)} seconds ago"
        if secs < 3600:
            return f"{int(secs / 60)} minutes ago"
        if secs < 86400:
            return f"{int(secs / 3600)} hours ago"
        if secs < 604800:
            return f"{int(secs / 86400)} days ago"
        if secs < 2592000:
            return f"{int(secs / 604800)} weeks ago"
        if secs < 31536000:
            return f"{int(secs / 2592000)} months ago"
        return f"{int(secs / 31536000)} years ago"


class CommentListSerializer(DisplayDateMixin, serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(read_only=True)
    dislike_count = serializers.IntegerField(read_only=True)
    user_reaction = serializers.IntegerField(read_only=True, allow_null=True)
    replies_count = serializers.IntegerField(read_only=True)
    display_date = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id",
            "author",
            "body",
            "parent",
            "created_date",
            "updated_date",
            "is_edited",
            "like_count",
            "dislike_count",
            "user_reaction",
            "replies_count",
            "display_date",
        ]

    def get_author(self, obj):
        return {
            "id": obj.author.id,
            "display_name": getattr(obj.author, "display_name", str(obj.author)),
        }

    def get_display_date(self, obj):
        return super().get_display_date(obj.created_date)


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ["body", "parent"]

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("متن کامنت نمی‌تواند خالی باشد.")
        return value

    def validate_parent(self, parent):
        if not parent:
            return None

        post = self.context.get("post")
        if not post:
            raise serializers.ValidationError("پست مشخص نیست.")

        if parent.post_id != post.id:
            raise serializers.ValidationError("پاسخ باید مربوط به همین پست باشد.")

        if parent.parent_id is not None:
            raise serializers.ValidationError("فقط یک سطح پاسخ مجاز است.")

        return parent


class CommentReactionSerializer(serializers.Serializer):
    reaction_type = serializers.ChoiceField(
        choices=CommentReaction.ReactionType.choices
    )


class LatestCommentSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="author.user.username", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "body", "created_date", "author", "parent"]
