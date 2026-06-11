from rest_framework import serializers
from ....models import SiteSettings, Announcement, HomepageSection
from content.models import Post

class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = ["site_title", "homepage_hero_text", "contact_info", "footer_text"]

class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ["title", "body", "published_date"]

class HomepageSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomepageSection
        fields = ["order", "section_type", "title", "is_active"]

class PostCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        # keep it “card-like” for homepage
        fields = ["id", "title", "slug", "published_date"] 