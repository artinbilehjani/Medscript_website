import io
import os
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _

try:
    from PIL import Image as PilImage
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False


# ── upload path helpers ─────────────────────────────────────────────────────

def _profile_image_path(instance, filename):
    """
    images/profile_pictures/<user_id>-<uuid8>.<ext>

    Using a short random suffix (instead of just <user_id><ext>) means every
    upload gets a brand-new, never-before-used filename. This avoids:
      - storage backends silently overwriting the previous file before our
        own "has the image changed" check runs
      - browser/CDN caching showing the old photo after a "successful" change
        (same filename = same cached URL)
    """
    ext = os.path.splitext(filename)[1].lower()
    if not ext or len(ext) > 5:
        ext = ".jpg"
    short_uuid = uuid.uuid4().hex[:8]
    return f"images/profile_pictures/{instance.user_id}-{short_uuid}{ext}"


def _profile_thumb_path(instance, filename):
    """Thumbnail filename mirrors whatever uuid the full image just got."""
    ext = ".jpg"  # thumbnail is always re-encoded as JPEG
    short_uuid = uuid.uuid4().hex[:8]
    return f"images/profile_pictures/thumbs/{instance.user_id}-{short_uuid}{ext}"


# ── managers / user ──────────────────────────────────────────────────────────

class UserManager(BaseUserManager):
    def create_user(self, username, password, **extra_fields):
        if not username:
            raise ValueError(_("A username is required."))
        if not password:
            raise ValueError(_("Users must have a password"))
        username = self.model.normalize_username(username)
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("type", User.UserType.ADMIN)
        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True"))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True"))
        return self.create_user(username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class UserType(models.IntegerChoices):
        CUSTOMER = 1, _("customer")
        ADMIN = 2, _("admin")

    username = models.CharField(verbose_name="username", max_length=50, unique=True)
    email = models.EmailField(unique=True, null=True, blank=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    type = models.IntegerField(choices=UserType.choices, default=UserType.CUSTOMER)
    user_position = models.ForeignKey(
        "Position",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    objects = UserManager()

    class Meta:
        ordering = ["username"]
        verbose_name = _("User")
        verbose_name_plural = _("Users")

    def __str__(self):
        return self.username


class Position(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


# ── Profile ───────────────────────────────────────────────────────────────────

class Profile(models.Model):
    user = models.OneToOneField(
        "accounts.User", on_delete=models.CASCADE, related_name="profile"
    )
    display_name = models.CharField(max_length=50)
    image = models.ImageField(
        upload_to=_profile_image_path,
        null=True,
        blank=True,
        max_length=255,  # default is 100 — raised so long original filenames
                          # never fail DRF's pre-upload_to length check
    )
    # Small 80x80 JPEG used anywhere a tiny avatar is needed (post cards,
    # comment author rows, etc.) — auto-generated, never edited directly.
    thumbnail = models.ImageField(
        upload_to=_profile_thumb_path,
        null=True,
        blank=True,
        editable=False,
        max_length=255,
    )
    description = models.TextField(null=True, blank=True)
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)
    first_name = models.CharField(max_length=100, null=True, blank=True)
    last_name = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return self.user.username

    # ── internal helpers ──────────────────────────────────────────────

    @staticmethod
    def _delete_file_by_name(name):
        """Delete a file from storage by its stored name, ignore if missing."""
        if name:
            try:
                if default_storage.exists(name):
                    default_storage.delete(name)
            except Exception:
                pass

    def _generate_thumbnail(self, size=(80, 80)):
        """
        Re-reads the just-saved full image FROM STORAGE (not from the
        in-memory FieldFile, which may have an already-consumed/closed
        file pointer right after upload on some storage backends),
        resizes to a square `size`, and saves it as JPEG into self.thumbnail.

        Requires Pillow. Silently no-ops if Pillow is missing or anything
        goes wrong — a missing thumbnail must never break a profile save.
        """
        if not HAS_PILLOW or not self.image or not self.image.name:
            return

        try:
            if not default_storage.exists(self.image.name):
                return

            with default_storage.open(self.image.name, "rb") as f:
                img = PilImage.open(f)
                img.load()  # force-read pixel data while the handle is open
                img = img.convert("RGB")

                w, h = img.size
                min_dim = min(w, h)
                left = (w - min_dim) // 2
                top = (h - min_dim) // 2
                img = img.crop((left, top, left + min_dim, top + min_dim))
                img = img.resize(size, PilImage.LANCZOS)

                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=85, optimize=True)
                buf.seek(0)

            thumb_name = _profile_thumb_path(self, "thumb.jpg")
            saved_name = default_storage.save(thumb_name, ContentFile(buf.read()))
            self.thumbnail.name = saved_name

        except Exception:
            pass

    # ── save / delete lifecycle ───────────────────────────────────────

    def save(self, *args, **kwargs):
        old_image_name = None
        old_thumb_name = None

        if self.pk:
            try:
                old = Profile.objects.get(pk=self.pk)
                old_image_name = old.image.name if old.image else None
                old_thumb_name = old.thumbnail.name if old.thumbnail else None
            except Profile.DoesNotExist:
                pass

        new_image_name = self.image.name if self.image else None
        image_changed = self.pk is not None and old_image_name != new_image_name

        super().save(*args, **kwargs)

        if image_changed:
            # Delete old files only AFTER the new row is safely committed,
            # and only if the new file actually landed under a different
            # name (guaranteed now, since upload_to always mints a fresh
            # uuid-suffixed name).
            if old_image_name and old_image_name != new_image_name:
                self._delete_file_by_name(old_image_name)
            if old_thumb_name:
                self._delete_file_by_name(old_thumb_name)

            if self.image:
                self._generate_thumbnail()
            else:
                self.thumbnail = None

            # Persist thumbnail field directly, bypassing save() to avoid
            # recursion. Use .name — NOT the FieldFile object itself.
            Profile.objects.filter(pk=self.pk).update(
                thumbnail=self.thumbnail.name if self.thumbnail else None
            )

        elif self.image and not self.thumbnail:
            # Covers: first-ever save with an image already attached,
            # or a thumbnail that's missing/stale for any other reason.
            self._generate_thumbnail()
            Profile.objects.filter(pk=self.pk).update(
                thumbnail=self.thumbnail.name if self.thumbnail else None
            )

    def delete(self, *args, **kwargs):
        """Also remove files from storage when the profile row is deleted."""
        image_name = self.image.name if self.image else None
        thumb_name = self.thumbnail.name if self.thumbnail else None
        super().delete(*args, **kwargs)
        self._delete_file_by_name(image_name)
        self._delete_file_by_name(thumb_name)


