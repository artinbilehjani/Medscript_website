from rest_framework import serializers
from ...models import PostFile
class PostFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

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
        request = self.context.get("request")
        if not obj.is_downloadable:
            return None
        url = f"/api/post-files/{obj.id}/download/"
        return request.build_absolute_uri(url) if request else url