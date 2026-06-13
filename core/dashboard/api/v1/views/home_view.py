from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone

from ....models import SiteSettings, Announcement, HomepageSection
from ..serializers import (
    SiteSettingsSerializer, AnnouncementSerializer,
    HomepageSectionSerializer, PostCardSerializer
)
from content.models import Post  # adjust import

class HomeAPIView(APIView):
    def get(self, request):
        settings_obj = SiteSettings.objects.first()

        active_announcement = (
            Announcement.objects
            .filter(is_active=True, published_date__lte=timezone.now().date())
            .order_by("-published_date")
            .first()
        )

        sections = HomepageSection.objects.filter(is_active=True).order_by("order")

        latest_posts = (
            Post.objects
            .filter(status=Post.Status.PUBLISHED)        # adjust to your model
            .order_by("-published_date")[:10]
        )

        most_viewed_posts = (
            Post.objects
            .filter(status=Post.Status.PUBLISHED)
            .order_by("-published_date",)[:10]  # adjust field name
        )

        data = {
            "settings": SiteSettingsSerializer(settings_obj).data if settings_obj else None,
            "announcement": AnnouncementSerializer(active_announcement).data if active_announcement else None,
            "sections": HomepageSectionSerializer(sections, many=True).data,
            "latest_posts": PostCardSerializer(latest_posts, many=True).data,
            "most_viewed_posts": PostCardSerializer(most_viewed_posts, many=True).data,
        }
        return Response(data)