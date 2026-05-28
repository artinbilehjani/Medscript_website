from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, Position , Profile
# Register your models here.



class UserInline(admin.TabularInline):
    model = User
    fk_name = "user_position"
    extra = 0
    fields = ("username", "type", "is_staff", "is_active")
    readonly_fields = ("username", "type", "is_staff", "is_active")
    can_delete = False
    show_change_link = True

@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    search_fields = ("name",)
    ordering = ("name",)
    inlines = [UserInline]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        "username",
        "type",
        "user_position",
        "is_staff",
        "is_active",
        "created_date",
    )
    list_filter = ("type", "is_staff", "is_active", "user_position", "created_date")
    search_fields = ("username",)
    ordering = ("username",)
    readonly_fields = ("created_date", "updated_date")



    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Personal info", {"fields": ("type", "user_position")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "created_date", "updated_date")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("username", "password1", "password2", "type", "user_position", "is_staff", "is_active"),
        }),
    )



@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "display_name",
        "user",
        "email",
        "created_date",
        "updated_date",
    )
    search_fields = (
        "display_name",
        "user__username",
        "email",
    )
    list_filter = (
        "created_date",
        "updated_date",
    )
    readonly_fields = (
        "id",
        "created_date",
        "updated_date",
    )
    ordering = ("display_name",)
    autocomplete_fields = ("user",)