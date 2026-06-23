from collections import defaultdict
from rest_framework.views import APIView
from rest_framework.response import Response

from ....models import Tag, Category
from ..serializers import TagSerializer, CategoryBucketSerializer


class FilterOptionsView(APIView):
    """
    Returns:
    {
      "tags": [...],
      "category_buckets": [
        {"root": {...}, "leaves": [{...}, ...]},
        ...
      ]
    }
    """

    def get(self, request):
        tags = Tag.objects.order_by("name")

        # Leaf categories only (no children)
        leaves_qs = (
            Category.objects.filter(children__isnull=True)
            .select_related("parent")
            .order_by("path")
        )

        buckets = defaultdict(list)

        # Group leaves by root parent
        for leaf in leaves_qs:
            root = leaf
            while root.parent_id:
                root = root.parent
            buckets[root].append(leaf)

        payload_buckets = [
            {"root": root, "leaves": leaves} for root, leaves in buckets.items()
        ]
        payload_buckets.sort(key=lambda x: x["root"].name)

        return Response(
            {
                "tags": TagSerializer(tags, many=True).data,
                "category_buckets": CategoryBucketSerializer(
                    payload_buckets, many=True
                ).data,
            }
        )
