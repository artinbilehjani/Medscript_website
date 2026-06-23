from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone

from ....models import SiteSettings, Announcement, HomepageSection
from ..serializers import (
    SiteSettingsSerializer,
    AnnouncementSerializer,
    HomepageSectionSerializer,
    PostCardSerializer,
)
from content.models import Post
from django.db.models import IntegerField, Max
from django.db.models.functions import Coalesce


class HomeAPIView(APIView):
    def get(self, request):
        settings_obj = SiteSettings.objects.first()

        active_announcement = (
            Announcement.objects.filter(
                is_active=True, published_date__lte=timezone.now().date()
            )
            .order_by("-published_date")
            .first()
        )

        sections = HomepageSection.objects.filter(is_active=True).order_by("order")

        published_posts = (
            Post.objects.filter(status=Post.Status.PUBLISHED)
            .select_related("author")
            .annotate(
                hit_count=Coalesce(
                    Max(
                        "hit_count_generic__hits"
                    ),  # adjust name if your GenericRelation differs
                    0,
                    output_field=IntegerField(),
                )
            )
        )

        latest_posts = published_posts.order_by("-published_date")[:5]
        most_viewed_posts = published_posts.order_by("-hit_count", "-published_date")[
            :5
        ]
        ctx = {"request": request}

        data = {
            "settings": (
                SiteSettingsSerializer(settings_obj).data if settings_obj else None
            ),
            "announcement": (
                AnnouncementSerializer(active_announcement).data
                if active_announcement
                else None
            ),
            "sections": HomepageSectionSerializer(sections, many=True).data,
            "latest_posts": PostCardSerializer(
                latest_posts, many=True, context=ctx
            ).data,
            "most_viewed_posts": PostCardSerializer(
                most_viewed_posts, many=True, context=ctx
            ).data,
        }
        return Response(data)
