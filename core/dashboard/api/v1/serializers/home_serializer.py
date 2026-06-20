from rest_framework import serializers
from ....models import SiteSettings, Announcement, HomepageSection
from content.models import Post
import bleach

class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SiteSettings
        fields = ["site_title", "homepage_hero_text", "contact_info", "footer_text"]
 
class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Announcement
        fields = ["title", "body", "published_date"]
 
class HomepageSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = HomepageSection
        fields = ["order", "section_type", "title", "subtitle",
                  "content", "icon", "button_label", "button_url", "is_active"]
 
class PostCardSerializer(serializers.ModelSerializer):
    hit_count    = serializers.SerializerMethodField(read_only=True)
    absolute_url = serializers.SerializerMethodField()
 
    # CHANGED: was `image` (full-res ImageField). Now the same reduced-size
    # derivative (400x250) used by the post grid/search list — generated
    # once on Post.save(), reused everywhere a card-sized image is needed.
    thumbnail = serializers.SerializerMethodField()
 
    class Meta:
        model  = Post
        fields = ["id", "title", "slug", "published_date",
                  "hit_count", "thumbnail", "absolute_url"]
 
    def get_absolute_url(self, obj):
        request = self.context.get("request")
        url     = obj.get_absolute_url()
        return request.build_absolute_uri(url) if request else url
 
    def get_hit_count(self, obj):
        hit = obj.hit_count_generic.all().first()
        return hit.hits if hit else 0
 
    def get_thumbnail(self, obj):
        """
        Mirrors ThumbnailFieldsMixin.get_thumbnail from the post list/search
        serializers. Not subclassing the mixin directly here since this
        serializer lives in a different app (dashboard vs content) and only
        needs the one field — duplicating the ~5 lines is simpler than
        cross-app imports for this. Falls back to full-res `image` only if
        a custom upload exists but hasn't been backfilled with a derived
        thumbnail yet; returns None (not a default path) if there's no
        image at all.
        """
        request = self.context.get("request")
        f = obj.thumbnail if obj.thumbnail else (obj.image if obj.image else None)
        if not f:
            return None
        url = f.url
        return request.build_absolute_uri(url) if request else url