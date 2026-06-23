from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

# Create your models here.


class SiteSettings(models.Model):
    site_title = models.CharField(max_length=250, null=True, blank=True)
    homepage_hero_text = models.TextField(null=True, blank=True)
    contact_info = models.TextField(null=True, blank=True)
    footer_text = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.site_title or "Site Settings"


class Announcement(models.Model):
    title = models.CharField(max_length=250, null=True, blank=True)
    body = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
    published_date = models.DateField(default=timezone.now)

    def __str__(self):
        return self.title or "Announcement"


class HomepageSection(models.Model):
    class SectionType(models.TextChoices):
        HERO = "hero", _("Hero")
        FEATURES = "features", _("Features")
        FEATURES_TITLE = "features_title", _("Features Title")
        ABOUT = "about", _("About")
        CTA = "cta", _("Call To Action")
        CONTACT = "contact", _("Contact")

    order = models.PositiveIntegerField(default=1)
    section_type = models.CharField(
        max_length=50,
        choices=SectionType.choices,
    )
    title = models.CharField(max_length=250, null=True, blank=True)
    is_active = models.BooleanField(default=False)
    subtitle = models.CharField(max_length=500, blank=True)
    content = models.TextField(blank=True)
    icon = models.CharField(max_length=10, blank=True)
    button_label = models.CharField(max_length=60, blank=True)
    button_url = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.get_section_type_display()} - {self.title or 'Untitled'}"
