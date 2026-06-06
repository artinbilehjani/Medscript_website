from rest_framework import serializers
from ...models import PostFile
from django.urls import reverse
from pathlib import Path

class PostFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    extension = serializers.SerializerMethodField()

    class Meta:
        model = PostFile
        fields = (
            "id",
            "title",
            "description",
            "file_type",
            "is_downloadable",
            "file_url",
            "download_url",
            "created_date",
        )

    def get_file_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return None
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def get_download_url(self, obj):
        if not obj.is_downloadable or not obj.file:
            return None
        request = self.context.get("request")

        url = reverse("post-file-download", kwargs={"pk": obj.pk})
        # url = f"/api/post-files/{obj.id}/download/"
        return request.build_absolute_uri(url) if request else url
    
    def get_extension(self, obj):
        if not obj.file:
            return None
        return Path(obj.file.name).suffix.lower().lstrip(".") or None