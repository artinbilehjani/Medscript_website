from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from accounts.models import Profile
from dashboard.models import SiteSettings, Announcement, HomepageSection
from content.models import Post
from ...serializers import (
    SiteSettingsAdminSerializer,
    AnnouncementAdminSerializer,
    HomepageSectionAdminSerializer,
    PostAdminSerializer,
)

# ─── Site Settings ───────────────────────────────────────────────────────────


class SiteSettingsAdminView(APIView):
    """GET + PATCH the single SiteSettings row."""

    permission_classes = [IsAdminUser]

    def _get_obj(self):
        obj, _ = SiteSettings.objects.get_or_create(pk=1)
        return obj

    def get(self, request):
        serializer = SiteSettingsAdminSerializer(self._get_obj())
        return Response(serializer.data)

    def patch(self, request):
        serializer = SiteSettingsAdminSerializer(
            self._get_obj(), data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ─── Announcements ───────────────────────────────────────────────────────────


class AnnouncementListCreateView(APIView):
    """GET all announcements / POST a new one."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Announcement.objects.order_by("-published_date")
        return Response(AnnouncementAdminSerializer(qs, many=True).data)

    def post(self, request):
        serializer = AnnouncementAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AnnouncementDetailView(APIView):
    """GET / PATCH / DELETE a single announcement."""

    permission_classes = [IsAdminUser]

    def _get_obj(self, pk):
        return get_object_or_404(Announcement, pk=pk)

    def get(self, request, pk):
        return Response(AnnouncementAdminSerializer(self._get_obj(pk)).data)

    def patch(self, request, pk):
        serializer = AnnouncementAdminSerializer(
            self._get_obj(pk), data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        self._get_obj(pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AnnouncementToggleActiveView(APIView):
    """PATCH /announcements/<pk>/toggle-active/ — flips is_active."""

    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        obj = get_object_or_404(Announcement, pk=pk)
        obj.is_active = not obj.is_active
        obj.save(update_fields=["is_active"])
        return Response({"id": obj.pk, "is_active": obj.is_active})


# ─── Homepage Sections ────────────────────────────────────────────────────────


class HomepageSectionListView(APIView):
    """GET all sections / POST a new one."""

    permission_classes = [IsAdminUser]  # match your existing permission class import

    def get(self, request):
        qs = HomepageSection.objects.order_by("order")
        return Response(HomepageSectionAdminSerializer(qs, many=True).data)

    def post(self, request):
        data = request.data.copy()

        # New sections default to the END of the current order, so they
        # don't silently jump ahead of existing ones. The admin can still
        # drag-reorder afterward via the existing reorder endpoint.
        if "order" not in data or not data.get("order"):
            max_order = (
                HomepageSection.objects.order_by("-order")
                .values_list("order", flat=True)
                .first()
                or 0
            )
            data["order"] = max_order + 1

        serializer = HomepageSectionAdminSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class HomepageSectionDetailView(APIView):
    """PATCH / activate a single section."""

    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        obj = get_object_or_404(HomepageSection, pk=pk)
        return Response(HomepageSectionAdminSerializer(obj).data)

    def patch(self, request, pk):
        obj = get_object_or_404(HomepageSection, pk=pk)
        serializer = HomepageSectionAdminSerializer(
            obj, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class HomepageSectionReorderView(APIView):
    """
    POST /homepage-sections/reorder/
    Body: {"order": [3, 1, 4, 2]}   ← list of PKs in desired order
    """

    permission_classes = [IsAdminUser]

    def post(self, request):
        pks = request.data.get("order", [])
        if not isinstance(pks, list):
            return Response(
                {"detail": "'order' must be a list of section PKs."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sections = {s.pk: s for s in HomepageSection.objects.filter(pk__in=pks)}
        to_update = []
        for position, pk in enumerate(pks, start=1):
            if pk in sections:
                sections[pk].order = position
                to_update.append(sections[pk])
        HomepageSection.objects.bulk_update(to_update, ["order"])
        qs = HomepageSection.objects.order_by("order")
        return Response(HomepageSectionAdminSerializer(qs, many=True).data)


class HomepageSectionToggleActiveView(APIView):
    """PATCH /homepage-sections/<pk>/toggle-active/"""

    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        obj = get_object_or_404(HomepageSection, pk=pk)
        obj.is_active = not obj.is_active
        obj.save(update_fields=["is_active"])
        return Response({"id": obj.pk, "is_active": obj.is_active})


# ─── Posts ────────────────────────────────────────────────────────────────────


class PostListCreateView(APIView):
    """GET all posts (any status) / POST a new draft."""

    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        qs = Post.objects.select_related("author").order_by("-published_date")
        return Response(PostAdminSerializer(qs, many=True).data)

    def post(self, request):
        profile, _ = Profile.objects.get_or_create(
            user=request.user,
            defaults={"display_name": request.user.username},
        )
        serializer = PostAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(author=profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PostDetailView(APIView):
    """GET / PATCH / DELETE a single post."""

    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_obj(self, pk):
        return get_object_or_404(Post, pk=pk)

    def get(self, request, pk):
        return Response(PostAdminSerializer(self._get_obj(pk)).data)

    def patch(self, request, pk):
        serializer = PostAdminSerializer(
            self._get_obj(pk), data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        self._get_obj(pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PostPublishView(APIView):
    """PATCH /posts/<pk>/publish/ — sets status to PUBLISHED."""

    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        obj = get_object_or_404(Post, pk=pk)
        obj.status = Post.Status.PUBLISHED
        obj.save(update_fields=["status"])
        return Response({"id": obj.pk, "status": obj.status})


class PostUnpublishView(APIView):
    """PATCH /posts/<pk>/unpublish/ — reverts to DRAFT."""

    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        obj = get_object_or_404(Post, pk=pk)
        obj.status = Post.Status.DRAFT
        obj.save(update_fields=["status"])
        return Response({"id": obj.pk, "status": obj.status})
