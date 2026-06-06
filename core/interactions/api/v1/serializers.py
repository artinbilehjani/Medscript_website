from rest_framework import serializers
from ...models import Comment,CommentReaction
from django.utils import timezone

class CommentListSerializer(serializers.ModelSerializer):
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
        now = timezone.now()
        created_date = obj.created_date # Access the created_date from the model instance

        if not created_date:
            return None

        diff = now - created_date

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