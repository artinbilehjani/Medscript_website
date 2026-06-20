from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
 
from .models import Profile
 
User = get_user_model()
 
 
@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if not created:
        return
 
    # get_or_create instead of create(): if this signal is ever connected
    # more than once (whether by accident or because of how Django's
    # autoreload re-imports apps in dev), this becomes a no-op on the
    # second call instead of raising IntegrityError.
    Profile.objects.get_or_create(
        user=instance,
        defaults={"display_name": instance.username},
    )