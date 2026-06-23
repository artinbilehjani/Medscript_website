from rest_framework import serializers
from accounts.models import User, Position


class PositionAdminSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Position
        fields = ["id", "name", "description", "user_count"]

    def get_user_count(self, obj):
        return obj.users.count()


# ── User ───────────────────────────────────────
class UserAdminSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField(read_only=True)
    position_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "is_staff",
            "is_active",
            "type",
            "user_position",
            "position_name",
            "display_name",
            "created_date",
        ]
        read_only_fields = ["created_date", "display_name", "position_name"]

    def get_display_name(self, obj):
        try:
            return obj.profile.display_name
        except Exception:
            return obj.username

    def get_position_name(self, obj):
        return obj.user_position.name if obj.user_position else None
