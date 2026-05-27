
from django.db import models
from django.urls import reverse
from django.utils.text import slugify
from hitcount.models import HitCount,HitCountMixin
from django.contrib.contenttypes.fields import GenericRelation
from django.utils.text import slugify
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
import uuid
from django.utils import timezone
# Create your models here.



class Post(models.Model):
    """
    this is a class to define posts for blog app
    """
    class Status(models.IntegerChoices):
        DRAFT = 1, _("draft")
        PUBLISHED = 2, _("published")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(
        "accounts.Profile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="posts",
    )
    image = models.ImageField(
        upload_to="images/post_thumbnails/",
        default="images/default_images/blank_post_thumbnail.png",
    )
    title = models.CharField(max_length=250)
    content = models.TextField()
    status = models.IntegerField(
        choices=Status.choices,
        default=Status.PUBLISHED,
    )
    category = models.ManyToManyField("Category", blank=True, related_name="posts")
    tag = models.ManyToManyField("Tag", blank=True, related_name="posts")
    links = models.TextField(null=True,blank=True)
    hit_count_generic = GenericRelation(
        HitCount,
        object_id_field="object_pk",
        related_query_name="hit_count_generic_relation",
    )

    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)
    published_date = models.DateField(default=timezone.now)
    slug = models.SlugField(editable=False, unique=True, max_length=255)

    class Meta:
        ordering = ['-published_date']

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
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        super().save(*args, **kwargs)

    def get_snippet(self):
        words = self.content.split()
        snippet = " ".join(words[:5])
        if len(words) > 5:
            snippet += "..."
        return snippet

    def get_absolute_api_url(self):
        return reverse("blog:api-v1:post-detail", kwargs={"pk": self.pk})


class Category(models.Model):
    """Category Hierarchy"""

    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True, max_length=60, editable=False)
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children"
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
            base_slug = slugify(self.name)
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
    slug = models.SlugField(unique=True, max_length=60, blank=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    


