from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import SiteSettings, Announcement, HomepageSection


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ("site_title",)
    search_fields = ("site_title", "homepage_hero_text", "contact_info", "footer_text")

    fieldsets = (
        ("General", {
            "fields": ("site_title",)
        }),
        ("Homepage", {
            "fields": ("homepage_hero_text",)
        }),
        ("Contact & Footer", {
            "fields": ("contact_info", "footer_text")
        }),
    )

    def has_add_permission(self, request):
        # Optional: allow only one site settings instance
        if SiteSettings.objects.exists():
            return False
        return super().has_add_permission(request)


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "is_active", "published_date")
    list_filter = ("is_active", "published_date")
    search_fields = ("title", "body")
    ordering = ("-published_date",)
    list_editable = ("is_active",)
    date_hierarchy = "published_date"


@admin.register(HomepageSection)
class HomepageSectionAdmin(admin.ModelAdmin):
    list_display = ("section_type", "title", "order", "is_active")
    list_filter = ("section_type", "is_active")
    search_fields = ("title",)
    ordering = ("order",)
    list_editable = ("order", "is_active")