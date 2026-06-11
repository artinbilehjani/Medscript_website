from rest_framework import serializers
from django.utils.translation import gettext_lazy as _
from .utils.captcha import verify_simple_captcha
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers
from django.utils.translation import gettext_lazy as _
from ...models import Profile, Position

User = get_user_model()

class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    captcha_key = serializers.CharField(write_only=True)
    captcha_value = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if not verify_simple_captcha(attrs.get("captcha_key"), attrs.get("captcha_value")):
            raise serializers.ValidationError({"captcha": "Invalid captcha."})

        username = attrs["username"].strip()

        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError({"username": _("This username is already taken.")})

        try:
            validate_password(attrs["password"], user=User(username=username))
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        
        attrs["username"] = username
        return attrs

    def create(self, validated_data):
        validated_data.pop("captcha_key", None)
        validated_data.pop("captcha_value", None)
        return User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
        )


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    captcha_key = serializers.CharField(write_only=True)
    captcha_value = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if not verify_simple_captcha(attrs.get("captcha_key"), attrs.get("captcha_value")):
            raise serializers.ValidationError({"captcha": "Invalid captcha."})

        request = self.context.get("request")
        user = authenticate(
            request=request,
            username=attrs["username"],
            password=attrs["password"],
        )
        if not user:
            raise serializers.ValidationError({"detail": "Invalid credentials."})
        if not user.is_active:
            raise serializers.ValidationError({"detail": "User is inactive."})

        attrs["user"] = user
        return attrs
    


class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = ["id", "name", "description"]


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    user_type = serializers.IntegerField(source="user.type", read_only=True)

    user_position = PositionSerializer(source="user.user_position", read_only=True)

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "user_type",
            "display_name",
            "email",
            "description",
            "image",
            "user_position",
            "created_date",
            "updated_date",
        ]
        read_only_fields = ["user_type","user_position","id", "created_date", "updated_date"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user and not request.user.is_staff:
            self.fields["image"].read_only = True

    def update(self, instance, validated_data):
        # Handle nested user updates (email / position)
        user_data = validated_data.pop("user", None)
        if user_data:
            user = instance.user
            for attr, value in user_data.items():
                setattr(user, attr, value)
            user.save(update_fields=list(user_data.keys()))

        return super().update(instance, validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password1 = serializers.CharField(write_only=True)
    new_password2 = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password1"] != attrs["new_password2"]:
            raise serializers.ValidationError({"new_password2": "Passwords do not match."})

        try:
            validate_password(attrs["new_password1"], self.context["request"].user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"new_password1": list(e.messages)})

        return attrs