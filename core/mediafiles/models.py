from django.db import models
from django.utils.translation import gettext_lazy as _
import os
# Create your models here.

def post_file_upload_path(instance, filename):
    post_id = instance.post_id or "unknown"
    return f"files/{post_id}/{filename}"

class PostFile(models.Model):
    class FileType(models.IntegerChoices):
        PDF = 1, _("pdf")
        WORD = 2, _("word")
        PPTX = 3, _("powerpoint")
        IMAGE = 4, _("image")
        EXCEL = 5, _("excel")
        UNDEFINED = 6, _("undefined")

    file = models.FileField(upload_to=post_file_upload_path, blank=True, null=True)
    post = models.ForeignKey("content.Post", on_delete=models.CASCADE, related_name="files")
    title = models.CharField(max_length=250)
    description = models.CharField(max_length=255,null=True,blank=True)
    file_type = models.IntegerField(choices=FileType.choices,default=FileType.UNDEFINED)
    created_date = models.DateTimeField(auto_now_add=True)
    is_downloadable = models.BooleanField(default=True)

    def detect_file_type(self):
        if not self.file or not self.file.name:
            return self.FileType.UNDEFINED

        ext = os.path.splitext(self.file.name)[1].lower()

        extension_map = {
            ".pdf": self.FileType.PDF,
            ".doc": self.FileType.WORD,
            ".docx": self.FileType.WORD,
            ".ppt": self.FileType.PPTX,
            ".pptx": self.FileType.PPTX,
            ".jpg": self.FileType.IMAGE,
            ".jpeg": self.FileType.IMAGE,
            ".png": self.FileType.IMAGE,
            ".gif": self.FileType.IMAGE,
            ".webp": self.FileType.IMAGE,
            ".xls": self.FileType.EXCEL,
            ".xlsx": self.FileType.EXCEL,
            ".csv": self.FileType.EXCEL,
        }

        return extension_map.get(ext, self.FileType.UNDEFINED)

    def save(self, *args, **kwargs):
        self.file_type = self.detect_file_type()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.file.name if self.file else f"File for post {self.post_id}"
