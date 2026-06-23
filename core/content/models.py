"""
Two derived sizes, matching the three places Post images are rendered:
    - .post-item.grid-item img   → height:190px, width auto   (wide card)
    - .post-item.list-item img   → 52x52                      (tiny square)
    - .coverflow-item .cf-img    → clamp(220-300)x clamp(310-480) (portrait)

    thumbnail        400x250  (8:5)   → grid cards AND coverflow
    thumbnail_small   120x120 (1:1)   → list rows (52px) and any other
                                         small-avatar-style use
"""

import io
import os
import uuid

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import models
from django.urls import reverse
from hitcount.models import HitCount, HitCountMixin
from django.contrib.contenttypes.fields import GenericRelation
from slugify import slugify
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

try:
    from PIL import Image as PilImage

    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False


# ── upload path helpers (same convention as accounts/models.py) ────────────
#
# max_length=255 on every ImageField below (not just `image`) — Django's
# FileField default max_length is 100, which is too short once you add a
# directory prefix + original filename + extension. This was the cause of
# "Ensure this filename has at most 100 characters" on post uploads.


def _post_image_path(instance, filename):
    """images/post_thumbnails/<post_id_or_new>-<uuid8>.<ext>"""
    ext = os.path.splitext(filename)[1].lower()
    if not ext or len(ext) > 5:
        ext = ".jpg"
    short_uuid = uuid.uuid4().hex[:8]
    pk_part = instance.pk or "new"
    return f"images/post_thumbnails/{pk_part}-{short_uuid}{ext}"


def _post_thumb_path(instance, filename):
    """images/post_thumbnails/derived/<post_id_or_new>-<uuid8>.jpg"""
    short_uuid = uuid.uuid4().hex[:8]
    pk_part = instance.pk or "new"
    return f"images/post_thumbnails/derived/{pk_part}-{short_uuid}.jpg"


def _post_thumb_small_path(instance, filename):
    """images/post_thumbnails/derived/small-<post_id_or_new>-<uuid8>.jpg"""
    short_uuid = uuid.uuid4().hex[:8]
    pk_part = instance.pk or "new"
    return f"images/post_thumbnails/derived/small-{pk_part}-{short_uuid}.jpg"


class Post(models.Model):
    """
    this is a class to define posts for blog app
    """

    class Status(models.IntegerChoices):
        DRAFT = 1, _("draft")
        PUBLISHED = 2, _("published")

    author = models.ForeignKey(
        "accounts.Profile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="posts",
    )

    # CHANGED: nullable, no default, max_length raised to avoid the
    # 100-char filename error. No upload → image is None, and the
    # frontend renders its own placeholder (see notes at top of file).
    image = models.ImageField(
        upload_to=_post_image_path,
        null=True,
        blank=True,
        max_length=255,
    )

    # Derived, reduced-size images (auto-generated, never edited directly).
    # Both stay null/empty whenever `image` is null — nothing to derive from.
    thumbnail = models.ImageField(
        upload_to=_post_thumb_path,
        null=True,
        blank=True,
        editable=False,
        max_length=255,
    )  # 400x250 — used by grid cards + coverflow

    thumbnail_small = models.ImageField(
        upload_to=_post_thumb_small_path,
        null=True,
        blank=True,
        editable=False,
        max_length=255,
    )  # 120x120 — used by compact list rows

    title = models.CharField(max_length=250)
    content = models.TextField()
    status = models.IntegerField(
        choices=Status.choices,
        default=Status.PUBLISHED,
    )
    category = models.ManyToManyField("Category", blank=True, related_name="posts")
    tag = models.ManyToManyField("Tag", blank=True, related_name="posts")
    links = models.TextField(null=True, blank=True)
    hit_count_generic = GenericRelation(
        HitCount,
        object_id_field="object_pk",
        related_query_name="hit_count_generic_relation",
    )

    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)
    published_date = models.DateTimeField(default=timezone.now)
    slug = models.SlugField(
        editable=False, unique=True, max_length=255, allow_unicode=True
    )

    class Meta:
        ordering = ["-published_date"]

    def __str__(self):
        return self.title

    def _generate_unique_slug(self):
        base_slug = slugify(self.title, allow_unicode=True) or "post"
        max_length = self._meta.get_field("slug").max_length

        base_slug = base_slug[:max_length]
        slug = base_slug
        counter = 1

        while Post.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            suffix = f"-{counter}"
            trimmed_base = base_slug[: max_length - len(suffix)]
            slug = f"{trimmed_base}{suffix}"
            counter += 1

        return slug

    # ── derived image generation (mirrors Profile._generate_thumbnail) ──

    @staticmethod
    def _delete_file_by_name(name):
        if name:
            try:
                if default_storage.exists(name):
                    default_storage.delete(name)
            except Exception:
                pass

    def _generate_derived_image(self, size, field_name, path_fn):
        """
        Re-reads `self.image` FROM STORAGE (not the in-memory FieldFile,
        whose handle may already be consumed right after upload on some
        backends), center-crops to `size`'s aspect ratio, resizes, and
        saves as JPEG into the field named `field_name`.

        Requires Pillow. No-ops silently on any failure — a missing
        derived image must never break a post save.
        """
        if not HAS_PILLOW or not self.image or not self.image.name:
            return

        try:
            if not default_storage.exists(self.image.name):
                return

            with default_storage.open(self.image.name, "rb") as f:
                img = PilImage.open(f)
                img.load()
                img = img.convert("RGB")

                target_w, target_h = size
                target_ratio = target_w / target_h
                w, h = img.size
                src_ratio = w / h

                if src_ratio > target_ratio:
                    # source is wider than target — crop sides
                    new_w = int(h * target_ratio)
                    left = (w - new_w) // 2
                    img = img.crop((left, 0, left + new_w, h))
                else:
                    # source is taller than target — crop top/bottom
                    new_h = int(w / target_ratio)
                    top = (h - new_h) // 2
                    img = img.crop((0, top, w, top + new_h))

                img = img.resize(size, PilImage.LANCZOS)

                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=82, optimize=True)
                buf.seek(0)

            derived_name = path_fn(self, "derived.jpg")
            saved_name = default_storage.save(derived_name, ContentFile(buf.read()))
            getattr(self, field_name).name = saved_name

        except Exception:
            pass

    def _generate_all_derived_images(self):
        """
        No-op if there's no source image — leaves thumbnail/thumbnail_small
        as None. The frontend handles the "no image" case with its own
        placeholder; there is nothing to derive or share here.
        """
        if not self.image or not self.image.name:
            self.thumbnail = None
            self.thumbnail_small = None
            return

        self._generate_derived_image((400, 250), "thumbnail", _post_thumb_path)
        self._generate_derived_image(
            (120, 120), "thumbnail_small", _post_thumb_small_path
        )

    def get_snippet(self):
        words = self.content.split()
        snippet = " ".join(words[:5])
        if len(words) > 5:
            snippet += "..."
        return snippet

    def get_absolute_api_url(self):
        return reverse(
            "content:content_api:public-post-detail", kwargs={"slug": self.slug}
        )

    def get_absolute_url(self):
        return reverse("content:post-detail-page", kwargs={"slug": self.slug})

    # ── save / delete lifecycle (mirrors Profile) ───────────────────────

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()

        old_image_name = None
        old_thumb_name = None
        old_thumb_small_name = None

        if self.pk:
            try:
                old = Post.objects.get(pk=self.pk)
                old_image_name = old.image.name if old.image else None
                old_thumb_name = old.thumbnail.name if old.thumbnail else None
                old_thumb_small_name = (
                    old.thumbnail_small.name if old.thumbnail_small else None
                )
            except Post.DoesNotExist:
                pass

        new_image_name = self.image.name if self.image else None
        image_changed = self.pk is not None and old_image_name != new_image_name
        is_first_save = self.pk is None

        super().save(*args, **kwargs)

        if image_changed:
            # Safe to unconditionally delete here now — every image/thumbnail
            # file is uuid-suffixed and belongs to exactly one post. There is
            # no shared "default" file anymore, so no other post can ever be
            # affected by cleaning up this one's old files.
            if old_image_name and old_image_name != new_image_name:
                self._delete_file_by_name(old_image_name)
            if old_thumb_name:
                self._delete_file_by_name(old_thumb_name)
            if old_thumb_small_name:
                self._delete_file_by_name(old_thumb_small_name)

            self._generate_all_derived_images()

            Post.objects.filter(pk=self.pk).update(
                thumbnail=self.thumbnail.name if self.thumbnail else None,
                thumbnail_small=(
                    self.thumbnail_small.name if self.thumbnail_small else None
                ),
            )

        elif is_first_save or (self.image and not self.thumbnail):
            # first-ever save with image attached, or derived images
            # missing/stale for any other reason (e.g. migration backfill)
            self._generate_all_derived_images()
            Post.objects.filter(pk=self.pk).update(
                thumbnail=self.thumbnail.name if self.thumbnail else None,
                thumbnail_small=(
                    self.thumbnail_small.name if self.thumbnail_small else None
                ),
            )

    def delete(self, *args, **kwargs):
        image_name = self.image.name if self.image else None
        thumb_name = self.thumbnail.name if self.thumbnail else None
        thumb_small_name = self.thumbnail_small.name if self.thumbnail_small else None
        super().delete(*args, **kwargs)
        # Again safe unconditionally — no shared files exist anymore.
        self._delete_file_by_name(image_name)
        self._delete_file_by_name(thumb_name)
        self._delete_file_by_name(thumb_small_name)


class Category(models.Model):
    """Category Hierarchy — unchanged"""

    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(
        unique=True, max_length=60, editable=False, allow_unicode=True
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
    )
    level = models.PositiveIntegerField(editable=False, default=1)
    path = models.CharField(max_length=500, unique=True, blank=True)

    class Meta:
        ordering = ["level", "name"]

    def __str__(self):
        return self.full_name

    @property
    def full_name(self):
        parts = [self.name]
        node = self.parent
        while node:
            parts.append(node.name)
            node = node.parent
        return " > ".join(reversed(parts))

    def get_level(self):
        level = 1
        node = self.parent
        while node:
            level += 1
            node = node.parent
        return level

    def clean(self):
        if self.parent == self:
            raise ValidationError("A category cannot be its own parent.")

        ancestor = self.parent
        while ancestor:
            if ancestor == self:
                raise ValidationError("Circular hierarchy is not allowed.")
            ancestor = ancestor.parent

        self.level = self.get_level()

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name, allow_unicode=True)
            slug = base_slug
            counter = 1
            while Category.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug

        self.full_clean()

        if self.parent:
            self.path = f"{self.parent.path}/{self.slug}"
        else:
            self.path = self.slug

        super().save(*args, **kwargs)


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True, max_length=60, blank=True, allow_unicode=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name, allow_unicode=True)
        super().save(*args, **kwargs)
