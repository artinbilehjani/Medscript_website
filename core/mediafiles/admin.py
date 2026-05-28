from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import PostFile


@admin.register(PostFile)
class PostFileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "post",
        "file_type",
        "is_downloadable",
        "created_date",
        "has_file",
    )
    list_filter = (
        "file_type",
        "is_downloadable",
        "created_date",
    )
    search_fields = (
        "title",
        "description",
        "post__title",
        "file",
    )
    autocomplete_fields = ("post",)
    readonly_fields = (
        "created_date",
        "file_type",
        "file_preview",
    )
    list_select_related = ("post",)
    ordering = ("-created_date",)
    date_hierarchy = "created_date"

    fieldsets = (
        ("Main", {
            "fields": ("post", "title", "description", "file")
        }),
        ("Status", {
            "fields": ("file_type", "is_downloadable", "created_date")
        }),
        ("Preview", {
            "fields": ("file_preview",),
        }),
    )

    @admin.display(boolean=True, description="Has file")
    def has_file(self, obj):
        return bool(obj.file)

    @admin.display(description="File preview")
    def file_preview(self, obj):
        if obj.file:
            return obj.file.name
        return "No file"