from rest_framework import serializers
from ...models import Comment,CommentReaction

class CommentListSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(read_only=True)
    dislike_count = serializers.IntegerField(read_only=True)
    user_reaction = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id",
            "post",
            "author",
            "body",
            "parent",
            "created_date",
            "updated_date",
            "is_edited",
            "like_count",
            "dislike_count",
            "user_reaction",
        ]

    def get_author(self, obj):
        return {
            "id": obj.author.id,
            "display_name": getattr(obj.author, "display_name", str(obj.author)),
        }

    def get_user_reaction(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None

        reaction = obj.reactions.filter(user=request.user).first()
        return reaction.reaction_type if reaction else None
    
class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ["body", "parent"]

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Comment body cannot be empty.")
        return value


class CommentReactionSerializer(serializers.Serializer):
    reaction_type = serializers.ChoiceField(
        choices=CommentReaction.ReactionType.choices
    )