from rest_framework import serializers
from dashboard.models import SiteSettings, Announcement, HomepageSection
from content.models import Post
import bleach

ALLOWED_TAGS  = ['b','strong','i','em','u','s','a','br','p','h2','h3','ul','ol','li','blockquote','span']
ALLOWED_ATTRS = {'a': ['href', 'title', 'target']}

class SiteSettingsAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SiteSettings
        fields = ["site_title", "homepage_hero_text", "contact_info", "footer_text"]
 
class AnnouncementAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Announcement
        fields = ["id", "title", "body", "is_active", "published_date"]
 
class HomepageSectionAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = HomepageSection
        fields = ["id", "order", "section_type", "title", "subtitle",
                  "content", "icon", "button_label", "button_url", "is_active"]
 
    def validate_content(self, value):
        """Sanitize HTML — strips everything not in the allow-list."""
        if not value:
            return value
        return bleach.clean(
            value,
            tags=ALLOWED_TAGS,
            attributes=ALLOWED_ATTRS,
            strip=True,
        )
 
class PostAdminSerializer(serializers.ModelSerializer):
    author         = serializers.StringRelatedField(read_only=True)
    status_display = serializers.SerializerMethodField()
    hit_count      = serializers.SerializerMethodField()
 
    class Meta:
        model  = Post
        fields = ["id", "title", "slug", "status", "status_display",
                  "image", "published_date", "author", "hit_count"]
        read_only_fields = ["slug", "author", "hit_count"]
 
    def get_status_display(self, obj):
        return "published" if obj.status == Post.Status.PUBLISHED else "draft"
 
    def get_hit_count(self, obj):
        hit = obj.hit_count_generic.first()
        return hit.hits if hit else 0
 
    def to_internal_value(self, data):
        data = data.copy()
        if "status" in data:
            val = data["status"]
            if val == "published": data["status"] = Post.Status.PUBLISHED
            elif val == "draft":   data["status"] = Post.Status.DRAFT
        return super().to_internal_value(data)